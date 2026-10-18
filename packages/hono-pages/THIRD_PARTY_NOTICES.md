# Third-party notices

The renderer/client entry conventions and provider integration were adapted from the published `@void/react` 0.26.0 adapter and Void 0.26.0. Both distributions include the following MIT notice. Hono is a peer dependency; its notice is included for reference. The project is separately licensed under MIT; these notices preserve upstream copyright attribution.

## Void, @void/react and @void/md

Source distributions: `void@0.26.0` and `@void/react@0.26.0`, published npm packages. Link, prefetch lifecycle and form API behavior also reference the published `@void/react@0.27.0` adapter. Hono's render/navigation integration uses the public `void@0.26.1` / `void@0.27.0` navigation engine and router facade, with lifecycle behavior adapted from Void's router. Markdown script extraction, component-tag splitting and entry conventions reference the published `@void/md@0.27.0` implementation; its MIT attribution is preserved here. Code highlighting/copy, container conventions and the six theme CSS files also reference the published `@void/md@1.1.11`; theme CSS is included under this notice, with keyboard/touch copy-button additions in code.css. Production static-layout CSS collection follows the official `@void/react@1.1.11` adapter using Void's public CSS import utilities. Markdown parsing/highlighting uses the public `markdown-exit`, `yaml`, `markdown-it-container`, `shiki` and `@shikijs/transformers` APIs as optional peers. No private `@void/md` module is imported. The adapter imports framework APIs rather than bundling the framework.

MIT License

Copyright (c) 2026-present, Cloudflare, Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Hono

Source distribution: `hono@4.13.13`, published npm package. Hono is required as an exact peer dependency.

MIT License

Copyright (c) 2021 - present, Yusuke Wada and Hono contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
