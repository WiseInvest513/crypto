<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Wise Crypto repository rules

- Before starting or continuing any product phase, read this file and `docs/product-specs/wise-crypto-v0.md` in full.
- Implement only the phase explicitly approved by the user. Run all required checks, report, and stop before the next phase.
- Server Components are the default. Keep Client Components limited to genuine browser interaction.
- UI components must not call third-party market APIs directly. They consume normalized server-side domain services.
- Never ship synthetic market data as production data. Missing reliable data must render as unavailable, never as zero.
- Keep provider secrets server-only. No market-data secret may use a `NEXT_PUBLIC_*` name.
- Editorial judgments, support/resistance, scenarios, product facts, fees, and referral benefits may not be invented.
- Preserve source, scope, as-of time, retrieval time, stale state, and cache metadata through every live data path.
- Public site rendering must remain independent of future Wise ID/session state.
- Required phase checks are `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.
- Always run this repository's development and production preview servers on port `2222`; do not fall back to port `3000`.
- Do not push, deploy, configure DNS, or begin the next phase without explicit user authorization.
