# content-finder

Fork from https://github.com/antonmedv/finder

## What's the difference

### 1. return the path stack instead of the selector string

```html
<p>Hello <span>World</span></p>
<span>World</span>
```

If we get the first `<span>` element from this HTML with `finder`, it will return `p > span`.

With `content-finder` we will have:

```js
[{ name: "p", content: null }, { name: "span", content: null }];
```

### 2. use content as part of the selector

```html
<p>foo</p>
<p>bar</p>
```

If we get the first `<p>` element from this HTML with `finder`, it will return `p:nth-child(1)`.

With `content-finder` we wil have:

```js
[{ name: "p", content: "foo" }];
```

This means there is only one `<p>` element has the content `foo`. Comparing to the nth-child selector, the selector with content is more semantic.

Although content selector is not part of the standard CSS selector, there are some libraries/frameworks support query by content (e.g., jQuery, Cypress).
