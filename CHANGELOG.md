# Changelog

## Unreleased

- Every output carries `finalUrl`: where the page ended up, after its redirects.
- **Get Metadata** returns the fixed shape of `/meta` — `authors`, `published_at`, `image`, `feeds` and the rest, every key always present — and costs 1 credit.

## 0.1.1

- Published from GitHub Actions with an npm provenance statement, so anyone can check the package was built from this repository.

## 0.1.0

- URLpipe node with the Page operations Get Markdown, Get Rendered HTML, Get Summary, Take Screenshot, Get Metadata, Get Keywords, Get Console Errors, Run Lighthouse Audit, Scrape and Get Result.
- URLpipe API credential, tested without spending credits.
- Waits for results that take longer than a minute, up to a configurable timeout; or returns the token at once and delivers the result to a webhook.
- Usable as a tool by the AI Agent node.
