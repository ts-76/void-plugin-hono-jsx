<script>
import Counter from "../../components/MarkdownCounter.tsx" with { island: "load" };
window.markdownScriptRuns = (window.markdownScriptRuns ?? 0) + 1;
document.getElementById('markdown-script').textContent = 'active page script';
</script>
---
title: Interactive Markdown
description: Authored page
---
# Markdown **heading**

<div id="markdown-script">SSR script placeholder</div>

<Counter name="first" initial="4" />

<Counter name="second" initial="9" />

[Static page](/docs/plain)
