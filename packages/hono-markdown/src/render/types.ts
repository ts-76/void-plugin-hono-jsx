export type Heading = { depth: number; slug: string; text: string };

export type MarkdownHeading = { depth: number; text: string; index: number };
export type MarkdownCodeBlock = {
  code: string;
  language: string;
  info: string;
  /** Escaped <pre><code> output, highlighted unless highlight is false. */
  html: string;
};

/** Host-independent rendering options; languages load on demand. */
export type HonoMarkdownOptions = {
  /** Raw authored HTML. Defaults to false in /render, true in trusted module compilers. */
  html?: boolean;
  breaks?: boolean;
  linkify?: boolean;
  /** Called once per heading, with a zero-based index local to this document. IDs stay unique. */
  headingId?: (heading: MarkdownHeading) => string;
  /** false emits ordinary escaped <pre><code>. Defaults to false in /render, true in module compilers. */
  highlight?: boolean;
  /** Application-owned HTML renderer. Its return value is trusted, never sanitized. */
  renderCodeBlock?: (block: MarkdownCodeBlock) => string | Promise<string>;
  shiki?: { themes?: { light: string; dark: string } };
  /**
   * Module compilation only: frontmatter serialized into HTML for browser islands.
   * true (default) exposes every key, false none, an array only the listed keys.
   * Server layouts and generated module exports always receive the full mapping.
   */
  clientFrontmatter?: boolean | readonly string[];
};
