<script>
import Callout from '../../../components/hx/Callout' with { component: "static" };
import Cards from '../../../components/hx/Cards' with { component: "static" };
import Card from '../../../components/hx/Card' with { component: "static" };
import Steps from '../../../components/hx/Steps' with { component: "static" };
import Step from '../../../components/hx/Step' with { component: "static" };
import Disclosure from '../../../components/hx/Disclosure' with { component: "static" };
import Properties from '../../../components/hx/Properties' with { component: "static" };
import CodeSamples from "../../../components/hx/CodeSamples" with { island: "load" };
</script>
---
title: 操作できるMarkdown
locale: ja
slug: interactive
href: /hx/ja/interactive
interactive: true
---
# 操作できるMarkdown

:::component Callout title="注意点"
HTMLとCSSで読める本文です。
:::

::::component Cards
:::component Card title="ガイド"
## ネストした見出し

**Markdown**をそのまま書けます。
:::
::::

::::component Steps
:::component Step title="準備"
TSXで部品を定義します。
:::
::::

:::component Disclosure title="詳細"
JavaScriptなしで開けます。
:::

## プロパティ

<Properties />

<CodeSamples label="Examples" />

<div class="void-md">

```ts
const highlighted117: string = "build time";
```

</div>
