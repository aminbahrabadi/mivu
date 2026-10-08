# Untrusted Markdown

<script>globalThis.mivuPayloadExecuted = true</script>

<img src="https://example.org/no-fetch" onerror="globalThis.mivuPayloadExecuted=true">

<svg onload="globalThis.mivuPayloadExecuted=true"><foreignObject><p>active</p></foreignObject></svg>

<math><mtext><img src=x onerror="alert(1)"></mtext></math>

<iframe src="https://example.org"></iframe>

<form id="document"><input name="__proto__"></form>

[JavaScript](javascript:alert%281%29)
[Mixed case](JaVaScRiPt:alert%281%29)
[Encoded](%6aavascript%3Aalert%281%29)
[Entity](javascript:alert%281%29)
[Filesystem](file:///etc/passwd)

![Traversal](../secret.png)
![Encoded traversal](images/%2e%2e/secret.png)
![SVG](payload.svg)
![Remote](https://example.org/no-auto-fetch.png)

```html
<img onerror="alert(1)" />
```

- nested
  - **still** plain content
