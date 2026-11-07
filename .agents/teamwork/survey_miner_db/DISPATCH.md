## 2026-11-06T20:33:23Z
You are teamwork_spec_miner investigating database and backend architecture requirements.
Working directory: /Users/felipegaitan/projects/restaurant/.agents/teamwork/survey_miner_db/

MANDATORY INPUT:
Read /Users/felipegaitan/projects/restaurant/.agents/teamwork/ORIGINAL_REQUEST.md first.
Also read /Users/felipegaitan/projects/restaurant/.agents/roles/db-architect.md and any database/backend files or specs present in the workspace.

OBJECTIVE:
Analyze all requirements for R2 (Backend y Base de Datos Reactiva) and database-related aspects of R1 and Acceptance Criteria:
1. Exact database schema design: tables, relational modifiers (first-class relational tables, strictly no free-form text), tables for products, orders, order items, modifier groups, item modifiers, tables/mesas, bills/payments.
2. Idempotency mechanism: unique constraint on idempotency_key (UUID), handling duplicate order submissions.
3. Real-time synchronization architecture: PostgreSQL CDC / LISTEN/NOTIFY or WebSocket architecture between DB, Next.js server, and web clients (KDS, table, cashier).
4. TypeScript contracts and data models synchronization.
5. Migration/seed strategy and Docker PostgreSQL configuration.

SCOPE BOUNDARIES:
- Read-only exploration and specification mining. Do NOT write code or modify files outside your working directory.
- Write your findings to /Users/felipegaitan/projects/restaurant/.agents/teamwork/survey_miner_db/report.md and /Users/felipegaitan/projects/restaurant/.agents/teamwork/survey_miner_db/handoff.md.

COMPLETION CRITERIA:
Provide a detailed report enumerating all features, data structures, constraints, SQL schema design, endpoints/contracts, and dependencies. Then send a message to orchestrator with your summary and handoff file path.
