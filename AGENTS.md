# Repository guidance

## Layout
- Two independent apps: `frontend/` (Next.js) + `backend/` (ASP.NET Core API). No root `package.json`/workspaces, Docker, or CI workflows — run commands from the owning subfolder.

## Frontend — `frontend/` (Next.js 16.2.6 / React 19.2.4 / Tailwind 4)
- Entrypoints `app/layout.tsx` + `app/page.tsx` (still `create-next-app` placeholder). Path alias `@/*` → `./*`.
- From `frontend/`: `npm install`, `npm run dev` → `http://localhost:3000`, `npm run build`, `npm run start`, `npm run lint` (ESLint 9 flat config via `eslint-config-next`), `npx tsc --noEmit` (no test script).
- Tailwind 4 is `@import "tailwindcss"` via `@tailwindcss/postcss` in `postcss.config.mjs` — no `tailwind.config.*`. ESLint ignores `.next/**, out/**, build/**`.
- Before changing Next.js code, read the installed guide at `frontend/node_modules/next/dist/docs/` — 16.x has breaking changes from older Next.

## Backend — `backend/` (.NET `net10.0`, Clean Architecture)
- Entrypoint `backend/Program.cs`, solution `backend/backend.sln`. Projects: `MetraTC` (host, `Sdk.Web`), `MetraTC.Domain` (pure, no package refs), `MetraTC.Infrastructure` (EF SqlServer), `MetraTC.Application` (AutoMapper, FluentValidation, EF).
- Intended direction `Domain → Application → Infrastructure → backend`; keep `Domain` independent. Current `MetraTC.Application.csproj` references `MetraTC.Infrastructure` — do not extend this inversion.
- SQL Server LocalDB `Server=(localdb)\mssqllocaldb;Database=MetraTC_DB;Trusted_Connection=True;TrustServerCertificate=True` (Windows-only, no Docker). EF migrations are NOT applied automatically.
- Dev URLs `http://localhost:5240` and `https://localhost:7003` (`Properties/launchSettings.json`, `launchUrl: swagger`); Swagger at `/swagger` only in Development; HTTPS needs `dotnet dev-certs https --trust`; CORS allows only `http://localhost:3000`.
- Current controllers (verify before assuming `docs/` design): `Products` → `GET/POST /api/Products`, `GET/PUT/DELETE /api/Products/{id}`, `POST /api/Products/{id}/stock-adjustments`; `Sales` → `GET/POST /api/Sales`, `GET /api/Sales/{id}`; `Reports` → `GET /api/reports/low-stock`, `/api/reports/sales`, `/api/reports/stock-audits`. No auth yet (`UseAuthorization` without `AddAuthentication`).
- Commands: `dotnet build backend/backend.sln`, `dotnet run --project backend/MetraTC.csproj`. EF (requires `dotnet-ef`): `dotnet ef migrations add <Name> --project MetraTC.Infrastructure --startup-project backend` and `dotnet ef database update --project MetraTC.Infrastructure --startup-project backend`.
- PowerShell 5.1 has no `Invoke-RestMethod -SkipCertificateCheck` — use `curl.exe -k --data-binary @file` for HTTPS bypass in dev.

## Conventions & gotchas
- Executable is truth over prose: `Program.cs`/`appsettings.json`/controllers beat `docs/AI_PROJECT_GUIDE.md` + `docs/SYSTEM_ANALYSIS.md` (those describe a MySQL/MercadoPago/SignalR/CashSessions plan not yet implemented).
- Generated — never edit manually, regenerate with tooling: `MetraTC.Infrastructure/Migrations/*` + `ApplicationDbContextModelSnapshot.cs`, plus `bin/`, `obj/`, `frontend/.next/`, `node_modules/`, `.vs/` — all covered by `.gitignore` (Toptal `visualstudio,node,dotnetcore` template); do not commit.
- No test projects yet (frontend has no test script; backend has no `*.Tests.csproj`).
- Work on `developmentFranco` for backend; `frontend/AGENTS.md` + `frontend/CLAUDE.md` remain in force under `frontend/`.
