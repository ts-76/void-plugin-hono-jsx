# Changelog

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
