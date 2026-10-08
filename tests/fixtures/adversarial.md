# Untrusted input

<script>window.__mivuPwned = true</script>
<img src="https://example.invalid/tracker" onerror="window.__mivuPwned = true">
<iframe src="file:///etc/passwd"></iframe>
<svg onload="window.__mivuPwned = true"></svg>

[Script](<javascript:alert(1)>)
[Encoded scheme](javascript%3Aalert%281%29)
[File](file:///etc/passwd)
[Remote](https://example.invalid/explicit-user-link)

![Tracking pixel](https://example.invalid/pixel.png)
![Traversal](../../../../etc/passwd)
![SVG](evil.svg)

```html
<script>
  Code is text, never execution.
</script>
```
