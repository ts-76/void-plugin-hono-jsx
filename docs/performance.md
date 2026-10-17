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

Shared TSX component/layout analysis remains separate work in Issue #81. No request-time performance or production Workers behavior is inferred from these measurements.
