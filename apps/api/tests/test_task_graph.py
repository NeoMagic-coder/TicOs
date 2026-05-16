from __future__ import annotations

from apps.api.core.hermes.task_graph import TaskGraph, TaskNode


def test_dag_dependency_ordering():
    g = TaskGraph(root_task_id="t_1")
    a = g.add(TaskNode.new(title="A", agent_id="x"))
    b = g.add(TaskNode.new(title="B", agent_id="y", depends_on=[a.node_id]))
    g.add(TaskNode.new(title="C", agent_id="z", depends_on=[b.node_id]))

    ready_ids = [n.node_id for n in g.ready()]
    assert a.node_id in ready_ids and b.node_id not in ready_ids

    g.complete(a.node_id, {"ok": True})
    ready_ids = [n.node_id for n in g.ready()]
    assert b.node_id in ready_ids


def test_dag_completion():
    g = TaskGraph(root_task_id="t_2")
    n = g.add(TaskNode.new(title="solo", agent_id="x"))
    assert not g.is_done()
    g.complete(n.node_id, {"ok": True})
    assert g.is_done()
    summary = g.summary()
    assert summary["completed"] == 1
