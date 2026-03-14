Owner-managed repo. Telegraph. Min tokens.

## Memory
- durable prefs/rules/notes to `~/agents-database`
- do not rely on Codex-only local state as source of truth

## Git / Deploy
- default branch: `main`
- this repo auto-deploys to Vercel
- for anything beyond very small/simple changes, use PRs instead of pushing direct to `main`
- direct push to `main` acceptable only for clearly low-risk/simple changes
- treat this as near-future client production

## Workflow
- safe by default: check `git status/diff` first
- prefer end-to-end verify before handoff
