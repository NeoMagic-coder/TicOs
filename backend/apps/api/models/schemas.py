"""Pydantic models shared across the API. Mirrors the front-end TS types."""
from __future__ import annotations

from datetime import UTC, datetime
from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class AgentStatus(str, Enum):
    active = "active"
    busy = "busy"
    idle = "idle"
    offline = "offline"


class AgentStats(BaseModel):
    tasks_completed_today: int = 0
    tasks_total: int = 0
    success_rate: float = 0.0
    avg_confidence: float = 0.0
    tools_used_today: int = 0
    avg_duration_ms: float = 0.0
    last_task_at: datetime | None = None


class AgentSpec(BaseModel):
    agent_id: str
    name: str
    role: str
    goal: str
    personality: str
    icon: str
    color: str
    allowed_tools: list[str] = Field(default_factory=list)
    allowed_tool_categories: list[str] = Field(default_factory=list)
    max_concurrent_tasks: int = 5
    max_iterations_per_task: int = 5
    escalation_threshold: float = 0.6
    sop_document_ids: list[str] = Field(default_factory=list)
    can_delegate_to: list[str] = Field(default_factory=list)
    approval_authority: list[str] = Field(default_factory=list)
    active: bool = True
    status: AgentStatus = AgentStatus.idle
    stats: AgentStats = Field(default_factory=AgentStats)


class ToolMode(str, Enum):
    mock = "mock"
    live = "live"


class ToolStats(BaseModel):
    total_calls: int = 0
    success_rate: float = 0.0
    avg_duration_ms: float = 0.0
    total_cost_usd: float = 0.0
    last_called_at: datetime | None = None


class ToolManifest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    tool_id: str
    name: str
    description: str
    version: str = "1.0.0"
    category: str
    provider: str = "internal"
    auth_required: bool = False
    timeout_ms: int = 15_000
    input_schema: dict[str, Any] = Field(default_factory=dict)
    output_schema: dict[str, Any] = Field(default_factory=dict)
    allowed_agents: list[str] = Field(default_factory=list)
    requires_approval: bool = False
    cost_estimate_usd: float = 0.0
    mode: ToolMode = ToolMode.mock
    fallback_tool_id: str | None = None
    tags: list[str] = Field(default_factory=list)
    stats: ToolStats = Field(default_factory=ToolStats)
    degraded: bool = False
    degraded_reason: str | None = None


class TaskStatus(str, Enum):
    created = "created"
    triaged = "triaged"
    assigned = "assigned"
    in_progress = "in_progress"
    waiting_tool_result = "waiting_tool_result"
    waiting_human_approval = "waiting_human_approval"
    completed = "completed"
    failed = "failed"
    escalated = "escalated"


class TaskPriority(str, Enum):
    critical = "critical"
    high = "high"
    medium = "medium"
    low = "low"


class ToolCallLog(BaseModel):
    tool_id: str
    agent_id: str
    task_id: str
    duration_ms: int
    status: Literal["success", "failure", "timeout", "fallback_used"]
    cost_usd: float = 0.0
    input: dict[str, Any] = Field(default_factory=dict)
    output: dict[str, Any] = Field(default_factory=dict)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))


class RecommendedAction(BaseModel):
    action: str
    params: dict[str, Any] = Field(default_factory=dict)
    requires_approval: bool = False
    risk_level: Literal["low", "medium", "high", "critical"] = "low"
    expected_impact: str = ""


class AgentOutput(BaseModel):
    agent_id: str
    task_id: str
    status: Literal["completed", "failed", "escalated"]
    confidence: float
    iterations_used: int = 1
    tools_called: list[ToolCallLog] = Field(default_factory=list)
    summary: str
    content: str = ""
    findings: list[str] = Field(default_factory=list)
    recommended_actions: list[RecommendedAction] = Field(default_factory=list)
    next_step: str | None = None
    started_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    completed_at: datetime | None = None


class TaskCreate(BaseModel):
    title: str
    description: str = ""
    goal: str = ""
    priority: TaskPriority = TaskPriority.medium
    context: dict[str, Any] = Field(default_factory=dict)
    deadline: datetime | None = None


class Task(BaseModel):
    task_id: str
    parent_task_id: str | None = None
    title: str
    description: str
    goal: str
    status: TaskStatus = TaskStatus.created
    priority: TaskPriority = TaskPriority.medium
    assigned_agent_id: str | None = None
    context: dict[str, Any] = Field(default_factory=dict)
    constraints: list[str] = Field(default_factory=list)
    required_capabilities: list[str] = Field(default_factory=list)
    max_iterations: int = 5
    deadline: datetime | None = None
    approval_required: bool = False
    confidence: float | None = None
    iterations_used: int = 0
    sub_tasks: list[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    completed_at: datetime | None = None
    result: AgentOutput | None = None


class ApprovalRequest(BaseModel):
    id: str
    task_id: str
    agent_id: str
    action: str
    description: str
    params: dict[str, Any] = Field(default_factory=dict)
    risk_level: Literal["low", "medium", "high", "critical"]
    expected_impact: str
    status: Literal["pending", "approved", "rejected", "modified"] = "pending"
    reviewer_note: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    resolved_at: datetime | None = None


class ChatTurn(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[ChatTurn] = Field(default_factory=list)
    product_context: dict[str, Any] | None = None


class ChatResponse(BaseModel):
    content: str
    task_id: str | None = None
    confidence: float = 0.85
    tools_used: list[str] = Field(default_factory=list)
    thinking: str | None = None
    agent_outputs: list[AgentOutput] = Field(default_factory=list)


class ToolExecutionRequest(BaseModel):
    tool_id: str
    agent_id: str
    task_id: str | None = None
    input: dict[str, Any] = Field(default_factory=dict)


class ToolExecutionResult(BaseModel):
    tool_id: str
    status: Literal["success", "failure", "timeout", "fallback_used"]
    duration_ms: int
    cost_usd: float = 0.0
    output: dict[str, Any] = Field(default_factory=dict)
    error: str | None = None
    degraded: bool = False
    degraded_reason: str | None = None
