# Dedicated Cloudflare RC verification

This is a temporary synthetic-data fixture, not a production application template. It exposes no ISR control API, enables no AI/R2/KV/email resources and caps request bodies at 4 KiB. It uses D1 with generated migrations. Do not submit real data.

After the RC is public, install exact dependencies with npm install, run typecheck, generate/review migrations, migrate locally and verify dev/build/preview first. Run from an isolated copy, set CLOUDFLARE_ACCOUNT_ID, VOID_RC_WORKER and VOID_RC_REVISION, then use void deploy --platform cloudflare only for the separately approved account/resources. No account IDs or credentials belong in this fixture. Save the generated void.lock.json in the isolated verification directory until cleanup; do not use a project-delete command as proof that Cloudflare resources were deleted.

Verify the public registry artifact before deploying. Test SSR/assets/API, JSON validation/write, multipart fields/files, navigation/layout/head, islands, Markdown, then redeploy a second RC_REVISION and confirm D1 data survives. Record source/version/integrity/deployment/migrations and delete only the dedicated Worker/D1 after verification. Production ISR and the managed Void platform are outside this check.

From the repository root, run the dedicated checker against the approved temporary URL:

```sh
PLAYWRIGHT_CHANNEL=chrome node scripts/check-cloudflare-consumer.mjs https://<dedicated-worker>.workers.dev first
```

The checker confirms the fixture identity before writing synthetic records. Use revision `second` after redeployment and separately compare `/api/status` with the synthetic values recorded by the first run. It does not provision or delete resources. HTTPS checks use ordinary connection pooling; local HTTP rejection checks use independent connections because the local Miniflare/Vite early-rejection transport issue is still unresolved. See [the RC assessment](../../docs/rc-security-assessment.md).

The [RC.1 verification record](../../docs/cloudflare-rc1-verification.md) documents the completed actual Workers/D1 exercise and cleanup. This fixture pins that public RC; the second migration was an isolated experiment, not a change to its baseline schema.
