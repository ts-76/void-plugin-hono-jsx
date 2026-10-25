# Changelog

## [0.9.0](https://github.com/ts-76/void-plugin-hono-jsx/compare/v0.8.0...v0.9.0) (2026-10-25)


### ⚠ BREAKING CHANGES

* unify portable article rendering and streamline CI ([#156](https://github.com/ts-76/void-plugin-hono-jsx/issues/156))

### Markdown dependency and release conditions

* Fix concurrent development SSR during page/loader edits by keeping server HMR dispatch under Vite. Browser edits still reload the document. Expand the packed consumer regression to twelve concurrent-update revisions.
* Require @ts-76/hono-markdown ^0.2.0: article rendering now uses one portable /render entry. Remove /render/worker imports and Node-only highlight/shiki article options; use renderCodeBlock for custom highlighting. Trusted compiler and adapter APIs retain Shiki support.
* Record owner acceptance of the existing Void/Cloudflare undici and Zod risks for 0.9.0 only, with trusted configuration, private dev/preview, bounded input and exact dependency/advisory checks. These dependencies remain unfixed and consumer audits are nonzero.

### Refactoring

* unify portable article rendering and streamline CI ([#156](https://github.com/ts-76/void-plugin-hono-jsx/issues/156)) ([515fc86](https://github.com/ts-76/void-plugin-hono-jsx/commit/515fc862f1438bd62f3236a0e244a1977ad6a339))

## [0.8.0](https://github.com/ts-76/void-plugin-hono-jsx/compare/v0.7.0...v0.8.0) (2026-10-24)


### ⚠ BREAKING CHANGES

* **markdown:** Markdown island tags now reject renderer-owned props (`children`, `key`, `ref`, `dangerouslySetInnerHTML`), known HTML event-handler attributes regardless of case, and JSX-style `on` + uppercase names such as `onClick`. Rename data props or pass event callbacks from a TSX wrapper component.

### Features

* **markdown:** limit island frontmatter with clientFrontmatter ([#153](https://github.com/ts-76/void-plugin-hono-jsx/issues/153)) ([e3a3baf](https://github.com/ts-76/void-plugin-hono-jsx/commit/e3a3baf61dd60f3d8f4c4aedbdbf8b5c1a2a6061))


### Bug Fixes

* **markdown:** bound fence line highlighting ranges ([#146](https://github.com/ts-76/void-plugin-hono-jsx/issues/146)) ([1da6db9](https://github.com/ts-76/void-plugin-hono-jsx/commit/1da6db984dd9a216fa6e22412090e0f64cb05115)), closes [#139](https://github.com/ts-76/void-plugin-hono-jsx/issues/139)
* **markdown:** ignore a leading BOM and keep combining marks in slugs ([#148](https://github.com/ts-76/void-plugin-hono-jsx/issues/148)) ([bead231](https://github.com/ts-76/void-plugin-hono-jsx/commit/bead2315bf3e66589054cc1f2c16ca127ff89d15)), closes [#143](https://github.com/ts-76/void-plugin-hono-jsx/issues/143)
* **markdown:** reject renderer props and event handlers in island attributes ([#152](https://github.com/ts-76/void-plugin-hono-jsx/issues/152)) ([b3b6b03](https://github.com/ts-76/void-plugin-hono-jsx/commit/b3b6b03d68c6b935ef7308e90582746affd26b10)), closes [#141](https://github.com/ts-76/void-plugin-hono-jsx/issues/141)
* **markdown:** report island load failures and allow cancelling hydration ([#149](https://github.com/ts-76/void-plugin-hono-jsx/issues/149)) ([a628192](https://github.com/ts-76/void-plugin-hono-jsx/commit/a628192713ffba721f5c238171970405ceb53548)), closes [#144](https://github.com/ts-76/void-plugin-hono-jsx/issues/144)
* **markdown:** require common runtime with island security fixes ([#154](https://github.com/ts-76/void-plugin-hono-jsx/issues/154)) ([2ca8afc](https://github.com/ts-76/void-plugin-hono-jsx/commit/2ca8afc94d146f9dfff1963c3293f33103305c65))
* **markdown:** support request-time article rendering in Workers ([#138](https://github.com/ts-76/void-plugin-hono-jsx/issues/138)) ([9ee9f98](https://github.com/ts-76/void-plugin-hono-jsx/commit/9ee9f982aa5650528fb1dd6a1a206223ca7ff1c1))


### Performance Improvements

* **markdown:** reuse module compilers per options object ([#147](https://github.com/ts-76/void-plugin-hono-jsx/issues/147)) ([f643d8b](https://github.com/ts-76/void-plugin-hono-jsx/commit/f643d8b607a04a822304dc5925eb3c45281d71c3)), closes [#140](https://github.com/ts-76/void-plugin-hono-jsx/issues/140)

### Dependency risk acceptance

The owner explicitly accepts the remaining Void/Cloudflare undici and Zod tooling risks for **0.8.0 only**, under the pinned Node/Void/lockfile and usage conditions in [dependency-security.md](https://github.com/ts-76/void-plugin-hono-jsx/blob/v0.8.0/docs/dependency-security.md). A malformed remote response can terminate Node development/CLI tooling; oversized invalid input can increase validation memory. Keep dev/preview private and use trusted, bounded configuration. The consumer audit remains nonzero. This does not relax fresh audits, exact-artifact checks or final owner approval, and does not cover later releases.

## [0.7.0](https://github.com/ts-76/void-plugin-hono-jsx/compare/v0.6.0...v0.7.0) (2026-10-24)


### ⚠ BREAKING CHANGES

* Node.js >=24.22.1 <25.0.0 is required; update the local Node selector together with the adapter.
* upgrade Void together with the adapter; the minimum supported version is now 1.2.1.

### Features

* **markdown:** release common article API in 0.1.1 ([#134](https://github.com/ts-76/void-plugin-hono-jsx/issues/134)) ([f5dcadf](https://github.com/ts-76/void-plugin-hono-jsx/commit/f5dcadf5856374caba81c145e0e457817276970b))
* support Void 1.2.1 navigation contracts ([#131](https://github.com/ts-76/void-plugin-hono-jsx/issues/131)) ([c17aa72](https://github.com/ts-76/void-plugin-hono-jsx/commit/c17aa72eab6cedf5caa797abed2f2eb66610d1c3))


### Bug Fixes

* **release:** record the owner's 0.7.0-only consumer dependency risk acceptance with version, lock and advisory-content gates. The undici/Zod findings remain nonzero and include a reachable toolchain availability failure; see the dependency security guide.

* align remaining Node baselines and consolidate 0.7.0 assessment ([#135](https://github.com/ts-76/void-plugin-hono-jsx/issues/135)) ([d8ca3b7](https://github.com/ts-76/void-plugin-hono-jsx/commit/d8ca3b7633408f3a7aab44a4155e0e14b20c867c))
* **markdown:** honor shared copy requirements in Void adapter ([#132](https://github.com/ts-76/void-plugin-hono-jsx/issues/132)) ([18bab90](https://github.com/ts-76/void-plugin-hono-jsx/commit/18bab90782cd3441f6a5cec359632636f13903c4))
* **release:** reconstruct npm publisher with fixed locked dependencies ([#136](https://github.com/ts-76/void-plugin-hono-jsx/issues/136)) ([b932119](https://github.com/ts-76/void-plugin-hono-jsx/commit/b9321197a56c963ac8b06208bd83de80ec25ca82))

## [0.6.0](https://github.com/ts-76/void-plugin-hono-jsx/compare/v0.5.0...v0.6.0) (2026-10-21)


### ⚠ BREAKING CHANGES

* **markdown:** keep island readiness host-owned ([#128](https://github.com/ts-76/void-plugin-hono-jsx/issues/128))

### Release Automation

* validate scoped pnpm 11.28.6 stage publisher ([#130](https://github.com/ts-76/void-plugin-hono-jsx/issues/130)) ([f0b1d62](https://github.com/ts-76/void-plugin-hono-jsx/commit/f0b1d62562f44402885825d6915e60c0684befe7))


### Refactoring

* **markdown:** keep island readiness host-owned ([#128](https://github.com/ts-76/void-plugin-hono-jsx/issues/128)) ([6fc417c](https://github.com/ts-76/void-plugin-hono-jsx/commit/6fc417cc6e1109eedb90c6d482ab5ef5fe3cbefa))

## [0.5.0](https://github.com/ts-76/void-plugin-hono-jsx/compare/v0.4.0...v0.5.0) (2026-10-20)


### Features

* consume shared Markdown through compatible Void adapters ([020238a](https://github.com/ts-76/void-plugin-hono-jsx/commit/020238ae66cd594f7d46552c198d9c979b8193ff))
* consume shared Markdown through compatible Void entries ([8174636](https://github.com/ts-76/void-plugin-hono-jsx/commit/8174636a9d61fe51901e146a04470062372f3e64))
* extract host-independent Hono Markdown package ([7074b66](https://github.com/ts-76/void-plugin-hono-jsx/commit/7074b66219f93c1c6e1567fa3b9bfba260b96e4b))
* extract host-independent Hono Markdown package ([5cfb9eb](https://github.com/ts-76/void-plugin-hono-jsx/commit/5cfb9eb8ca751ecc42e6af1e4386c3ae0ceed8e9))


### Bug Fixes

* let host adapters select a resolvable context entry ([9bdd34d](https://github.com/ts-76/void-plugin-hono-jsx/commit/9bdd34db994d86ac259272697c9407a31f1062c9))
* resolve generated Markdown through the host adapter ([500d7eb](https://github.com/ts-76/void-plugin-hono-jsx/commit/500d7eb3a97feeafc333dddeb217b8658efcfc0b))
* retain upstream notices in common Markdown distribution ([ad72b2f](https://github.com/ts-76/void-plugin-hono-jsx/commit/ad72b2faf4d20c7cf341aed73f9cb2289d942188))

## [0.4.0](https://github.com/ts-76/void-plugin-hono-jsx/compare/v0.3.0...v0.4.0) (2026-10-20)


### Features

* **markdown:** support standalone modules and islands ([#123](https://github.com/ts-76/void-plugin-hono-jsx/issues/123)) ([6402ef9](https://github.com/ts-76/void-plugin-hono-jsx/commit/6402ef9d193c8eda984f0e38202c8b921d270c11))

## [0.3.0](https://github.com/ts-76/void-plugin-hono-jsx/compare/v0.2.0...v0.3.0) (2026-10-18)


### Features

* **markdown:** render static components with nested content ([#122](https://github.com/ts-76/void-plugin-hono-jsx/issues/122)) ([37889b1](https://github.com/ts-76/void-plugin-hono-jsx/commit/37889b1a679bfb53c364a8b6de143eca7780b769))


### Bug Fixes

* **css:** collect SSR styles and retain the document host ([#121](https://github.com/ts-76/void-plugin-hono-jsx/issues/121)) ([543f4d7](https://github.com/ts-76/void-plugin-hono-jsx/commit/543f4d7a8901f9389a1e66b0bfc884953b843635))


### Documentation

* **isr:** identify query variant purge enumeration limit ([#120](https://github.com/ts-76/void-plugin-hono-jsx/issues/120)) ([5604497](https://github.com/ts-76/void-plugin-hono-jsx/commit/5604497f537b009c0d92de0e3aa9d1ad8693a3a3))
* **isr:** record production cache verification and limits ([#119](https://github.com/ts-76/void-plugin-hono-jsx/issues/119)) ([9ed6f78](https://github.com/ts-76/void-plugin-hono-jsx/commit/9ed6f789960af597d06394bd9e703e6ff44b4098))
* simplify OSS setup and maintenance guides ([#115](https://github.com/ts-76/void-plugin-hono-jsx/issues/115)) ([4b78e15](https://github.com/ts-76/void-plugin-hono-jsx/commit/4b78e15b3e600b3bd75bd439781e4bf5bf827695))

## [0.2.0](https://github.com/ts-76/void-plugin-hono-jsx/compare/v0.1.0...v0.2.0) (2026-10-18)


### ⚠ BREAKING CHANGES

* Markdown projects must add markdown-it-container, shiki and @shikijs/transformers peers. Fenced code now includes copy controls and a page-local module by default, matching the official framework plugins. See docs/markdown.md for migration.

### Features

* align Hono Markdown code and themes with official plugins ([#114](https://github.com/ts-76/void-plugin-hono-jsx/issues/114)) ([757ec0c](https://github.com/ts-76/void-plugin-hono-jsx/commit/757ec0cf66192ad6e464585ed9428a2b7309218c))


### Bug Fixes

* align published release docs and dry-run validation ([#112](https://github.com/ts-76/void-plugin-hono-jsx/issues/112)) ([96d242c](https://github.com/ts-76/void-plugin-hono-jsx/commit/96d242c771c76c3eddbd73c040327a18acb36930))

## [0.1.0](https://github.com/ts-76/void-plugin-hono-jsx/compare/v0.1.0-rc.1...v0.1.0) (2026-10-18)


### Documentation

* prepare grouped 0.1.0 normal release ([3d1c3b8](https://github.com/ts-76/void-plugin-hono-jsx/commit/3d1c3b8a323103bcd78ed2716f4d4ecaa5dcf6dd))
* record RC.1 Workers verification and cleanup ([#109](https://github.com/ts-76/void-plugin-hono-jsx/issues/109)) ([54c0441](https://github.com/ts-76/void-plugin-hono-jsx/commit/54c0441a1d70fee55cad36a41f30f3308048e1f2))

## [0.1.0-rc.1](https://github.com/ts-76/void-plugin-hono-jsx/compare/v0.1.0-rc.0...v0.1.0-rc.1) (2026-10-17)


### Features

* add navigation fallback and Hono deferred rendering ([8475a73](https://github.com/ts-76/void-plugin-hono-jsx/commit/8475a737931df4bfb62b9d32c877eb03c76ef644))

## [0.1.0-rc.0](https://github.com/ts-76/void-plugin-hono-jsx/compare/v0.1.0-alpha.4...v0.1.0-rc.0) (2026-10-17)


### ⚠ BREAKING CHANGES

* the release candidate supports Void >=1.1.11 <1.2 and Node >=24.21.0 <25; old Void 0.x launchers are historical fixtures only.

### Features

* consolidate the Void 1.1 release candidate ([#92](https://github.com/ts-76/void-plugin-hono-jsx/issues/92)) ([2793b54](https://github.com/ts-76/void-plugin-hono-jsx/commit/2793b54937a01a890d8df858f82ae2f612e5aacf))

## [0.1.0-alpha.4](https://github.com/ts-76/void-plugin-hono-jsx/compare/v0.1.0-alpha.3...v0.1.0-alpha.4) (2026-10-17)


### ⚠ BREAKING CHANGES

* Rename voidHonoPages to voidHonoJsx and HonoPagesOptions to HonoJsxOptions. The legacy names are removed without compatibility aliases.

### Features

* **forms:** add bound forms and action helpers ([22899eb](https://github.com/ts-76/void-plugin-hono-jsx/commit/22899eb8105f626c87fc4dafd19785a9c637bf4c))
* **forms:** add bound forms and action helpers ([15f7e0d](https://github.com/ts-76/void-plugin-hono-jsx/commit/15f7e0d154ea38134a458385ac0eb65ce215f302))
* **forms:** support provider-free island actions ([b8020d8](https://github.com/ts-76/void-plugin-hono-jsx/commit/b8020d856bc2d65c8cecdc69c3ce6aa0cca46737))
* **forms:** support provider-free island actions ([7179d10](https://github.com/ts-76/void-plugin-hono-jsx/commit/7179d102455dcccb50d2bec2e48f284d3f908c29))
* **islands:** discover static component and layout graphs ([a93bf48](https://github.com/ts-76/void-plugin-hono-jsx/commit/a93bf482678908153722ad28ec117d2fca2cb62d))
* **islands:** discover static component and layout graphs ([cc5133d](https://github.com/ts-76/void-plugin-hono-jsx/commit/cc5133dd9d3273ebc02143f41fa79cb7e3dacb1d))
* **islands:** support visible idle and media policies ([3b6b296](https://github.com/ts-76/void-plugin-hono-jsx/commit/3b6b2965ddd5fefef2e16281e3d64083c1c7d42f))
* **islands:** support visible idle and media policies ([7d7d8f0](https://github.com/ts-76/void-plugin-hono-jsx/commit/7d7d8f00bc8c1d3b029af9e469005f358f866ab5))
* **markdown:** add optional Hono Markdown pages ([f27a6ab](https://github.com/ts-76/void-plugin-hono-jsx/commit/f27a6abec34afa9dd875de564454ca2bf1a840bc))
* **markdown:** add optional Hono Markdown pages ([471ed71](https://github.com/ts-76/void-plugin-hono-jsx/commit/471ed717ac31b8ac3192efed43cb34072913b049))
* **pages:** expose reactive navigation state ([b54476b](https://github.com/ts-76/void-plugin-hono-jsx/commit/b54476b6eb404530738a5d23397e453d468441d0))
* **pages:** expose reactive navigation state ([d7b1e04](https://github.com/ts-76/void-plugin-hono-jsx/commit/d7b1e041c751943e08eabeb7d5de54f1a8fb3038))
* **pages:** expose transition and prefetch options ([e3bf353](https://github.com/ts-76/void-plugin-hono-jsx/commit/e3bf353aa9ffbc7e734442af113a98503b5a0c67))
* **pages:** expose transition and prefetch options ([764c623](https://github.com/ts-76/void-plugin-hono-jsx/commit/764c623472c173bd4fb1485d32add7af07bc00d6))
* **pages:** integrate Hono Pages APIs and optional Markdown ([07d459b](https://github.com/ts-76/void-plugin-hono-jsx/commit/07d459b703bbff6cd46ea0f6a56eeea6ac9a97cc))
* **pages:** support Link navigation options and prefetch ([d32664d](https://github.com/ts-76/void-plugin-hono-jsx/commit/d32664d0f1291078aaad7b63807f98e8afb7b24c))
* **pages:** support Link navigation options and prefetch ([f2c87c0](https://github.com/ts-76/void-plugin-hono-jsx/commit/f2c87c0f2c1908b24fa064fa69630a62dd4bd025))
* rename plugin to voidHonoJsx and integrate Markdown sample ([4107cd8](https://github.com/ts-76/void-plugin-hono-jsx/commit/4107cd80ff2caac27acb67fd981634b4ac0e708a))


### Bug Fixes

* **islands:** resolve directory index imports in static graphs ([17287b3](https://github.com/ts-76/void-plugin-hono-jsx/commit/17287b30d48646246f18c44e94d99387bc9107de))
* **markdown:** canonicalize symlinked island identities ([14d0fc7](https://github.com/ts-76/void-plugin-hono-jsx/commit/14d0fc7187d3b9c19b1bb29d10736cb79b126532))
* **markdown:** diagnose the upstream compiler integration gate ([2ac08ba](https://github.com/ts-76/void-plugin-hono-jsx/commit/2ac08ba6a170292c5a3f5d414046b6a7a01774d8))
* **pages:** own native transition lifecycle over the Void engine ([aae12c3](https://github.com/ts-76/void-plugin-hono-jsx/commit/aae12c3c1e54782db42f7e2839867e055c5dd1bf))
* **pages:** preserve navigation guards and recover failed renders ([c2ac900](https://github.com/ts-76/void-plugin-hono-jsx/commit/c2ac900d6bccfb53ad505624d12f976caad37e2d))
* **pages:** resolve relative Link destinations against the document ([1f0da26](https://github.com/ts-76/void-plugin-hono-jsx/commit/1f0da2637680b92606bef66510236624252c18dc))
* **release:** refresh pnpm publisher to patched rustls ([db2035e](https://github.com/ts-76/void-plugin-hono-jsx/commit/db2035eff876df04dd582b932b485f3a545e3cd1))
* **release:** refresh pnpm publisher to patched rustls ([38c9bdd](https://github.com/ts-76/void-plugin-hono-jsx/commit/38c9bdd5af42fe2819215340d6ed92284dce2d9c))


### Documentation

* describe post-alpha.3 APIs without transient publication claims ([0341e4d](https://github.com/ts-76/void-plugin-hono-jsx/commit/0341e4dffcf09657ad564f77551fa4d9c9066a54))
* distinguish published alpha baseline and upcoming release evidence ([83cca46](https://github.com/ts-76/void-plugin-hono-jsx/commit/83cca464ccf35a0402e00ce6426e63fee5057451))
* **markdown:** include optional setup in the packed guide ([26e7dd5](https://github.com/ts-76/void-plugin-hono-jsx/commit/26e7dd59ecdef69e16e466c16b2c0bd962d4777b))


### Release Automation

* accept scoped ZIP findings in the fixed-tarball publisher ([fb08d0b](https://github.com/ts-76/void-plugin-hono-jsx/commit/fb08d0b5c8c2d80f7f5e9072d36bf1f077f8c8f1))

## [0.1.0-alpha.3](https://github.com/ts-76/void-plugin-hono-jsx/compare/v0.1.0-alpha.2...v0.1.0-alpha.3) (2026-10-12)


### Bug Fixes

* support scaffold and current framework versions ([#46](https://github.com/ts-76/void-plugin-hono-jsx/issues/46)) ([4748044](https://github.com/ts-76/void-plugin-hono-jsx/commit/4748044cea8af423a77a6e51f0494c9b6d5a9a34))

## [0.1.0-alpha.2](https://github.com/ts-76/void-plugin-hono-jsx/compare/v0.1.0-alpha.1...v0.1.0-alpha.2) (2026-10-12)


### Bug Fixes

* include package sources and valid debug maps ([#42](https://github.com/ts-76/void-plugin-hono-jsx/issues/42)) ([2a69fa5](https://github.com/ts-76/void-plugin-hono-jsx/commit/2a69fa59d903f150e7b9906419283a5906282b62))


### Documentation

* distinguish future candidate archives from published alpha ([#45](https://github.com/ts-76/void-plugin-hono-jsx/issues/45)) ([d2740cb](https://github.com/ts-76/void-plugin-hono-jsx/commit/d2740cbb0dfff652fa17b10ff0504f5e353b4aaf))
* record published alpha as the default npm tag ([#44](https://github.com/ts-76/void-plugin-hono-jsx/issues/44)) ([8c8ea9a](https://github.com/ts-76/void-plugin-hono-jsx/commit/8c8ea9aa1d10e7ee2ff8946dea789d6b407d1680))

## [0.1.0-alpha.1](https://github.com/ts-76/void-plugin-hono-jsx/compare/v0.1.0-alpha.0...v0.1.0-alpha.1) (2026-10-11)


### Documentation

* record real OIDC alpha stage and verification limits ([#37](https://github.com/ts-76/void-plugin-hono-jsx/issues/37)) ([f3eeb0d](https://github.com/ts-76/void-plugin-hono-jsx/commit/f3eeb0d06ff11462e2af49a373dedb8c998b15e3))
* verify published alpha provenance and registry installation ([#38](https://github.com/ts-76/void-plugin-hono-jsx/issues/38)) ([70cadfe](https://github.com/ts-76/void-plugin-hono-jsx/commit/70cadfe3e88744db493c435b9dbc2ffefb52dc65))


### Release Automation

* manage alpha releases with release-please ([#39](https://github.com/ts-76/void-plugin-hono-jsx/issues/39)) ([3528b90](https://github.com/ts-76/void-plugin-hono-jsx/commit/3528b90d4222c8eb9709fbd5cce7e94ae6c4f0f8))
* validate component release branches before dispatching checks ([#41](https://github.com/ts-76/void-plugin-hono-jsx/issues/41)) ([64b2abb](https://github.com/ts-76/void-plugin-hono-jsx/commit/64b2abb8fae76bdbc0afd9683aba2e2f8c2cd188))

## 0.1.0-alpha.0 (2026-10-12)

- Accept the upstream esbuild development-server advisory GHSA-67mh-4wv8-2f99 as a documented limitation of the pinned alpha baseline, without dependency overrides. New unreviewed advisories and publisher-tooling findings remain blocked by the release gates.
- Verify Void 0.26.1 production deferred errors remain generic while development preserves diagnostic messages.
- Record the macOS development transport limitation after an undefined-action POST; the adapter does not repair this upstream edge case.

Initial experimental Hono JSX Pages adapter for Void 0.26.1.

- Server-rendered Pages, client-only pages, Void navigation and persistent layouts.
- Loader/action forms, head metadata and single deferred loader props.
- Load-policy islands, static output, development document reload and local ISR.
- Exact framework peers: Hono 4.13.13, Void 0.26.1 and Vite 8.3.3; Node >=24.21.0.

Browser mounting redraws server content. Managed edge deployment is unverified.
See the package guide for unsupported modes and the pinned compatibility policy.
Published on npm with the `next` tag after maintainer approval. Public bytes and provenance are recorded in `docs/stage-validation-result.md`.
