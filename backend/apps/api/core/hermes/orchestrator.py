"""Hermes orchestrator. Single entry point for user-originated tasks.

Lifecycle:
  created → triaged → assigned → in_progress
         → (waiting_tool_result | waiting_human_approval)
         → completed | failed | escalated

Decomposes a request into a TaskGraph, runs ready nodes in parallel, merges
results, and produces an executive summary via the LLM provider.
"""
from __future__ import annotations

import asyncio
import uuid
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Any

from apps.api.agents.critic import CriticAgent, CriticScore, get_critic
from apps.api.agents.registry import AgentRegistry, get_agent_registry
from apps.api.core.budget import (
    is_agent_exhausted as _is_agent_budget_exhausted,
    record_agent_spend as _record_agent_spend,
)
from apps.api.core.config import get_settings
from apps.api.core.hermes.router import RoutingDecision
from apps.api.core.hermes.task_graph import TaskGraph, TaskNode
from apps.api.core.llm.provider import LLMMessage, get_llm_provider
from apps.api.core.logging import get_logger
from apps.api.core.memory.store import add_memory
from apps.api.core.memory.summariser import summarise_session
from apps.api.core.research.trajectory import TrajectoryCapture
from apps.api.core.skills.builder import extract_from_task
from apps.api.core.observability import (
    AGENT_DURATION,
    TASK_CONFIDENCE,
    TASK_DURATION,
    get_tracer,
)
from apps.api.core.openclaw.executor import ExecutionContext, OpenClawExecutor, get_executor
from apps.api.core.planner import PlannerAgent, PlannerPlan
from apps.api.models.schemas import AgentOutput
from apps.api.services.task_store import get_agent_stat_store

EventSink = Callable[[dict[str, Any]], Awaitable[None]]

log = get_logger(__name__)


async def _record_agent_stats(
    *,
    agent_id: str,
    tools_used: int,
    confidence: float,
    duration_ms: float,
    success: bool,
    cost_usd: float = 0.0,
) -> None:
    try:
        get_agent_stat_store().record_completion(
            agent_id,
            tools_used=tools_used,
            confidence=confidence,
            duration_ms=duration_ms,
            success=success,
            cost_usd=cost_usd,
        )
    except Exception as exc:
        log.warning("agent_stats.write_failed", agent_id=agent_id, error=str(exc)[:120])


@dataclass
class OrchestrationResult:
    task_id: str
    summary: str
    routing: RoutingDecision
    graph: dict[str, Any]
    agent_outputs: list[AgentOutput] = field(default_factory=list)
    confidence: float = 0.0
    escalated: bool = False
    tools_used: list[str] = field(default_factory=list)


