# HTTPS deployment for temporary phone testing

**Prepared, not deployed.** Vercel for the frontend and Windows Azure App Service F1 with Azure SQL Database's free offer are proposed targets, not provisioned resources. Confirm the subscription, region, free eligibility, runtime availability, and zero-cost configuration before creating anything. Do not select a paid substitute. This setup is for temporary testing, not an SLA-backed production service.

## Required configuration

Store secrets only in the cloud application's environment/settings, never in Git, deployment archives, logs, or frontend variables. ASP.NET Core uses double underscores for nested environment keys.

| Location / key | Requirement |
| --- | --- |
| API: `ASPNETCORE_ENVIRONMENT` | `Production`; never enable Development on a public host. |
| API: `Cors__AllowedOrigins__0` | The actual trusted frontend HTTPS origin, without a trailing slash, path, query, credentials, or wildcard. Add numbered entries for other explicitly trusted origins only. Preview deployments are not automatically trusted. |
| API: `Jwt__Key` | A newly generated random secret with at least 32 UTF-8 bytes. The public development key, missing keys, and short keys prevent startup outside Development. Issuance and validation share the startup key; rotate it with an application restart, invalidating existing tokens. |
| API: `ConnectionStrings__DefaultConnection` | The actual Azure SQL / SQL Server connection string, supplied securely. Require encryption and certificate validation. LocalDB is not a cloud database; PostgreSQL is not supported by this application. |
| API: `Assistant__Provider` | Explicitly select `deepseek`. |
| API: `DEEPSEEK_API_KEY` | The owner's existing authorized DeepSeek credential. `Assistant__DeepSeek__ApiKey` is the supported alternative; `DEEPSEEK_API_KEY` takes precedence. Never publish either to Vercel's client bundle. |
| Frontend: `NEXT_PUBLIC_API_URL` | The actual HTTPS API **origin**, without `/api` or a trailing slash. Set it for the intended Vercel environment before building; changing it requires rebuilding. Never leave the localhost fallback in a phone deployment. |

Optional API settings: `Jwt__Issuer`, `Jwt__Audience`, `Jwt__ExpiryMinutes`, and `Assistant__DeepSeek__Model`. JWT issuer/audience default to `MetraTC`; lifetime defaults to 480 minutes. The current DeepSeek model default is `deepseek-flash`; confirm account/model capability before a live image test. DeepSeek usage is separate from hosting quotas: free hosting does not authorize billable inference or guarantee a free model.

CORS is an exact browser allowlist, not authentication. Outside Development, missing origins, HTTP origins, loopback addresses, and malformed origins fail startup. Development alone defaults to `http://localhost:3000` and retains the existing local signing key and accounts. Phone camera access requires the frontend's valid HTTPS URL and browser camera permission; the API must also use valid HTTPS to avoid mixed content.

## Build and package the API

From the repository root, using the .NET 10 SDK:

```powershell
dotnet restore backend/backend.sln
dotnet build backend/backend.sln -c Release --no-restore -p:UseAppHost=false
dotnet run --project backend/MetraTC.Application.Checks/MetraTC.Application.Checks.csproj -c Release --no-restore -p:UseAppHost=false
dotnet publish backend/MetraTC.csproj -c Release --no-build --no-restore --self-contained false -p:UseAppHost=false
```

The publish directory is `backend/bin/Release/net10.0/publish/`. ZIP the **contents**, with `MetraTC.dll`, its dependency files, generated `web.config`, and `wwwroot` at archive root, not the repository or an enclosing directory. Do not include User Secrets, `.env` files, local databases, or browser captures. The archive currently includes versioned product images; review these before sharing it.

On Windows App Service, IIS/ASP.NET Core Module starts the framework-dependent application through the generated `web.config` (`dotnet .\MetraTC.dll`), not a Linux startup script. Confirm that the target has the .NET 10 ASP.NET Core runtime/hosting support for **32-bit** F1 before deployment; local build success does not establish cloud runtime availability. Use the provider-issued HTTPS hostname and enable HTTPS-only access. Do not enable a conflicting platform CORS policy.

### Writable uploads are required

