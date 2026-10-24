import assert from 'node:assert/strict';
import { test } from 'node:test';
import MarkdownExit from 'markdown-exit';
import { compileMarkdown, createMarkdownCompiler, renderChunks } from '../packages/hono-pages/src/plugins/markdown-compiler.ts';

const text = html => new MarkdownExit().utils.unescapeAll(html.replace(/<[^>]+>/g, ''));

test('official container syntax supports all five kinds, Markdown titles, nesting and fenced code', async () => {
  const result = await compileMarkdown('::: tip **Advice**\nOuter\n\n:::: warning\nNested\n::::\n\n```js\nconst answer = 42\n```\n:::\n\n::: info\nInfo\n:::\n\n::: danger\nDanger\n:::\n\n::: details More *detail*\nHidden\n:::\n');
  for (const kind of ['tip','info','warning','danger','details']) assert.match(result.html,new RegExp(`class="${kind} custom-block"`));
  assert.match(result.html,/<p class="custom-block-title"><strong>Advice<\/strong>/);
  assert.match(result.html,/<p class="custom-block-title custom-block-title-default">WARNING/);
  assert.match(result.html,/<details[^>]+><summary>More <em>detail<\/em><\/summary>/);
  assert.match(result.html,/shiki-themes github-light github-dark/);
  assert.equal(result.hasCode,true);
  assert.ok(result.html.indexOf('Nested')<result.html.indexOf('</div>'));
});

test('code is escaped, unknown languages fall back to text and island-looking code never becomes a component', async () => {
  const result = await compileMarkdown('```not-a-language\n<Counter initial="9" />\n<script>injected</script>\n```');
  assert.match(result.html,/language-not-a-language/);
  assert.doesNotMatch(result.html,/<Counter|<script>/);
  assert.match(text(result.html),/<Counter initial="9" \/>\n<script>injected<\/script>/);
  assert.equal(renderChunks(result.html,new Set(['Counter'])).length,1);
});

test('public Shiki options are isolated per compiler and languages load concurrently on demand', async () => {
  const a=createMarkdownCompiler();
  const b=createMarkdownCompiler({shiki:{themes:{light:'light-plus',dark:'nord'}}});
  const source='```ts\nconst result: number = 2\n```';
  const [first,second,again]=await Promise.all([a.render(a.parse(source)),b.render(b.parse(source)),b.render(b.parse(source))]);
  assert.match(first.html,/github-light github-dark/);
  assert.match(second.html,/light-plus nord/);
  assert.equal(second.html,again.html);
  await assert.rejects(()=>compileMarkdown(source,{shiki:{themes:{light:'missing-theme',dark:'github-dark'}}}),/unknown Shiki theme/);
});

test('official Shiki annotations and line numbers retain raw fence metadata', async () => {
  const result=await compileMarkdown('```ts {2} :line-numbers {=5}\nconst before = 1 // [!code --]\nconst after = 2 // [!code ++]\n```');
  assert.match(result.html,/class="line diff remove"/);
  assert.match(result.html,/class="line diff add highlighted"|class="line highlighted diff add"/);
  assert.match(result.html,/language-ts line-numbers-mode/);
  assert.match(result.html,/class="line-number">5<\/span>/);
  assert.doesNotMatch(text(result.html),/\[!code/);
});

test('official focus and warning/error annotations reach the highlighted HTML', async () => {
  const result=await compileMarkdown('```js\nconst focused = 1 // [!code focus]\nconst warning = 2 // [!code warning]\nconst failure = 3 // [!code error]\n```');
  assert.match(result.html,/has-focus/);assert.match(result.html,/class="line focused"/);
  assert.match(result.html,/highlighted warning/);assert.match(result.html,/highlighted error/);
});

test('fence line highlighting is clamped to the block and ignores malformed ranges', async () => {
  // Shiki keeps the empty line after the fence content's final newline.
  const lines = html => [...html.matchAll(/<span class="line([^"]*)"/g)].map(match => match[1].includes('highlighted'));
  const ranged = await compileMarkdown('```js {1,3-5}\na\nb\nc\nd\ne\nf\n```');
  assert.deepEqual(lines(ranged.html), [true, false, true, true, true, false, false]);
  const started = performance.now();
  const huge = await compileMarkdown('```js {1-50000000,2-90000000,' + '1-40000000,'.repeat(2000) + '3}\na\nb\nc\n```');
  assert.deepEqual(lines(huge.html), [true, true, true, true]);
  assert.ok(performance.now() - started < 2000, 'oversized ranges must not scale with their declared size');
  for (const meta of ['{5-1}', '{-3}', '{0}', '{,}', '{1-}', '{99}']) {
    assert.deepEqual(lines((await compileMarkdown('```js ' + meta + '\na\nb\n```')).html), [false, false, false], meta);
  }
});
