---
name: feature-pipeline
description: >-
  Turns a rough Meal Diary idea into market research, best-practice review,
  clarifying questions, an approved brief and design, then implementation and
  tests across the API, Nuxt web app, and Expo mobile app. Use when the user
  invokes /feature-pipeline, or asks to run the feature pipeline, shape a
  feature from a rough brief, or orchestrate research, requirements, design,
  development, and testing for Meal Diary.
disable-model-invocation: true
---

# Feature pipeline

You are the orchestrator. Specialists do the research, design, implementation, and test runs. You launch them with the Task tool, ask the user the open questions, and enforce the gates.

## Start

The user invoked `/feature-pipeline` with a rough idea. A sentence is enough. When the message has no idea, ask for one sentence and wait.

Choose a stable kebab-case slug from the idea. Reuse it for `docs/features/<slug>/` for the rest of the pipeline.

## Resume

When this conversation already passed a gate, continue from the next gate. Keep the existing research unless the new answers change the problem.

## How to launch

Subagents do not see this chat. Every Task prompt includes the rough idea, decisions so far, the handoff they must return, and the directories they may touch.

- Set `subagent_type` to the agent name below.
- Launch agents that share a phase in one message, as separate Task calls.
- Keep `run_in_background` false when the next gate needs their result.
- Leave the model unset so the agent file's `inherit` setting applies.
- Stay on the local checkout. Use a cloud subagent only when the user asks.
- Commit only when the user asks.

Return shapes are in [handoffs.md](handoffs.md). Name the section the agent must fill.

## Phase 1 — Research

Launch together:

- `market-researcher`
- `practice-reviewer`

Then tell the user, in prose:

- what the idea appears to be
- what Meal Diary already does
- what market practice and this codebase imply

Ask the open questions using the rules below. Then stop. Leave product code and `docs/features/` untouched until the user answers.

## Questions

Ask at most seven questions, with the AskQuestion tool. Put the recommended choice first and end its label with `(Recommended)`.

Ask only what the research left open. Draw from: who it is for, which of API, web, and mobile must change, what is required now versus later, whether family sharing changes, whether premium or entitlements apply, and what done looks like.

State any leftover uncertainty as an assumption the user can reject at the design gate.

## Phase 2 — Design

After the user answers, launch `product-designer` with the idea, both research handoffs, and the answers.

The designer is read-only. Take the returned `brief.md` and `design.md` and write them to:

- `docs/features/<slug>/brief.md`
- `docs/features/<slug>/design.md`

Show the brief and design in the chat, with those paths. Then stop until the user approves them.

On a design change, resume `product-designer` with the requested change and update the same files. Builders stay idle until approval.

## Phase 3 — Build

After the user approves the design:

1. Launch `api-builder` when the design changes `api/` or `packages/shared/`. That agent owns the shared contract.
2. After it finishes, launch `web-builder` and `mobile-builder` together for every surface the design marks in scope. Give them the contract from the API builder's report.
3. Skip a builder whose surface the design marks unchanged. Skip the API builder when both `api/` and `packages/shared/` are unchanged, and start the client builders immediately.

Builders follow `.cursor/rules/meal-diary-rules.mdc`, `AGENTS.md`, and `apps/mobile/AGENTS.md`. Each builder stays inside its own directories.

## Phase 4 — Verify

Launch `verifier` with the design's test plan, the builder reports, and which apps are already running.

When the web UI changed, you also exercise the flow in the browser: click, type, submit, and navigate the affected routes, including the empty and error states the design names. A screenshot alone does not verify the change. Check other pages that share the state you changed.

When verification fails, send that failure to the builder for the surface once, then run `verifier` again. Report a second failure to the user and stop.

## Agents

| Agent | Writes |
| --- | --- |
| `market-researcher` | Nothing. Returns the market handoff. |
| `practice-reviewer` | Nothing. Returns the practice handoff. |
| `product-designer` | Nothing. Returns `brief.md` and `design.md` for you to save. |
| `api-builder` | `api/` and `packages/shared/` only. |
| `web-builder` | `frontend/` only. |
| `mobile-builder` | `apps/mobile/` only. |
| `verifier` | Nothing. Runs the checks and returns the verification handoff. |
