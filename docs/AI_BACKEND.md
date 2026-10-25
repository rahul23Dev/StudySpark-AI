# AI backend (apps/api)

A separate Next.js 16 TypeScript app that generates flashcards and quizzes. The mobile app calls it over HTTP; **the AI provider key lives only here**. There is no client-side key and no fallback key.

| Endpoint | Purpose |
| --- | --- |
| `GET /api/v1/health` | Status, whether AI is configured, model name, limits, today's usage and estimated cost. Never shows secrets. |
| `POST /api/v1/ai/flashcards` | Topic or notes to a deck title plus question/answer cards |
| `POST /api/v1/ai/quiz` | Topic or notes to multiple-choice and/or true/false questions with explanations |

## Provider configuration (checked 2026-10-26)

| Item | Value | Source |
| --- | --- | --- |
| Provider | Anthropic (Claude API) | |
| SDK | Official `@anthropic-ai/sdk` 1.3.0 (TypeScript) | npm |
| Model | `claude-opus-5-5` (Claude Opus 5.5): active, Anthropic's recommended default, retirement not before 22 Sep 2027 | [Models overview](https://platform.claude.com/docs/en/about-claude/models/overview) |
| Price | $4 per million input tokens, $20 per million output tokens. Thinking tokens bill as output. | [Pricing](https://platform.claude.com/docs/en/about-claude/pricing) |
| Output format | Structured outputs (`messages.parse` + Zod schema), then the server's own content checks | |
| Thinking / effort | Adaptive thinking (always on for this model); effort `medium` (`AI_EFFORT`) | |
| Safety refusals | Server-side fallback enabled (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`). If a safety classifier declines, Anthropic re-runs the request on its recommended fallback model, billed at that model's rates. Anything still refused reaches the user as a clear "couldn't create study material" message. | |
| Alternatives | Set `AI_MODEL`: `claude-sonnet-5-5` ($2 / $10) or `claude-haiku-5-5` ($0.10 / $0.50). Opus 5.5 stays the default unless you choose otherwise. | |

### Rough cost per generation (estimate, not measured)

- **Input:** a topic request is under 1,000 tokens; 20,000 characters of notes is about 5,000–6,000 tokens.
- **Output:** 10 cards plus thinking is typically a few thousand tokens.
- **Estimate:** about **$0.02–$0.15 per generation**, roughly.
- **Worst case per attempt:** 16,000 output tokens, about $0.32. A request can make up to 2 validation attempts (`AI_MAX_VALIDATION_ATTEMPTS`), and the SDK retries transient errors up to 2 times.
- **Daily cap:** the default daily budget of 500,000 tokens caps spend at **about $10 per day**, even if every token were output.

Real numbers appear in `GET /api/v1/health` → `usage` once a key is configured.

## What you need to do to turn AI on

1. **Approve paid usage.** Generation calls a paid API, so nothing has been called yet.
2. Create an account at [platform.claude.com](https://platform.claude.com/), add billing, and create an **API key**. Consider setting a monthly spend limit in the Console as well.
3. In `apps/api`, run `copy .env.example .env.local`, then paste the key after `ANTHROPIC_API_KEY=`. **Don't paste the key into chat.** `.env.local` is git-ignored.
4. Restart the API (`npm run api:dev` from the project root) and open `http://localhost:3001/api/v1/health`. It should show `"configured": true`.
5. In the app's `.env.local` (project root), `EXPO_PUBLIC_API_BASE_URL` must point at this PC: `http://192.168.1.3:3001` today. Restart Expo with `npx expo start -c`.

Without a key, generation answers `503 ai_not_configured` with exactly those instructions, and the app shows them.

## Safety and limits

- **Key handling:** the key is read from server env only. It never appears in responses or logs, and the app never sees it.
- **Request checks:**
  - Zod schemas with size limits: topic 2–200 characters, notes 40–20,000 characters, up to 30 cards or 20 questions.
  - Body limit `AI_MAX_BODY_BYTES` (64 KB).
  - Unknown fields are rejected.
- **Output checks:**
  - Exact count; no duplicate questions.
  - Multiple choice has exactly 4 distinct options; true/false has exactly "True" and "False".
  - A valid correct-answer index, and an explanation is required.
  - Length limits within the app's database limits.
  - Source quotes are kept only when they appear verbatim in your notes.
  - Failing output is retried once with the problems listed, then rejected (`502 invalid_ai_output`). It's never padded or faked.
- **Failures:** timeouts (`504`), rate limits (`429` with Retry-After), provider outages (`503`), bad key or model (`503 ai_misconfigured`) and refusals (`422`) all map to clear, retry-aware messages.
- **Bounds:**
  - Per-client rate limit (10 per minute).
  - At most 3 concurrent generations.
  - A daily token budget.
  - A 60-second per-attempt timeout.
  - A 150-second overall request deadline.
  - Usage counters are in memory, per process; they reset on restart.
- **Logging:** request ID, kind, sizes, counts, token usage, timing and error codes only. No notes, topics, generated content or keys.
- **Saving:** the app saves a generated deck in **one transaction**. Any invalid item or failed write saves nothing, and existing decks are never touched.

## Not done yet (needs your decision)

- **Authentication:** the API has no user authentication. It is meant for your local network during development only. **Don't expose it to the internet or deploy it** until cloud authentication is added (next phase, with your approval).
- **Privacy wording:** notes are sent to Anthropic to generate content. Before release, review Anthropic's commercial terms and data-retention policy, and mention this in the app's privacy policy.

## Development

```powershell
npm run api:install   # once
npm run api:dev       # http://localhost:3001 (also on your Wi-Fi address)
npm run api:check     # type-check + 65 unit tests (no real AI calls)
```
