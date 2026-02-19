# codex-runner

Tiny local HTTP service that runs the Codex CLI in a target repo and returns output plus a git diff.

## Setup

```bash
npm install
```

## Run

```bash
CODEX_TOKEN=your-shared-secret npm start
```

Server binds to `127.0.0.1` only by design.

## Example

```bash
curl -sS \
  -H 'Content-Type: application/json' \
  -H 'X-CODEX-TOKEN: your-shared-secret' \
  -d '{"repoPath":"/var/www/html/your-repo","prompt":"Add a README"}' \
  http://127.0.0.1:8787/run
```

## Notes

- `CODEX_TOKEN` is required. Requests without it return `401` and invalid tokens return `403`.
- Allowlist roots are enforced with realpath resolution to prevent symlink escapes.
- Default allowlist root: `/var/www/html/`.
- Customize allowlist roots with `ALLOWED_REPO_ROOTS` as a colon-separated list of absolute paths:
  - Example: `ALLOWED_REPO_ROOTS=/var/www/html:/opt/other-repos`
- Codex runs via `codex exec --full-auto "..."` from the repo directory. Edit `buildCodexArgs()` in `src/runner.js` to change invocation.
- Add extra flags with `CODEX_EXEC_ARGS` (space-separated), for example: `CODEX_EXEC_ARGS="--json --color never"`.
- Output is capped by `MAX_OUTPUT_BYTES` (default 2MB). Truncation is reported in the response.

## Environment variables

- `PORT` (default `8787`)
- `CODEX_TOKEN` (required)
- `ALLOWED_REPO_ROOTS` (default `/var/www/html/`)
- `CODEX_EXEC_ARGS` (optional, space-separated args for `codex exec`)
- `CODEX_TIMEOUT_MS` (default `600000`)
- `MAX_OUTPUT_BYTES` (default `2000000`)
- `MAX_CONCURRENCY` (default `1`)
