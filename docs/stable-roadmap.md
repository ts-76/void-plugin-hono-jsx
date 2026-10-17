# Roadmap to the first normal release

Updated 2026-10-17 after the maintainer approved Issue #85. The normative scope is the [release contract](release-contract.md); the original [alpha.4 source review](source-review-alpha4.md) remains a dated investigation record.

## Completed source work

FormData transport (#88), Void 1.1 fixtures (#86), Markdown snapshots (#87), shared graph analysis (#89), one common CI candidate (#90) and batched safe archive inspection (#91) are integrated in release/stable-preparation. Head/root investigation (#84) did not justify another implementation change. Measurements and limits are in [performance.md](performance.md).

## Remaining gates

1. Align root/peer/runtime/Node support and required consumers with Void 1.1; retain historical fixtures as comparison records. Document multipart and rendering limits, private reporting and support windows.
2. Refresh exact root, consumer and publisher audits for the RC. Reassess existing findings without overrides. New or changed unreviewed findings block upload. Keep the repository stage gate false during preparation.
3. Review the final integration head in #92, merge once to main and let Release Please prepare 0.1.0-rc.0. Version changes are grouped in the release PR, not hand-edited across source manifests.
4. Verify the RC release PR/tag, protected-environment stage and owner approval. Verify public bytes/provenance/signatures and a registry-installed clean consumer.
5. Complete #57 using the dedicated tsapp Worker/D1 and synthetic data, then delete the verification resources. Complete #61 before presenting the original consumer as an installation example.
6. Prepare the normal 0.1.0 release PR. Repeat exact-head CI/audits, stage and owner approval. Verify the public artifact before moving latest and aligning next.

Production ISR (#58) remains outside the initial guarantee. Fixes target the latest normal release series; 0.1.x patches preserve public APIs and breaking changes move to 0.2.0 or later. Choose 1.0 only after operational use and API maintenance experience. Private reporting is enabled; see [SECURITY.md](../SECURITY.md).

No local test, CI run, dry run, stage receipt or historical alpha publication alone completes the following gate. Record each result at its exact source/version/run. The npm upstream is [voidzero-dev/void](https://github.com/voidzero-dev/void); the similarly named Void-Framework/Void Kotlin project is unrelated.
