<script>
import Counter from "../src/MarkdownCounter.tsx" with { island: "load" };
import "../src/markdown-client.ts";
</script>
---
title: Markdownの確認
description: Markdownの本文と、Hono JSXの操作できる部品を同じページで確認できます。
category: サンプルガイド
layout: "!markdown"
---
## Markdownで書いた本文

この本文は **Markdownファイル** から生成しています。見出し、箇条書き、表、コードブロックを、そのまま記述できます。

- 本文はサーバーでHTMLに変換します。
- ページ情報はfrontmatterから読み込みます。
- 操作が必要な部分にはHono JSXの部品を埋め込めます。

| 確認するもの | このページでの表示 |
| --- | --- |
| Markdownの本文 | 見出し・箇条書き・表 |
| frontmatter | ページ名・カテゴリー |
| サーバーのloader | 「このページの情報」の読み込み結果 |
| Hono JSXの部品 | 下の2つのカウンター |

## Honoのカウンター

片方の「+1 増やす」を押してみてください。それぞれのカウントは独立していて、リセットすると個別の初期値に戻ります。

<div class="markdown-counters">

<Counter name="markdown-first" label="カウンター A" initial="4" />

<Counter name="markdown-second" label="カウンター B" initial="9" />

</div>

## コードブロック

Markdownには、以下のように部品を配置しています。

```html
<Counter name="markdown-first" label="カウンター A" initial="4" />
```

## 他のサンプルを試す

[ユーザーの切り替え](/users/bob)や[フォームの送信](/edit)も、同じアプリで確認できます。[概要へ戻る](/)。
