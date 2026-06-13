"""AutoResearch Engine.

Runs autonomous hyperparameter/strategy optimization loops guided by a ``program.md`` file.
"""
from __future__ import annotations

import json
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import select

from apps.api.core.db.engine import session_scope
from apps.api.core.db.models import AutoResearchRunRow
from apps.api.core.config import get_settings
from apps.api.core.hermes.orchestrator import HermesOrchestrator, get_orchestrator
from apps.api.core.llm.provider import LLMMessage, get_llm_provider
from apps.api.core.logging import get_logger

log = get_logger(__name__)


class AutoResearchEngine:
    def __init__(
        self,
        orchestrator: HermesOrchestrator | None = None,
        report_dir: str | Path | None = None,
    ) -> None:
        self.orchestrator = orchestrator or get_orchestrator()
        self.llm = get_llm_provider()
        self.report_dir = Path(report_dir or get_settings().autoresearch_report_dir)

    def parse_program(self, content: str) -> dict[str, Any]:
        """Parse recipe name, metric, optimization mode, and default instructions from program.md."""
        recipe_name = "AutoResearch Optimization"
        metric = "expected_revenue_lift_pct"
        mode = "maximize"
        base_prompt = "Dynamic Pricing Agent: rakip fiyat ve talep analizine göre fiyat optimizasyonu yap."

        # Parse Recipe Name
        recipe_match = re.search(r"^#\s*(?:AutoResearch\s+Recipe:\s*)?([^\n]+)", content, re.MULTILINE)
        if recipe_match:
            recipe_name = recipe_match.group(1).strip()

        # Parse Metric Name
        metric_match = re.search(r"-\s*(?:Target\s+)?Metric:\s*`?([a-zA-Z_0-9]+)`?", content, re.IGNORECASE)
        if metric_match:
            metric = metric_match.group(1).strip()

        # Parse Optimization Mode (maximize/minimize)
        mode_match = re.search(r"-\s*Mode:\s*`?([a-zA-Z]+)`?", content, re.IGNORECASE)
        if mode_match:
            mode = mode_match.group(1).strip().lower()
            if mode not in ("maximize", "minimize"):
                mode = "maximize"

        # Parse Base Prompt
        prompt_match = re.search(r"-\s*(?:Base\s+)?Prompt:\s*\"([^\"]+)\"", content, re.IGNORECASE)
        if prompt_match:
            base_prompt = prompt_match.group(1).strip()
        else:
            prompt_match = re.search(r"-\s*(?:Base\s+)?Prompt:\s*'([^']+)'", content, re.IGNORECASE)
            if prompt_match:
                base_prompt = prompt_match.group(1).strip()

        # Extract step descriptions if available
        steps = []
        for line in content.splitlines():
            step_match = re.match(r"^\d+\.\s*(.*)", line.strip())
            if step_match:
                steps.append(step_match.group(1).strip())

        return {
            "recipe_name": recipe_name,
            "metric_name": metric,
            "mode": mode,
            "base_prompt": base_prompt,
            "steps": steps,
        }

    async def run_loop(self, goal_id: str, program_path: str, max_cycles: int = 3) -> dict[str, Any]:
        """Read a program.md file, execute the optimization loop, and write a markdown report."""
        started_at = datetime.now(timezone.utc)
        log.info("autoresearch.loop.start", goal_id=goal_id, program_path=program_path, cycles=max_cycles)

        path = Path(program_path)
        if not path.exists():
            raise FileNotFoundError(f"Program file not found at: {program_path}")

        content = path.read_text(encoding="utf-8")
        recipe = self.parse_program(content)

        metric_name = recipe["metric_name"]
        mode = recipe["mode"]
        base_prompt = recipe["base_prompt"]
        recipe_name = recipe["recipe_name"]

        # Track trials
        trials: list[dict[str, Any]] = []

        # Run optimization cycles
        for cycle in range(1, max_cycles + 1):
            log.info("autoresearch.cycle.start", cycle=cycle, max_cycles=max_cycles)

            # 1. Suggest parameters for this cycle using the LLM
            params = await self._suggest_parameters(recipe, trials, cycle)
            log.info("autoresearch.cycle.params", cycle=cycle, params=params)

            # 2. Append parameters to base prompt and set up product context
            trial_prompt = f"{base_prompt} [AutoResearch Parametreleri: {', '.join(f'{k}={v}' for k, v in params.items())}]"
            product_context = {
                "product_name": "OneProduct",
                "category": "Genel",
                "autoresearch_params": params,
                "goal_id": goal_id,
            }

            # 3. Execute Hermes Orchestration
            orchestration_result = await self.orchestrator.handle(
                message=trial_prompt,
                history=[],
                product_context=product_context,
            )

            # 4. Extract Metric Value
            metric_val = await self._extract_metric_value(orchestration_result.summary, metric_name)
            log.info("autoresearch.cycle.metric", cycle=cycle, metric=metric_name, value=metric_val)

            # 5. Persist run row in DB
            trial_id = f"run_{uuid.uuid4().hex[:10]}"
            trial_data = {
                "id": trial_id,
                "goal_id": goal_id,
                "recipe_name": recipe_name,
                "metric_name": metric_name,
                "metric_value": metric_val,
                "parameters": params,
                "status": "completed",
                "iteration": cycle,
                "summary": orchestration_result.summary,
            }
            trials.append(trial_data)

            try:
                with session_scope() as db:
                    row = AutoResearchRunRow(
                        id=trial_id,
                        goal_id=goal_id,
                        recipe_name=recipe_name,
                        metric_name=metric_name,
                        metric_value=metric_val,
                        parameters=params,
                        status="completed",
                        iteration=cycle,
                        summary=orchestration_result.summary,
                        created_at=datetime.now(timezone.utc),
                    )
                    db.add(row)
            except Exception as exc:
                log.warning("autoresearch.db_write_failed", error=str(exc))

        # Determine the best trial
        if not trials:
            return {"status": "failed", "reason": "No trials completed"}

        best_trial = trials[0]
        for t in trials[1:]:
            if mode == "maximize":
                if t["metric_value"] > best_trial["metric_value"]:
                    best_trial = t
            else:
                if t["metric_value"] < best_trial["metric_value"]:
                    best_trial = t

        # Write markdown report
        safe_goal_id = re.sub(r"[^a-zA-Z0-9._-]+", "_", goal_id).strip("._") or "goal"
        report_path = self.report_dir / f"{safe_goal_id}_autoresearch_report.md"
        report_content = self._generate_report_markdown(recipe, trials, best_trial, started_at)
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(report_content, encoding="utf-8")

        log.info("autoresearch.loop.complete", best_metric=best_trial["metric_value"], best_params=best_trial["parameters"])
        return {
            "status": "completed",
            "recipe_name": recipe_name,
            "metric_name": metric_name,
            "best_value": best_trial["metric_value"],
            "best_parameters": best_trial["parameters"],
            "report_path": str(report_path),
            "trials_count": len(trials),
        }

    async def _suggest_parameters(self, recipe: dict[str, Any], trials: list[dict[str, Any]], cycle: int) -> dict[str, Any]:
        """Let LLM suggest next parameters to try based on previous trial history."""
        # Baseline check (first cycle)
        if cycle == 1:
            # Try to return default baseline parameters
            return {"epsilon": 0.1, "max_price_change_pct": 5.0}

        history_str = ""
        for t in trials:
            history_str += f"- Iterasyon {t['iteration']}: Parametreler={json.dumps(t['parameters'])}, Metrik ({t['metric_name']})={t['metric_value']}\n"

        system = (
            "Sen AutoResearch Hiperparametre Optimizasyon Ajanısın. Görevin, verilen kurallar ve geçmiş denemelerin "
            "sonuçlarına bakarak bir sonraki adımda denenecek en optimum parametre değerlerini önermektir."
        )

        prompt = (
            f"Optimizasyon Tarifi: {recipe['recipe_name']}\n"
            f"Hedef Metrik: {recipe['metric_name']} (Hedef: {recipe['mode']} etmek)\n"
            f"Mevcut İterasyon: {cycle}\n\n"
            f"Geçmiş Denemeler:\n{history_str}\n"
            f"Yönerge Talimatları: {recipe['steps']}\n\n"
            "Lütfen bir sonraki iterasyonda denenecek parametreleri seç. "
            "Sadece JSON formatında çıktı ver. Başka hiçbir açıklama metni ekleme. "
            "Format Örneği:\n"
            '{"epsilon": 0.15, "max_price_change_pct": 3.0}'
        )

        try:
            resp = await self.llm.generate(
                system=system,
                messages=[LLMMessage(role="user", content=prompt)],
                temperature=0.2,
                max_tokens=64,
            )
            cleaned = (resp.text or "").strip().strip("`").strip()
            # If markdown JSON block is returned
            if cleaned.startswith("json"):
                cleaned = cleaned[4:].strip()
            return json.loads(cleaned)
        except Exception as exc:
            log.warning("autoresearch.parameter_suggestion_failed", error=str(exc))
            # Fallback to perturbed parameters
            last_params = trials[-1]["parameters"] if trials else {"epsilon": 0.1}
            perturbed = {k: round(v * (1.1 if cycle % 2 == 0 else 0.9), 3) if isinstance(v, (int, float)) else v for k, v in last_params.items()}
            return perturbed

    async def _extract_metric_value(self, summary: str, metric_name: str) -> float:
        """Extract the numeric value of the metric from the summary text using LLM."""
        system = "Sen metinlerden sayısal veri çıkaran bir yardımcı ajansın."
        prompt = (
            f"Aşağıdaki özet metinden '{metric_name}' metriğine ait sayısal değeri çıkar.\n"
            f"Metin: \"{summary}\"\n\n"
            "Sadece ve sadece sayıyı (float veya integer olarak, örn. 12.5 veya 0.22) dön. "
            "Metinde değer açıkça yazmıyorsa veya bulunamıyorsa 0.0 dön. Başka hiçbir şey yazma."
        )

        try:
            resp = await self.llm.generate(
                system=system,
                messages=[LLMMessage(role="user", content=prompt)],
                temperature=0.0,
                max_tokens=16,
            )
            cleaned = (resp.text or "").strip()
            # extract first decimal/number from string
            match = re.search(r"[-+]?\d*\.\d+|\d+", cleaned)
            if match:
                return float(match.group())
            return 0.0
        except Exception:
            return 0.0

    def _generate_report_markdown(self, recipe: dict[str, Any], trials: list[dict[str, Any]], best_trial: dict[str, Any], started_at: datetime) -> str:
        finished_at = datetime.now(timezone.utc)
        duration = (finished_at - started_at).total_seconds()

        trials_rows = ""
        for t in trials:
            is_best = "⭐ En İyi" if t["id"] == best_trial["id"] else ""
            trials_rows += f"| {t['iteration']} | {json.dumps(t['parameters'])} | **{t['metric_value']:.4f}** | {is_best} |\n"

        return f"""# 🔬 AutoResearch Optimizasyon Raporu

> Bu rapor, **{recipe['recipe_name']}** optimizasyon tarifi doğrultusunda otonom olarak üretilmiştir.

## 📊 Özet Bulgular
- **Hedef Metrik:** `{recipe['metric_name']}` ({recipe['mode']})
- **En İyi Değer:** **{best_trial['metric_value']:.4f}** (İterasyon {best_trial['iteration']})
- **En İyi Parametreler:** `{json.dumps(best_trial['parameters'])}`
- **Başlangıç:** `{started_at.strftime('%Y-%m-%d %H:%M:%S')} UTC`
- **Bitiş:** `{finished_at.strftime('%Y-%m-%d %H:%M:%S')} UTC`
- **Toplam Süre:** `{duration:.1f} saniye`

---

## 📈 İterasyon Detayları

| İterasyon | Denenen Parametreler | Sonuç ({recipe['metric_name']}) | Durum |
| :--- | :--- | :--- | :--- |
{trials_rows}

---

## 💡 Öneri ve Analiz
En yüksek performansı sağlayan parametre kümesi `{json.dumps(best_trial['parameters'])}` olarak belirlenmiştir. 
Bu değerler, hedeflenen başarı kriterini optimize etmek amacıyla operasyonel politikalara ve ilgili ajanların konfigürasyonlarına otomatik olarak yansıtılabilir.

_AutoResearch Engine tarafından {finished_at.strftime('%Y-%m-%d %H:%M:%S')} tarihinde otonom oluşturuldu._
"""
