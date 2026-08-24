# Revenue Recovery Agent

An autonomous, bounded revenue-recovery system. It detects revenue at risk
(failed consumer payments and overdue B2B invoices), diagnoses the cause,
decides on the right intervention, executes it within policy limits, and
verifies whether the money actually came back — with a full audit trail.

Built for the Razorpay AI Buildathon (Track 3 — AI Revenue Recovery).

## Why this exists

Revenue loss rarely happens in one clean step. A payment degrades, a
subscription fails, an invoice goes unpaid. Chasing it is usually manual.
This project closes that loop: **detect → diagnose → decide → act → verify
→ recover/escalate**, with AI doing the reasoning and deterministic code
controlling anything that touches money.

## Two tracks, one engine

- **B2B Receivables** (primary showcase) — chases overdue invoices with a
  branching response model: a client can promise to pay, dispute, partially
  pay, claim they already paid, or not respond. Each response drives the
  next action.
- **Payment Failure Recovery** (proof the engine generalizes) — failed
  payment → diagnose failure reason → bounded retry → verify.

Both run on a shared core (`Case`, `RecoveryAction`, `AuditEvent`,
`Promise`, `Payment`) with slim domain-specific tables (`Invoice`,
`PaymentAttempt`) — one state machine, not two separate systems.

## AI vs. deterministic boundary

The AI (Groq/Llama) only classifies and recommends — it never directly
executes an action. Every recommendation passes through a policy engine
that checks risk level, retry limits, and idempotency before anything
executes. High-risk cases (large amounts, disputes) require human
approval instead of auto-executing. If the AI is unavailable, the system
falls back to a safe deterministic default or escalates — it never
"guesses and moves money."

## Simulation clock

Promise-to-pay outcomes can't be waited out in real time during a demo,
so the system runs on a simulation clock that can be advanced from the
dashboard (e.g. "+2 days") to trigger scheduled checks.

## Stack

- Backend: NestJS + Prisma + PostgreSQL
- Frontend: React dashboard (live metrics, audit trail per case)
- AI: Groq API (Llama 3.3 70B)
- Deploy: Vercel (frontend) + Render (backend)

## Status

Day 1 — repo scaffolded, schema designed. See `/backend/prisma/schema.prisma`.
