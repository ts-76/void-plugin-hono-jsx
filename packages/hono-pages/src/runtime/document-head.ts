import { renderHeadToString } from 'void/pages-head';
import type { HeadDescriptor } from 'void';

function scriptSignature(script: HTMLScriptElement) {
  return JSON.stringify([Array.from(script.attributes, ({ name, value }) => [name, value]).sort(), script.textContent]);
}

function scriptElements(head: HeadDescriptor | undefined) {
  const template = document.createElement('template');
  template.innerHTML = renderHeadToString({ script: head?.script });
  return Array.from(template.content.querySelectorAll('script'));
}

function metadataSignature(element: Element) {
  return JSON.stringify([element.tagName, Array.from(element.attributes, ({ name, value }) => [name, value]).filter(([name]) => name !== 'data-void-head').sort()]);
}

/** Synchronizes the snapshot before Void's idempotent post-render head commit. */
export function createDocumentHead(initial: HeadDescriptor | undefined) {
  let htmlKeys = Object.keys(initial?.htmlAttrs ?? {});
  let bodyKeys = Object.keys(initial?.bodyAttrs ?? {});
  let scripts: HTMLScriptElement[] = [];
  const existing = Array.from(document.head.querySelectorAll('script'));
  for (const desired of scriptElements(initial)) {
    const index = existing.findIndex((script) => scriptSignature(script) === scriptSignature(desired));
    if (index >= 0) scripts.push(...existing.splice(index, 1));
  }

  function attributes(element: HTMLElement, previous: string[], next: Record<string, string> = {}) {
    for (const key of previous) if (!(key in next)) element.removeAttribute(key);
    for (const [key, value] of Object.entries(next)) element.setAttribute(key, value);
    return Object.keys(next);
  }

  return (head: HeadDescriptor | undefined) => {
    if (head?.title !== undefined) document.title = head.title;
    // Use Void's serializer and managed-tag marker so the router's subsequent
    // commit reuses these nodes instead of inserting duplicate meta/link tags.
    const template = document.createElement('template');
    template.innerHTML = renderHeadToString({ meta: head?.meta, link: head?.link });
    const metadata = Array.from(document.head.querySelectorAll('meta[data-void-head],link[data-void-head]'));
    for (const desired of Array.from(template.content.querySelectorAll('meta,link'))) {
      const index = metadata.findIndex(element => metadataSignature(element) === metadataSignature(desired));
      if (index >= 0) document.head.appendChild(metadata.splice(index, 1)[0]);
      else { desired.setAttribute('data-void-head', ''); document.head.appendChild(desired); }
    }
    for (const previous of metadata) previous.remove();
    htmlKeys = attributes(document.documentElement, htmlKeys, head?.htmlAttrs);
    bodyKeys = attributes(document.body, bodyKeys, head?.bodyAttrs);
    const remaining = [...scripts];
    scripts = scriptElements(head).map((desired) => {
      const index = remaining.findIndex((script) => scriptSignature(script) === scriptSignature(desired));
      if (index >= 0) return remaining.splice(index, 1)[0];
      // Template-parsed scripts remain inert when inserted. Head changes are metadata, not script execution.
      document.head.appendChild(desired);
      return desired;
    });
    for (const script of remaining) script.remove();
  };
}
