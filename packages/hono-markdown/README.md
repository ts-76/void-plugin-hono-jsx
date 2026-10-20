# Hono Markdown

Build-only compiler and browser island runtime for trusted authored Markdown, independent of Void and deck/document route conventions. The Void adapter and deck host consume this package through their own adapters.

Use `/compiler` for readMarkdownModule / compileMarkdownModule (or the strict static API), the root export for the shared MarkdownContext and hooks, and `/client` for hydrateMarkdownIslands. Parsers, YAML and Shiki are optional peers required only by the compiler. No Void or Vite peer is required.

The browser scheduler supports load, idle, visible and media. Hosts may inject a scheduler and a `ready(element, start)` gate for visible islands. Routing, document/head ownership and presentation activation belong to host adapters. The compiler preserves literal attribute restrictions and rejects arbitrary scripts in standalone modules.
