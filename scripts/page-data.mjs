import { PAGES_PROTOCOL_VERSION } from '@void/edge';
import { unflatten } from 'devalue';

/** Headers of a Pages JSON exchange; Void 1.7 and later also require the protocol version. */
export const pagesHeaders = {
  'X-VoidPages': 'true',
  'X-VoidPages-Version': PAGES_PROTOCOL_VERSION,
};

/** Void 1.7 and later serialize Pages payloads with devalue; earlier versions use plain JSON. */
export function decodePageData(value) {
  return value && typeof value === 'object' && value.__void === 'devalue' && 'data' in value
    ? unflatten(value.data)
    : value;
}

/** The page object embedded in a server-rendered document, or undefined without one. */
export function pageDataFromHtml(html) {
  const text = html.match(/<script[^>]*id="__VOID_PAGE_DATA__"[^>]*>([\s\S]*?)<\/script>/)?.[1];
  return text === undefined ? undefined : decodePageData(JSON.parse(text));
}
