# BRIEFING — 2026-11-06T20:32:00Z

## Mission
Coordinate task interview, route project execution, and supervise project delivery.

## 🔒 My Identity
- Archetype: sentinel
- Working directory: /Users/felipegaitan/projects/restaurant/.agents/teamwork/sentinel
- Orchestrator: e84a0498-4ac6-43a7-b21c-e535e5df7fca
- Victory Auditor: 19e5703a-eab1-423d-bee9-fd4d6201870b

## 🔒 Key Constraints
- No technical decisions — relay only
- Victory Audit is MANDATORY before reporting completion
- Frontend unificado en Next.js (TypeScript + Tailwind CSS) con vistas /mesa/[id], /cocina, /caja
- Modales nativos (<dialog> / Popover API) siguiendo directrices de modern-web-guidance
- Base de datos relacional PostgreSQL con sincronización en tiempo real
- Idempotencia obligatoria (idempotency_key UK) para evitar duplicación de comandas
- Coordinación de subagentes según roles en .agents/roles/

## User Context
- **Last user request**: User requested fast-tracked completion: prioritize immediate implementation of M2 (/mesa/[id]), M3 (/cocina), M4 (/caja) and deliver final verified project without intermediate review delays.
- **Pending clarifications**: none
- **Delivered results**: Execution started with teamwork_orchestrator; Progress reports 1-7 delivered (Orchestrator reported completion; Independent Victory Audit running Phases A-C).

## Project Status
- **Phase**: in progress (Victory Audit returned VICTORY REJECTED; audit report forwarded to orchestrator for remediation)
- **Routing Decision**: General path -> teamwork_orchestrator
- **Routing Rationale**: Full-stack application implementation with frontend, backend, real-time push, and role coordination. Does not match Document Review, Math, or single-change SWE Light.

## Victory Audit Status
- **Triggered**: yes
- **Verdict**: VICTORY REJECTED
- **Retry count**: 1

## Artifact Index
- .agents/teamwork/ORIGINAL_REQUEST.md — Authoritative user intent and approved prompt
