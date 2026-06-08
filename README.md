# LeadMastraChat

Commercial intake chatbot that qualifies leads using AI — built as a learning project to understand agent-based architectures with [Mastra](https://mastra.ai/).

## What it does

A user sends a free-text message describing their need. The system:

1. Runs the message through an **AI agent** that extracts structured data (contact info, budget signals, urgency, decision authority)
2. Scores the lead **deterministically** (0–100) using fixed rules — no AI involved in the scoring
3. Saves every lead to **Supabase** regardless of score (to track conversion over time)
4. (In progress) Pushes high-score leads (≥75) to **HubSpot** as contacts

## Stack

- **Mastra** — agent and workflow orchestration
- **OpenAI** — structured output extraction via `agent.generate()` with Zod schema validation
- **Supabase** — lead persistence
- **HubSpot** — CRM integration (in progress)
- **TypeScript** (strict) + ESM + Zod v4

## Architecture

```
message* and PDF(optional)
      ↓
[extract-pdf-step]   ← optional, reads PDF with unpdf
      ↓
[analyze-lead-step]  ← AI agent → structured output (Zod-validated)
      ↓
[score-lead-step]    ← pure function, deterministic rules
      ↓
[save-lead-step]     ← inserts to Supabase

Next phase: add a conditional HubSpot step for score ≥75.
```

Business rules live outside the agent prompt. `calculateLeadScore` is a pure function, while `insertLead` isolates the Supabase write behind a small service-style function. Both are imported directly by the workflow instead of being hidden inside Mastra tools.

## Setup

```bash
cp .env.example .env   # fill in your keys
npm install
npm run dev            # Mastra Studio at http://localhost:4111
```

## Roadmap

- [x] Phase 1 — MVP: message → analysis → score → Supabase
- [x] Phase 2 — PDF support: upload a requirements PDF, extract text, feed into agent
- [ ] Phase 3 — HubSpot: push qualified leads to CRM
- [ ] Phase 4 — API Gateway: Express layer with auth, rate limiting, and SSE
- [ ] Phase 5 — RAG: lightweight retrieval for internal guidelines
