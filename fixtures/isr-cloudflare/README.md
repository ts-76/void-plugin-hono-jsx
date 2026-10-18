# Direct Workers ISR verification fixture

Synthetic data only. Use a dedicated Worker, D1 and KV namespace in an explicitly approved account. Never overlay an existing application.

## Setup

1. Create an isolated consumer from `fixtures/consumer-void-1-vite`, including its lockfile. Install the public adapter version being checked, then copy this fixture over the consumer. Use the documented Node baseline.
2. Generate a random control key of at least 32 bytes. Keep it in a private file outside the checkout. Set `VOID_ISR_DIGEST` to its SHA-256 hex digest; only this verifier is deployed. Do not put the key in command arguments or logs.
3. Pin `CLOUDFLARE_ACCOUNT_ID`, a new `VOID_ISR_WORKER` name and `VOID_ISR_REVISION=first`. Inventory existing Workers, D1 and KV resources before creation.
4. Run `void prepare`, local `void db push`, `tsc --noEmit`, build and preview. Repeat the schema step if the local binding identity changes.
5. Set `VOID_ISR_REMOTE=1` and run `void deploy --platform cloudflare`. Void provisions bindings and applies the migration. Inspect the generated configuration; never upload the local placeholder KV ID.
6. From the repository, run the checker against the verified HTTPS origin. The checker requires the fixture identity, rejects unauthorized controls and limits its HTTP request count:

```sh
node scripts/check-isr-cloudflare.mjs ORIGIN KEY_FILE REPORT_FILE first matrix
```

7. With the first deployment's `/redeploy` cache primed, deploy the same fixture with `VOID_ISR_REVISION=second`. Run the checker with `second redeploy`. Compare resource identities and both build cache-scope IDs privately.

The default `matrix` checks TTL, failure recovery, HTML/JSON, synthetic auth, privacy, queries, purge, concurrency and browser behavior. Diagnostic phases `purge`, `purge-all` and `concurrency` can isolate a failed section. They also perform fixture/control and browser checks. A repeated phase uses mutable state; retain each report and inspect pre-existing cache state. A failure is not evidence that every later phase ran.

Purge failures are recorded, remaining independent scenarios run, and the process still exits nonzero. Both query variants are observed concurrently within one 25-second window from purge completion, below the 60-second query TTL. Reports retain request/purge timestamps and each variant's last state even on failure. This is a test bound, not a service guarantee. The checker does not retry the purge or silently wait for natural TTL expiry.

Loopback skips negative POST controls because of the known Miniflare reused-connection issue (#62); the report lists this skip. HTTPS verifies them with normal pooling. The runner does not implement a transport workaround.

The API requires the random bearer key, limits bodies to 2 KiB and accepts only known synthetic paths/fields. Public status exposes fixture identity and revision. State and actual render records live in D1; the fixture uses the public `void/isr` API without replacing Void's caches. The fixture is an operational test, not a deployment example or a CI cloud-provisioning job.

## Cleanup

Always stop tail/preview processes and delete only the Worker, D1 and KV identities recorded during creation, including after a failed check. Paginate fresh inventories and compare with the baseline; check the public URL no longer serves the application. Keep keys, account/resource IDs, generated configs/locks, browser data and raw reports/logs outside Git. Commit only sanitized observations. No paid-plan change is needed for this fixture.
