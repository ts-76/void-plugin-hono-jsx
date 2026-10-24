import assert from 'node:assert/strict';
import test from 'node:test';
import { compileMarkdownModule, compileStaticMarkdown } from '@ts-76/hono-markdown/compiler';

// `shiki` is read only while constructing a compiler, so reads stop once it is reused.
const countedOptions = () => {
  const counter = { reads: 0 };
  const options = { get shiki() { counter.reads++; return undefined; } };
  return { counter, options };
};

test('module compilation reuses one parser and highlighter per options object', async () => {
  const { counter, options } = countedOptions();
  const input = { sourcePath: '/virtual/doc.md', options };
  let afterFirst;
  for (const index of [1, 2, 3]) {
    const result = await compileMarkdownModule(`# Module ${index}\n\n\`\`\`js\nconst value = ${index}\n\`\`\``, input);
    assert.match(result.code, new RegExp(`Module ${index}`));
    assert.match(result.code, /shiki/);
    afterFirst ??= counter.reads;
  }
  await compileStaticMarkdown('# Static', input);
  assert.ok(afterFirst > 0);
  assert.equal(counter.reads, afterFirst);
  const other = countedOptions();
  await compileMarkdownModule('# Other', { sourcePath: '/virtual/other.md', options: other.options });
  assert.equal(other.counter.reads, afterFirst, 'a different options object gets its own compiler');
});

test('a shared compiler keeps frontmatter and headings isolated across concurrent documents', async () => {
  const input = { sourcePath: '/virtual/doc.md', options: { highlight: false } };
  const results = await Promise.all(Array.from({ length: 8 }, (_, index) => compileMarkdownModule(`---\ntitle: Doc ${index}\n---\n\n# Heading ${index}\n\n## Section`, input)));
  results.forEach((result, index) => {
    assert.deepEqual(result.frontmatter, { title: `Doc ${index}` });
    assert.deepEqual(result.headings.map(heading => heading.text), [`Heading ${index}`, 'Section']);
    assert.deepEqual(result.headings.map(heading => heading.slug), [`heading-${index}`, 'section']);
  });
});

test('prelude validation still runs before rendering on the shared compiler', async () => {
  const input = { sourcePath: '/virtual/doc.md' };
  await assert.rejects(compileMarkdownModule('<script>window.bad = true;</script>\n\n# Body', input), /component imports only/);
  await assert.rejects(compileStaticMarkdown('<script>import Counter from "./Counter" with { island: "load" };</script>\n\n<Counter />', input), /static components only/);
});
