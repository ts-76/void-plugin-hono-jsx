<script>
import Idle from "../components/PolicyCounter" with { island: "idle" };
import Visible from "../components/PolicyCounter" with { island: "visible" };
import Media from "../components/PolicyCounter" with { island: "media:(max-width: 600px)" };
</script>
---
layout: false
---
# Markdown policies

<Idle id="idle" />

<Media id="media" />

<section style="margin-top: 2000px">
<Visible id="visible" />
</section>
