// Imported as a module only by Markdown pages with fenced code. No Hono runtime
// or island scheduler is required for code-copy-only documents.
export const markdownCopyId = 'virtual:void-hono-markdown-copy';
export const markdownCopyCode = `
const timers = new WeakMap();
document.addEventListener('click', async event => {
  const button = event.target instanceof Element && event.target.closest("div[class*='language-'] > button.copy");
  if (!button || button.disabled) return;
  const pre = button.parentElement?.querySelector('pre');
  if (!pre) return;
  clearTimeout(timers.get(button));
  button.classList.remove('copied', 'copy-error');
  const reset = () => { button.classList.remove('copied', 'copy-error'); button.title = 'Copy Code'; button.setAttribute('aria-label', 'Copy Code'); };
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
    const lines = Array.from(pre.querySelectorAll('.line:not(.diff.remove)'), line => line.textContent);
    if (lines.at(-1) === '') lines.pop();
    button.disabled = true;
    await navigator.clipboard.writeText(lines.join('\\n'));
    button.classList.add('copied');
    button.title = 'Copied'; button.setAttribute('aria-label', 'Copied');
  } catch {
    button.classList.add('copy-error');
    button.title = 'Copy failed'; button.setAttribute('aria-label', 'Copy failed');
  } finally {
    button.disabled = false;
    timers.set(button, setTimeout(reset, 2000));
  }
});
`;
