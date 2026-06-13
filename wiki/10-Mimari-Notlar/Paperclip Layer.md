# Paperclip Layer

Flat agent registry üzerine "şirket şekli" giydiren 3 ince katman. Mevcut işlevselliği değiştirmez, ekler.

## 1. Org Chart
**Konum:** `backend/apps/api/core/org/` + route `routes/org.py`.

5 sabit departman: `yonetim`, `pazarlama`, `operasyon`, `finans`, `arge`. Her birinin bir head ajanı ve toplam 22 membership var (her seed ajanı bir departmana bağlı). `seed_default_org()` FastAPI lifespan'da idempotent çalışır. Frontend: `OrgPage`.

## 2. Goal Tree
**Konum:** `models.py:GoalRow` + `routes/goals.py`.

`parent_goal_id` ile self-referential ağaç. `TaskRow.goal_id` üzerinden task'lar hedeflere bağlanır. `/api/v1/goals/tree/full` → nested `{goal, children[], task_count}` yapısı. Frontend: `GoalsPage` (depth indentation).

## 3. Per-Agent Monthly Budget
**Konum:** `core/budget.py` + `models.py:AgentBudgetRow`.

`(agent_id, month=YYYY-MM)` başına bir satır. Fonksiyonlar:
- `set_agent_budget`
- `record_agent_spend` (spent_usd'i limit_usd'e clamp eder)
- `remaining_agent_budget` (`limit_usd == 0` → `None` = "cap yok")
- `is_agent_exhausted`

**Gate konumu:** [[Hermes Orkestratör]] `_run_node_with_events` içinde — exhausted ajan için `agent_budget_exhausted` event yayılır ve LLM çağrılmadan `AgentOutput(status="escalated", confidence=0.0)` döner. Başarılı run sonrası cost `asyncio.to_thread` ile kayıt edilir.

Frontend: `BudgetsPage` (inline limit + green/amber/red progress bar).

## SQLite Migration Notu
`_ensure_sqlite_columns()` helper `init_db()` içinde `tasks.goal_id` gibi yeni kolonları mevcut dev DB'ye `ALTER TABLE` ile ekler. Prod Postgres'te gerçek migration kullanılmalı.
