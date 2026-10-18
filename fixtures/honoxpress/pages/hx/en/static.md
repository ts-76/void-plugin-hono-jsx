<script>
import Callout from '../../../components/hx/Callout' with { component: "static" };
import Cards from '../../../components/hx/Cards' with { component: "static" };
import Card from '../../../components/hx/Card' with { component: "static" };
import Steps from '../../../components/hx/Steps' with { component: "static" };
import Step from '../../../components/hx/Step' with { component: "static" };
import Disclosure from '../../../components/hx/Disclosure' with { component: "static" };
import Properties from '../../../components/hx/Properties' with { component: "static" };

</script>
---
title: Static Markdown
locale: en
slug: static
href: /hx/en/static
interactive: false
---
# Static Markdown

:::component Callout title="A note"
Static content is readable with HTML and CSS.
:::

::::component Cards
:::component Card title="Guide"
## Nested heading

Nested **Markdown** keeps its formatting.
:::
::::

::::component Steps
:::component Step title="Prepare"
Define the component in TSX.
:::
::::

:::component Disclosure title="Details"
Native disclosure works without JavaScript.
:::

## Properties

<Properties />


