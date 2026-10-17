# Build analysis measurements

Measured on 2026-10-17 with Node 24.21.0, macOS arm64. The comparison uses alpha.4 source `791c5a92` and the Markdown snapshot change for Issue #80. These are synthetic filesystem call counts, not production latency or CI cost estimates.

Each page contains an authored client script. Counting starts after Markdown configuration and covers the real islands plugin's `buildStart()` call. Other plugin hooks and renderer generation are outside this measurement.

| Markdown pages | Previous synchronous Markdown reads | Snapshot reads | Previous directory walks | Snapshot walks |
| ---: | ---: | ---: | ---: | ---: |
| 10 | 120 | 20 | 10 | 1 |
| 50 | 2,600 | 100 | 50 | 1 |
| 100 | 10,200 | 200 | 100 | 1 |

Script-list and graph-source getters perform no additional Markdown reads. The snapshot scan and upstream discovery still read source files. A separate 100-page regression includes renderer generation and observes 300 reads: one snapshot pass and two upstream discovery/render passes. Configuration, build and hot-update hooks can each refresh the snapshot; the counts above do not claim one filesystem pass for an entire build.

Snapshots are local to each plugin instance and replaced only after a complete successful extraction. Graph analysis refreshes before reading the snapshot, so its result does not depend on whether the Markdown hot-update hook runs first. Tests cover script and route addition/removal, extraction failure/recovery, project separation and symlink island identities. Packed-browser checks cover development edits, preview and static output.

## Shared component analysis

Issue #81 shares canonical source, primary syntax and import-edge results within each graph analysis. The same 10/50/100-page fixture imports a shared component from every page and the root layout.

| Pages | Previous shared-component reads | Current reads | Previous root-layout reads | Current reads |
| ---: | ---: | ---: | ---: | ---: |
| 10 | 20 | 1 | 10 | 1 |
| 50 | 100 | 1 | 50 | 1 |
| 100 | 200 | 1 | 100 | 1 |

Every analysis uses a fresh cache. Interactive validation shares its visited set while retaining the distinct static/interactive rules. Resolved dependencies and unresolved import candidates trigger updates; unrelated/generated files do not trigger a graph reload. Failed dependencies remain observable until a successful rebuild prunes the watch set. Tests include edits, creation/deletion, re-exports/index resolution, symlink paths and recovery from parsing/boundary failures.

The fixed-point propagation algorithm is unchanged; there is no evidence that replacing it is currently necessary. No request-time performance or production Workers behavior is inferred from these measurements.

## Common CI preparation

The package workflow previously scheduled a full release preparation for every framework stack. The original shared-candidate change was verified in seven historical stacks; the approved RC support policy now selects two current stacks. It now prepares one baseline-accepted candidate, then verifies the exact same bytes in the other supported locked consumer. Common source/build/pack/dry-run work runs once; dependency audits remain separate for both supported consumers. Normal feature PRs use one package-workflow run. Main/release pushes and bot/manual dispatches retain their execution paths.

This adds a baseline dependency before the six-way fan-out, so total wall time may differ from CPU work. No measured time or cost saving is claimed. Stage preparation is unchanged: it creates and validates its own same-run/attempt artifact and performs its existing fresh checks before OIDC/provenance submission.

## Archive inspection

The original 106-file alpha.4 artifact and its archived source commit were checked with the new gate on Node 24.21.0/macOS. Native tar invocations fell from 129 to 3 for one complete inspection and from 387 to 9 for three consecutive stage-style inspections. The accepted archive contains 414,076 unpacked bytes. This measurement does not submit a new npm stage or measure publisher-internal archive handling.

Each inspection captures compressed bytes once, obtains matching path/type/size listings and reads all validated regular-file contents in one stdout stream. The content map is reused for metadata, source/maps, notices, release notes and license comparisons. The installed-consumer check also reuses this map instead of extracting each file again.

Path traversal, absolute/ambiguous names, links/devices, duplicates, hidden concatenated archives and unexpected files are rejected before content extraction. Inspection permits at most 1 MiB per file and 8 MiB of total content. BSD and GNU tar listings are recognized under the C locale; unknown formats fail closed. Extraction writes only to stdout, never to the filesystem. Source/map and lifecycle/dependency checks remain in place.

The file digest is rechecked when an inspection completes, every later inspection reads the file again, and the publisher still verifies bytes immediately before submission. Snapshot reuse is limited to one inspection; it does not cache acceptance across public-release boundaries.