class HermesOrchestrator:
    def __init__(
        self,
        agents: AgentRegistry | None = None,
        executor: OpenClawExecutor | None = None,
        planner: PlannerAgent | None = None,
        critic: CriticAgent | None = None,
    ) -> None:
        self.agents = agents or get_agent_registry()
        self.executor = executor or get_executor()
        self.settings = get_settings()
        self.llm = get_llm_provider()
        self.planner = planner or PlannerAgent(llm=self.llm)
        self.critic = critic or (get_critic() if self.settings.critic_enabled else None)

    async def handle(
        self,
        *,
        message: str,
        history: list[LLMMessage] | None = None,
        product_context: dict[str, Any] | None = None,
        event_sink: EventSink | None = None,
    ) -> OrchestrationResult:
        import time as _time

        _task_started_at = _time.monotonic()
        task_id = f"task_{uuid.uuid4().hex[:8]}"
        log.info("hermes.task.created", task_id=task_id, message=message[:80])
        tracer = get_tracer()
        _root_span_ctx = tracer.start_as_current_span("hermes.task")
        _root_span = _root_span_ctx.__enter__()
        _root_span.set_attribute("task.id", task_id)
        _root_span.set_attribute("user.message.preview", message[:120])

        async def emit(event: str, **data: Any) -> None:
            if event_sink is None:
                return
            try:
                await event_sink({"event": event, "task_id": task_id, **data})
            except Exception as exc:  # never let a sink failure break the run
                log.warning("hermes.event_sink_failed", event=event, error=str(exc)[:200])

        await emit("task_started", message=message[:200])

        # Fire-and-forget vector-memory write for the inbound user message.
        if self.settings.memory_auto_write:
            asyncio.create_task(add_memory(
                text=message,
                kind="user_message",
                task_id=task_id,
                metadata={"product": (product_context or {}).get("product_name")},
            ))

        available_specs = [a.spec for a in self.agents.all() if a.spec.active]
        plan = await self.planner.plan(
            message=message,
            product_context=product_context,
            available_agents=available_specs,
        )
        routing = _routing_from_plan(plan)

        graph = self._plan_to_graph(task_id, plan, message)
        await emit(
            "plan_ready",
            primary=routing.primary_agent,
            supporting=routing.supporting,
            nodes=[{"id": n.node_id, "agent_id": n.agent_id, "title": n.title} for n in graph.nodes.values()],
        )

        outputs: list[AgentOutput] = []
        tools_used: list[str] = []
        critic_escalated = False
        _traj = TrajectoryCapture(task_id=task_id, user_message=message)

        while not graph.is_done():
            ready = graph.ready()
            if not ready:
                break
            wave_results = await asyncio.gather(
                *[
                    self._run_node_with_events(
                        node, task_id, history or [], product_context, message, emit
                    )
                    for node in ready
                ],
                return_exceptions=True,
            )
            for node, res in zip(ready, wave_results, strict=True):
                if isinstance(res, Exception):
                    graph.fail(node.node_id, str(res))
                    await emit("agent_failed", agent_id=node.agent_id, error=str(res)[:200])
                    log.warning("hermes.node.failed", node=node.node_id, error=str(res))
                else:
                    output, called_tools, critic_score = res
                    outputs.append(output)
                    tools_used.extend(called_tools)
                    graph.complete(node.node_id, output.model_dump(mode="json"))
                    _traj.record_agent_output(output, called_tools)
                    if critic_score is not None and output.status == "escalated":
                        critic_escalated = True
                    if self.settings.memory_auto_write:
                        asyncio.create_task(add_memory(
                            text=output.content or output.summary or "",
                            kind="agent_output",
                            agent_id=output.agent_id,
                            task_id=task_id,
                            metadata={
                                "confidence": output.confidence,
                                "tools": called_tools,
                                "critic_score": critic_score.score if critic_score else None,
                            },
                        ))

        await emit("merging", outputs=len(outputs))
        summary = await self._merge(message, outputs, routing, product_context)

        # Persist trajectory fire-and-forget
        _final_confidence = sum(o.confidence for o in outputs) / len(outputs) if outputs else 0.5
        asyncio.create_task(asyncio.to_thread(_traj.finalize, summary=summary, confidence=_final_confidence))

        # Fire-and-forget learning hooks: session summarisation + skill extraction
        if self.settings.memory_auto_write:
            asyncio.create_task(self._post_task_learning(
                task_id=task_id,
                message=message,
                tools_used=list(dict.fromkeys(tools_used)),
                confidence=sum(o.confidence for o in outputs) / len(outputs) if outputs else 0.0,
            ))

        confidence = (
            sum(o.confidence for o in outputs) / len(outputs) if outputs else 0.5
        )
        escalated = (
            critic_escalated
            or confidence < self.settings.orchestrator_low_confidence_threshold
        )
        log.info("hermes.task.done", task_id=task_id, confidence=round(confidence, 2), escalated=escalated)
        await emit(
            "done",
            summary=summary,
            confidence=round(confidence, 3),
            escalated=escalated,
            tools_used=tools_used,
        )

        status_label = "escalated" if escalated else "completed"
        TASK_DURATION.labels(status=status_label).observe(
            _time.monotonic() - _task_started_at
        )
        TASK_CONFIDENCE.labels(escalated=str(escalated).lower()).observe(confidence)
        _root_span.set_attribute("task.confidence", round(confidence, 3))
        _root_span.set_attribute("task.escalated", escalated)
        _root_span.set_attribute("task.tools_used.count", len(tools_used))
        _root_span_ctx.__exit__(None, None, None)

        return OrchestrationResult(
            task_id=task_id,
            summary=summary,
            routing=routing,
            graph=graph.summary(),
            agent_outputs=outputs,
            confidence=confidence,
            escalated=escalated,
            tools_used=tools_used,
        )

    def _plan_to_graph(self, task_id: str, plan: PlannerPlan, message: str) -> TaskGraph:
        """Translate a PlannerPlan into a TaskGraph, mapping planner ids to node ids."""
        graph = TaskGraph(root_task_id=task_id)
        id_map: dict[str, str] = {}
        for pn in plan.nodes:
            deps = [id_map[d] for d in pn.depends_on if d in id_map]
            payload: dict[str, Any] = {"message": message}
            payload.update(pn.payload)
            node = graph.add(TaskNode.new(
                title=pn.title,
                agent_id=pn.agent_id,
                depends_on=deps,
                payload=payload,
            ))
            id_map[pn.id] = node.node_id
        return graph

    async def _run_node(
        self,
        node: TaskNode,
        task_id: str,
        history: list[LLMMessage],
        product_context: dict[str, Any] | None,
    ) -> tuple[AgentOutput, list[str], float]:
        import time as _time

        agent = self.agents.get(node.agent_id)
        if agent is None:
            raise RuntimeError(f"Unknown agent: {node.agent_id}")
        node.status = "running"
        ctx = ExecutionContext(agent_id=node.agent_id, task_id=task_id)
        tracer = get_tracer()
        _started = _time.monotonic()
        status = "error"
        try:
            with tracer.start_as_current_span(f"agent.{node.agent_id}") as span:
                span.set_attribute("agent.id", node.agent_id)
                span.set_attribute("task.id", task_id)
                output = await agent.run(
                    message=node.payload.get("message", ""),
                    history=history,
                    product_context=product_context or {},
                    executor=self.executor,
                    ctx=ctx,
                )
                status = output.status
                span.set_attribute("agent.status", status)
                span.set_attribute("agent.confidence", round(output.confidence, 3))
            tools_called = [t.tool_id for t in ctx.audit]
            for entry in ctx.audit:
                log.info(
                    "agent.tool_used",
                    agent_id=node.agent_id,
                    task_id=task_id,
                    tool_id=entry.tool_id,
                    status=entry.status,
                    duration_ms=round(entry.duration_ms, 1),
                    cost_usd=round(entry.cost_usd, 6),
                )
            return output, tools_called, ctx.cost_so_far_usd
        finally:
            AGENT_DURATION.labels(agent_id=node.agent_id, status=status).observe(
                _time.monotonic() - _started
            )

    async def _run_node_with_events(
        self,
        node: TaskNode,
        task_id: str,
        history: list[LLMMessage],
        product_context: dict[str, Any] | None,
        user_message: str,
        emit: Callable[..., Awaitable[None]],
    ) -> tuple[AgentOutput, list[str], CriticScore | None]:
        """Wraps _run_node with progress events and a Critic self-eval pass.

        Emits ``agent_started``, ``tool_called`` (one per audited tool call) and
        ``agent_completed``. When the critic score is below the configured
        threshold, retries the agent once before flagging the output as
        ``escalated``.
        """
        import time as _node_timer
        _node_started = _node_timer.monotonic()
        await emit("agent_started", agent_id=node.agent_id, title=node.title)

        # Paperclip-style monthly budget gate. When the agent's monthly cap
        # is exhausted we synthesise an ``escalated`` output and skip the
        # real run so the user sees *why* nothing happened instead of a
        # silent timeout. ``is_agent_exhausted`` returns False whenever the
        # cap is 0 (unset) so unconfigured agents are unaffected.
        if _is_agent_budget_exhausted(node.agent_id):
            await emit(
                "agent_budget_exhausted",
                agent_id=node.agent_id,
                title=node.title,
            )
            from datetime import UTC as _UTC, datetime as _dt
            _now = _dt.now(_UTC)
            output = AgentOutput(
                agent_id=node.agent_id,
                task_id=task_id,
                status="escalated",
                confidence=0.0,
                summary=f"Aylık bütçe tükendi — {node.agent_id} bu ay için çalıştırılamaz.",
                content="Bütçe envanteri aşıldı; supervisor onayı veya bütçe artırımı gerekiyor.",
                started_at=_now,
                completed_at=_now,
            )
            await emit(
                "agent_completed",
                agent_id=node.agent_id,
                status=output.status,
                confidence=0.0,
                critic_score=None,
                tools=[],
            )
            return output, [], None

        output, tools_called, node_cost_usd = await self._run_node(node, task_id, history, product_context)
        _node_duration_ms = (_node_timer.monotonic() - _node_started) * 1000
        for tool_id in tools_called:
            await emit("tool_called", agent_id=node.agent_id, tool_id=tool_id)

        critic_score: CriticScore | None = None
        if self.critic is not None and output.status == "completed":
            critic_score = await self.critic.evaluate(
                message=user_message,
                output_text=output.content or output.summary,
                agent_id=output.agent_id,
            )
            await emit(
                "critic_scored",
                agent_id=node.agent_id,
                score=critic_score.score,
                reason=critic_score.reason,
            )

            retries_left = self.settings.critic_max_retries
            while critic_score.score < self.settings.critic_min_score and retries_left > 0:
                retries_left -= 1
                await emit("agent_retry", agent_id=node.agent_id, reason=critic_score.reason)
                output, tools_called_again, retry_cost = await self._run_node(
                    node, task_id, history, product_context
                )
                tools_called.extend(tools_called_again)
                node_cost_usd += retry_cost
                critic_score = await self.critic.evaluate(
                    message=user_message,
                    output_text=output.content or output.summary,
                    agent_id=output.agent_id,
                )
                await emit(
                    "critic_scored",
                    agent_id=node.agent_id,
                    score=critic_score.score,
                    reason=critic_score.reason,
                    retry=True,
                )

            if critic_score.score < self.settings.critic_min_score:
                # Reflect the critic verdict on the output so merge/clients see it.
                output.status = "escalated"
                # Dampen reported confidence so the orchestrator-level
                # escalated flag also lights up.
                output.confidence = min(output.confidence, critic_score.score)

        await emit(
            "agent_completed",
            agent_id=node.agent_id,
            status=output.status,
            confidence=round(output.confidence, 3),
            critic_score=critic_score.score if critic_score else None,
            tools=tools_called,
            cost_usd=round(float(node_cost_usd), 6),
        )

        # Record stats — fire-and-forget so a DB error never blocks the response.
        asyncio.create_task(_record_agent_stats(
            agent_id=node.agent_id,
            tools_used=len(tools_called),
            confidence=output.confidence,
            duration_ms=_node_duration_ms,
            success=output.status in ("completed", "escalated"),
            cost_usd=node_cost_usd,
        ))

        # Paperclip-style monthly spend ledger — also fire-and-forget so a
        # transient DB hiccup never blocks the response. We use to_thread
        # because the budget helpers use the sync session_scope context.
        if node_cost_usd > 0:
            asyncio.create_task(asyncio.to_thread(
                _record_agent_spend, node.agent_id, float(node_cost_usd)
            ))

        return output, tools_called, critic_score

    async def _post_task_learning(
        self,
        task_id: str,
        message: str,
        tools_used: list[str],
        confidence: float,
    ) -> None:
        """Fire-and-forget post-task learning hook. Never raises."""
        try:
            await summarise_session(task_id)
            await extract_from_task(
                task_id=task_id,
                message=message,
                tools_used=tools_used,
                confidence=confidence,
                audit=[],
            )
        except Exception as exc:
            log.warning("hermes.post_task_learning_failed", task_id=task_id, error=str(exc)[:200])

    async def _merge(
        self,
        message: str,
        outputs: list[AgentOutput],
        routing: RoutingDecision,
        product_context: dict[str, Any] | None,
    ) -> str:
        if not outputs:
            return "Görev için uygun ajan bulunamadı. Lütfen sorunuzu daha somut hale getirin."

        sections: list[str] = []
        for o in outputs:
            body = (o.content or o.summary or "").strip()
            sections.append(
                f"### {o.agent_id} (conf {o.confidence:.2f})\n{body}"
            )

        system = (
            "Sen Hermes orchestratorsun. Aşağıda birden fazla ajanın TAM çıktıları var. "
            "Bunları birleştirerek kullanıcıya tek bir Türkçe yanıt üret. Ajanların ürettiği "
            "somut isimler, sayılar, öneriler KAYBOLMASIN — gerekirse aynen aktar. Çelişki varsa "
            "belirt; onay gerektiren aksiyonları satır başında ⚠️ ile işaretle. 'Ajan şunu yapacak' "
            "gibi meta cümleler kurma — ajan ne ürettiyse direkt sun."
        )
        product_block = ""
        if product_context:
            product_block = (
                f"Aktif ürün: {product_context.get('product_name', '—')} "
                f"({product_context.get('category', '—')})\n"
            )

        prompt = (
            f"{product_block}Kullanıcı sorusu: {message}\n"
            f"Routing: primary={routing.primary_agent}, supporting={routing.supporting}\n\n"
            f"Ajan çıktıları:\n\n" + "\n\n".join(sections) + "\n\n"
            f"Yapı:\n1) 1-2 cümlelik üst düzey özet\n2) Ajanların somut bulguları/önerileri (madde madde)\n3) Sıralı aksiyon listesi"
        )

        resp = await self.llm.generate(
            system=system,
            messages=[LLMMessage(role="user", content=prompt)],
            temperature=0.5,
            max_tokens=1500,
        )
        if resp.error or not resp.text:
            digest = "\n\n".join(
                f"**{o.agent_id}** (conf {o.confidence:.2f})\n{(o.content or o.summary).strip()}"
                for o in outputs
            )
            return f"📊 Analiz tamamlandı:\n\n{digest}"
        return resp.text


def _routing_from_plan(plan: PlannerPlan) -> RoutingDecision:
    """Derive the legacy RoutingDecision shape from a PlannerPlan so callers
    that still read `OrchestrationResult.routing` keep working."""
    return RoutingDecision(
        primary_agent=plan.primary_agent,
        supporting=plan.supporting,
        rationale=plan.rationale,
        urgency=plan.urgency,
    )


_orchestrator: HermesOrchestrator | None = None


def get_orchestrator() -> HermesOrchestrator:
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = HermesOrchestrator()
    return _orchestrator