Use **extracted ZIP deployment**, with `WEBSITE_RUN_FROM_PACKAGE` absent and `SCM_DO_BUILD_DURING_DEPLOYMENT` absent or disabled for this compiled archive. Run-from-package mounts `wwwroot` read-only and breaks uploads. The existing controllers write under the application web root at `wwwroot/images/products/` and `wwwroot/images/promotions/`, and return `/images/...` URLs served by static-file middleware. The published `wwwroot` must exist when the host starts.

On Windows App Service, extracted application content under `%HOME%\site\wwwroot` is persisted across worker restarts; the application's own `wwwroot/images/...` sits beneath it. Keep that content location rather than temporary local storage. File uploads are limited to 5 MiB and JPG/JPEG/PNG/WebP. Temporary product uploads are not automatically cleaned up, and images are publicly readable by URL. No Blob service is required for this single-instance test.

Persistence across restarts is **not** a backup or a redeployment guarantee. Back up both image directories before every deployment, avoid clean/delete deployment modes, and do not overwrite uploaded images with old versioned images from the archive. Restore preserved uploads when needed. App deletion, file cleanup, and storage quota exhaustion can lose or block uploads. Verify upload + download + restart persistence on the actual cloud host before declaring testing ready.

## Database and account bootstrap: deployment gate

The repository contains **14 tracked EF Core migrations**, compiled into `MetraTC.Infrastructure.dll`. Startup does **not** apply them. Have an authorized operator review and apply the migration chain to the intended SQL database; do not run migrations against local data or migrate implicitly at API startup. Configure the SQL firewall/network access for the approved application and migration operator, not unrestricted public access.

The business/user migration seeds an active business and three active accounts: `superadmin`, `admin`, and `cajero`. Their initial credentials are publicly documented in source. **Do not expose a freshly migrated database until those credentials are securely replaced or the seeded accounts are disabled and a private administrative account exists.** The current user update endpoint does not change passwords, so credential rotation/bootstrap needs an explicit authorized database/account procedure; this guide does not execute it or print passwords.

SuperAdmin is global; Admin/User login requires an assigned active business. An authorized SuperAdmin can create businesses and users through the existing management endpoints. Businesses currently use active status and module feature flags; there is no implemented subscription/license-expiry enforcement. Do not treat feature flags as billing or licensing.

## Free-tier limits and readiness

- Windows F1: shared compute, 32-bit, 60 CPU minutes/day, 3 CPU minutes per five-minute window, and 1 GB storage shared by the plan's apps. No Always On, custom-domain TLS, or SLA; cold starts and quota-related outages are expected. The default `azurewebsites.net` hostname has HTTPS. Logs and uploads consume the storage budget.
- Azure SQL free offer: 100,000 vCore-seconds/month, 32 GB data and 32 GB backup storage per database. Require **Auto-pause the database until next month** when the free limit is reached. Never select **Continue using database for additional charges**. Idle auto-pause/resume and quota exhaustion can interrupt testing.
- Verify the selected Vercel account/plan permits the intended use without charges; no frontend entitlement is inferred here.

Before sharing the phone URL: confirm secure credentials, reviewed migrations, exact CORS preflight, login and authenticated calls, image upload/download and persistence, camera permission, and explicitly authorized provider/model behavior. Offline checks do not prove SQL connectivity, cloud configuration, or a live DeepSeek image response.

The known OpenAPI parser denial-of-service advisory is [CVE-2026-49451 / GHSA-v5pm-xwqc-g5wc](https://github.com/advisories/GHSA-v5pm-xwqc-g5wc). `Microsoft.OpenApi` is pinned to the first patched 2.x release, **2.7.5**. This API generates documents and enables Swagger only in Development; no endpoint accepting untrusted OpenAPI documents was found. Keep dependency auditing enabled regardless.

References: [App Service limits](https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/azure-subscription-service-limits#azure-app-service-limits), [Azure SQL free offer](https://learn.microsoft.com/en-us/azure/azure-sql/database/free-offer), [ZIP deployment](https://learn.microsoft.com/en-us/azure/app-service/deploy-zip), [run-from-package constraints](https://learn.microsoft.com/en-us/azure/app-service/deploy-run-package).
