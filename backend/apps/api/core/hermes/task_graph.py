"""Minimal DAG primitives for breaking a user task into agent sub-tasks."""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import Any


@dataclass
class TaskNode:
    node_id: str
    title: str
    agent_id: str
    depends_on: list[str] = field(default_factory=list)
    payload: dict[str, Any] = field(default_factory=dict)
    status: str = "pending"  # pending, running, completed, failed, skipped
    result: dict[str, Any] | None = None

    @classmethod
    def new(cls, *, title: str, agent_id: str, depends_on: list[str] | None = None, payload: dict[str, Any] | None = None) -> "TaskNode":
        return cls(
            node_id=f"node_{uuid.uuid4().hex[:8]}",
            title=title,
            agent_id=agent_id,
            depends_on=depends_on or [],
            payload=payload or {},
        )


class TaskGraph:
    def __init__(self, root_task_id: str) -> None:
        self.root_task_id = root_task_id
        self.nodes: dict[str, TaskNode] = {}

    def add(self, node: TaskNode) -> TaskNode:
        self.nodes[node.node_id] = node
        return node

    def ready(self) -> list[TaskNode]:
        out: list[TaskNode] = []
        for node in self.nodes.values():
            if node.status != "pending":
                continue
            deps_ok = all(
                self.nodes[d].status == "completed" for d in node.depends_on if d in self.nodes
            )
            if deps_ok:
                out.append(node)
        return out

    def complete(self, node_id: str, result: dict[str, Any]) -> None:
        if node_id in self.nodes:
            self.nodes[node_id].status = "completed"
            self.nodes[node_id].result = result

    def fail(self, node_id: str, error: str) -> None:
        if node_id in self.nodes:
            self.nodes[node_id].status = "failed"
            self.nodes[node_id].result = {"error": error}

    def is_done(self) -> bool:
        return all(n.status in {"completed", "failed", "skipped"} for n in self.nodes.values())

    def summary(self) -> dict[str, Any]:
        return {
            "root_task_id": self.root_task_id,
            "total": len(self.nodes),
            "completed": sum(1 for n in self.nodes.values() if n.status == "completed"),
            "failed": sum(1 for n in self.nodes.values() if n.status == "failed"),
            "nodes": [
                {
                    "id": n.node_id,
                    "agent": n.agent_id,
                    "title": n.title,
                    "status": n.status,
                    "depends_on": n.depends_on,
                }
                for n in self.nodes.values()
            ],
        }
