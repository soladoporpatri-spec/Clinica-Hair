# Repository Guidelines

## Project Structure & Module Organization

Three runtimes:

- `WhatsAppBot.Worker/`: .NET 8 backend, bot state machine, APIs, EF Core, JWT, Serilog, health checks, and hosted worker.
- `api-nythar.js`, `dashboard-improved.html`, `script-dashboard.js`, `style-dashboard.css`, `superadmin/`: Node/Express proxy and UI.
- `WhatsAppBridge/`: WhatsApp Web bridge; production uses `bridge-factory.js`, factory port `2999`, and store ports `3000 + storeId`.

Tests are in `WhatsAppBot.Tests/` and `tests/*.test.js`; deploy assets in `deploy/`; docs in `docs/`. Treat `release/`, `runtime/`, `publish/`, `output/`, `logs/`, `backups/`, `data/`, and `.wwebjs_auth*` as generated state unless explicitly targeted.

## Build, Test, and Development Commands

- `npm install`: install dashboard/proxy dependencies.
- `npm test`: run `node --test tests/*.test.js`.
- `npm run supervise`: run the local supervisor.
- `cd WhatsAppBridge && npm install`: install bridge dependencies.
- `dotnet build WhatsAppBot.Worker/WhatsAppBot.Worker.csproj -c Release`: compile backend.
- `dotnet test WhatsAppBot.Tests/WhatsAppBot.Tests.csproj -c Release`: run xUnit.
- `dotnet publish WhatsAppBot.Worker/WhatsAppBot.Worker.csproj -c Release -r linux-arm64 --self-contained false`: validate ARM64 output.
- `npm audit --omit=dev`: audit Node dependencies in root and `WhatsAppBridge/`.

## Architecture Rules

Preserve tenant isolation. `TenantId == 0` is superadmin/system scope; store requests must use `TenantService`, EF filters, and `X-Store-Id`. Do not silently alter public API payloads, auth/JWT/API-key behavior, database schema, migrations, PIX/payment semantics, webhook contracts, or bridge ports. Schema changes require migration/startup compatibility and tests.

## Coding Style & Naming Conventions

Use 4 spaces. C# uses PascalCase for types/methods, camelCase for locals/parameters, and `Async` suffix for async methods. JavaScript uses camelCase. Keep endpoints under `WhatsAppBot.Worker/Endpoints/*`.

## Testing Guidelines

Add focused xUnit tests for backend services and Node tests for proxy/dashboard/deploy invariants. After behavior changes, run relevant tests; for cross-runtime work, run both `npm test` and `dotnet test`. For deploy/security/dependency work, include `npm audit --omit=dev` and ARM64 publish when applicable.

## Commit & Pull Request Guidelines

Recent history uses Conventional Commits such as `feat:`, `fix:`, and `refactor(ui):`. PRs should include summary, validation results, UI screenshots, and notes for `.env`, Nginx, systemd, database, auth, or WhatsApp impact.

## Agent-Specific Instructions

- Never introduce a hardcoded StoreId or tenant identifier.
- All customer data access must be scoped to the authenticated store.
- Do not change public API contracts without explicit authorization.
- Do not create database migrations unless the task explicitly requires one.
- Never expose credentials, tokens, sessions, SQLite databases, backups, or `.env` files.
- Investigate the existing flow before implementing a change.
- Keep backend refactoring separate from visual redesigns.
- Run `dotnet build` and relevant tests after code changes.
- Review the final diff for unrelated changes and tenant-isolation regressions.
- Report changed files, commands executed, test results, and remaining risks.

## Security & Configuration Tips

Never commit credentials, PIX keys, JWT secrets, API keys, database files, backups, logs, or WhatsApp sessions. Production config belongs in `.env` based on `deploy/.env.example`.
