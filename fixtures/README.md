# Consumer fixture roles

Current release preparation uses two package manifests/locks: `consumer-void-1-vite` (baseline, Void 1.1.11 / plain Vite 8.3.4) and `consumer-void-1-vp` (Void 1.1.11 / aligned Vite Plus 1.3.0). Both overlay the shared source in `consumer/`. Both remain required for the exact same candidate bytes.

The package metadata in `consumer/`, `consumer-vite-8.3.4`, `consumer-latest-vite`, `consumer-scaffold-vp` and `consumer-latest-vp` records historical Void 0.x comparisons. It remains intact for investigation; current `RELEASE_CONSUMER_STACK` cannot select it. To compare an old release, use its archived source and these locks in isolation. The upcoming RC rejects Void 0.26/0.27 at startup.

`static/` and `isr/` supply synthetic checks, not production deployments. The local ISR test-control API and placeholder resources must not be deployed. See [testing](../docs/testing.md) and the [approved contract](../docs/release-contract.md).
