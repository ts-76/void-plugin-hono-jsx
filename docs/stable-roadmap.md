# Roadmap

## Released

- **0.1.0:** first normal release, including Pages, forms, islands, static output and deferred navigation.
- **0.2.0:** Markdown highlighting, code copying, containers and themes; requires additional optional peers. See [migration](markdown.md#upgrading-an-existing-markdown-project) and [release notes](https://github.com/ts-76/void-plugin-hono-jsx/releases/tag/v0.2.0).

Public artifact/consumer checks and tag promotion are complete for 0.2.0.
Direct Workers/D1 deployment, migrations and cleanup were [verified separately with RC.1](cloudflare-rc1-verification.md).

## Next priorities

| Priority | Work |
| --- | --- |
| 1 | [#58](https://github.com/ts-76/void-plugin-hono-jsx/issues/58): verify production ISR privacy, cache boundaries, purge and regeneration. |
| 2 | [#100](https://github.com/ts-76/void-plugin-hono-jsx/issues/100): measure multipart's extra GET and evaluate Void public API support for removing it. |
| 3 | [#102](https://github.com/ts-76/void-plugin-hono-jsx/issues/102): investigate SSR DOM reuse and upstream support. |
| 4 | [#101](https://github.com/ts-76/void-plugin-hono-jsx/issues/101): evaluate state-preserving HMR. |
| Deferred | [#103](https://github.com/ts-76/void-plugin-hono-jsx/issues/103): establish a need for additional SSR streaming before implementation. |

These are follow-up investigations, not promised features.
Existing behavior remains defined by the [support policy](release-contract.md) and [known limitations](known-limitations.md).

## Release approach

Group changes into release PRs; documentation-only changes can wait for the next functional release.
Repeat the [release checklist](release-checklist.md) for each candidate.
Consider 1.0 after gaining operational experience and confidence in long-term API support.
