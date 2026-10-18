# RC.1 Cloudflare verification and cleanup

Verified on 2026-10-18 for Issue #57. This is a dated observation of a dedicated synthetic-data environment, not a guarantee for every deployment target. The maintainer inspected the deployed application before approving cleanup.

## Source and execution boundary

| Item | Observed value |
| --- | --- |
| Public package | `void-plugin-hono-jsx@0.1.0-rc.1` |
| Source / tag | `0506c47d9e79d4b9b7bcc96229f15a2e302de5a0` / `v0.1.0-rc.1` |
| Public tgz SHA256 | `49140f59244b40108427f02f230534b369608d9598729c8f8b8833b44fc45640` |
| Installed contents | All 115 files matched the independently verified public tgz |
| Runtime / frameworks | Node 24.21.0, Void 1.1.11, Hono 4.13.13, plain Vite 8.3.4 |
| Deployment path | `void deploy --platform cloudflare`, with the approved account and dedicated name pinned |
| Resources | One dedicated Worker and one dedicated D1 in the approved tsapp account |
| Limits | CPU limit 10 ms; request bodies limited to 4 KiB; ISR disabled |

The fixture was copied to an isolated directory, installed from the public registry and checked locally before deployment. Account/resource IDs, credentials, the expired verification URL, request headers/IPs and raw logs are intentionally excluded from this record. The live resource map and raw evidence were kept separately for identity checks during cleanup.

No AI, R2, KV, Queues, Durable Objects, Workflows or email resources were created. No additional paid plan was purchased. Public package signatures/provenance were verified separately before this deployment; a successful deploy does not replace that verification.

## Actual Worker results

Both the initial deployment and the subsequent deployment passed HTTPS and Chrome checks for:

- SSR, direct access/reload, client assets and browser mounting.
- Pages navigation, head updates and layout state retention.
- JSON validation, D1 writes/read-back and retained data after reload.
- Multipart repeated fields/file contents and the single successful follow-up GET.
- Island interaction and trusted Markdown rendering without client scripts.
- Body/origin rejection followed by healthy requests through the normal HTTPS fetch pool.

Six direct paths were checked: `/`, `/other`, `/island`, `/markdown`, `/api/status` and `/check.txt`. Browser page errors were zero. The Worker tail captured 76 events covering both deployed versions: every outcome was `ok` and no event contained an exception. This observation is limited to the requests captured during verification.

## Migrations and redeployment

The first deployment applied the fixture's `rc_notes` table migration. The isolated schema was then extended with an integer `schema_version` column. Void/Drizzle generated the following second migration, which was reviewed before redeployment:

```sql
ALTER TABLE `rc_notes` ADD `schema_version` integer DEFAULT 2 NOT NULL;
```

The second deployment changed `RC_REVISION` from `first` to `second`, applied the additional migration, passed readiness and switched the new Worker version to 100% traffic. The D1 identifier stayed the same. Previously saved row IDs, values, transports and details survived, and the new column was backfilled to 2. Remote migration history, `PRAGMA table_info(rc_notes)` and row counts independently confirmed both migrations and the backfill. This extra column was an isolated migration experiment; it is not added to the baseline fixture schema or the published adapter API.

## Transport and dependency limitations

Each deployment passed three explicit cycles of oversized POST (413), foreign-origin POST (403) and subsequent GET (200). After redeployment, an undefined named action (404) was also followed by a successful GET. No `Connection: close` header or retry workaround was used for HTTPS. The fetch pool was not forced to a single TCP socket, so this does not establish a single-socket guarantee or fix the local Miniflare/Vite transport issue tracked in Issue #62.

The fresh fixture audit reported six propagated Moderate package entries from the same known esbuild advisory, GHSA-67mh-4wv8-2f99, with High/Critical zero. The release-stage reports had five entries; propagated entry counts are not distinct advisory counts. No advisory acceptance or override was added. The audit remains nonzero; see [the RC assessment](rc-security-assessment.md).

Void 1.1.11 moved existing Cloudflare OAuth storage to the OS keyring during authentication. A wrapper configured to read plaintext credentials stopped before resource creation. Reading the existing keyring credentials allowed deployment to continue; ordinary Cloudflare CLI and Wrangler authentication were rechecked successfully. No new login or token was issued. Future runs should account for the upstream credential-storage behavior rather than assume the old plaintext path remains available.

## Cleanup

After the maintainer confirmed the application, live resource identities were compared with the creation records. Wrangler deleted only the dedicated Worker and D1. Fresh paginated account listings confirmed both absent, and the existing Worker/D1 identifier sets matched the pre-creation inventory. The verification URL returned HTTP 404 and no application content. Local servers and the Worker tail were stopped.

Production ISR, cache privacy/propagation/purge/concurrent regeneration and the managed Void platform remain outside this verification. Issue #58 remains open. This result completes the actual Workers/D1 exercise; normal-release documentation, final candidate CI/audits and publication/tag promotion remain separate gates in Issues #85 and #59.
