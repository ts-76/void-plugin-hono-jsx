import { defineHandler, defineHead } from 'void';
export const loader = defineHandler(c => { const nonce = crypto.randomUUID(); if (!import.meta.env.DEV) c.header('Content-Security-Policy', `style-src 'self'; style-src-elem 'self' 'nonce-${nonce}'; style-src-attr 'unsafe-inline'`); return { nonce, message: "ローダーの値" }; });
export const head = defineHead(() => ({ title: "Loaded 操作できるMarkdown", htmlAttrs: { lang: 'ja' } }));
