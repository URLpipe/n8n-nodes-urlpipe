# n8n-nodes-urlpipe

This is an n8n community node. It lets you use [URLpipe](https://urlpipe.dev) in your n8n workflows.

URLpipe turns any URL into clean data: Markdown, a screenshot, metadata, console errors or a Lighthouse audit. Every page is rendered in real Chrome first, so sites built with JavaScript come back complete, and a repeat of the same request within seven days is served from the cache for free.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/sustainable-use-license/) workflow automation tool.

[Installation](#installation) ·
[Credentials](#credentials) ·
[Operations](#operations) ·
[Options](#options) ·
[Waiting for results](#waiting-for-results) ·
[Compatibility](#compatibility) ·
[Resources](#resources)

## Installation

In n8n, open **Settings → Community Nodes**, select **Install**, and enter `n8n-nodes-urlpipe`. See the [community nodes installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) for self-hosted setups.

## Credentials

You need a project API key from URLpipe:

1. Sign up at [urlpipe.dev](https://urlpipe.dev). The free plan gives you 1,000 credits a month, with no card.
2. Confirm your email address with the link URLpipe sends you. Keys start working once it is confirmed.
3. Copy the project's API key from the dashboard.
4. In n8n, create a **URLpipe API** credential and paste the key.

Testing the credential looks up a result that does not exist, so it costs nothing. See [Authentication](https://urlpipe.dev/docs/authentication).

## Operations

Every operation except Get Result takes the page's **URL**. Each input item is one request, so a list of URLs from a sheet, a feed or a database runs one call per row.

| Operation | What you get | Credits |
| --- | --- | --- |
| **Get Markdown** | The page's main content as Markdown, without navigation, sidebars or cookie banners: `{url, markdown, token, cache, credits}`. The format LLMs and RAG pipelines work best with. | 1 |
| **Get Rendered HTML** | The HTML after the page's JavaScript has run: `{url, html, …}` | 1 |
| **Get Summary** | An AI summary of the page, as Markdown: `{url, summary, …}` | 17 |
| **Take Screenshot** | The image as n8n binary data (field `data` by default, named after the host, such as `example.com.png`), plus `{url, resultUrl, mimeType, …}`. `resultUrl` is a link to the image that needs no API key and works for 30 days. | 1 |
| **Get Metadata** | Title, description, language, main image, favicon, author, feed and publication date. | 5 |
| **Get Keywords** | `{url, keywords: [...]}`, picked out with AI. | 15 |
| **Get Console Errors** | The errors, warnings and uncaught exceptions the page logs as it loads: `{url, entries: [{type, text}], errorCount, warningCount}` | 1 |
| **Run Lighthouse Audit** | Scores for performance, accessibility, best practices and SEO, and the key metrics (LCP, CLS, TBT, …). Choose **Device** (mobile or desktop) and turn on **Include Audits** for all 150+ audits. | 2 |
| **Scrape** | Several of the above off one page visit: pick them under **Operations**. You get `{url, operations: {<name>: {success, result, error, cached}}}`; a screenshot among them goes to binary data. Each operation is billed as it would be on its own, but you get them all much sooner. | sum |
| **Get Result** | The result of an earlier request, by its **Token**. Set **Original Operation** to shape it like that operation (a screenshot as a file, for example), and **Wait Until Ready** to keep checking until it is done. | 0 |

Every output carries `token` (fetch the same result again, free, for 30 days), `cache` (`hit` when it came from the cache and cost nothing) and `credits` (what the call cost).

Take Screenshot and Scrape also take **Screenshot Options**: Full Page, Viewport Width, Viewport Height, Scale (1x to 3x), Format (PNG, JPEG or WebP), Quality, Dark Mode and Element Selector (capture one element instead of the page).

## Options

These are under **Options** on every page operation:

- **Max Age**: how fresh a stored result must be to be reused for free, as seconds (`3600`) or a duration (`2 hours`, `3 days`). Empty means 7 days; `0` always loads the page again.
- **Labels**: your own name and value pairs, such as `client: acme`. The URLpipe dashboard filters history and totals credits by them, and they come back with async results.
- **Residential**: load the page from a residential address, for sites that serve a datacentre less than they serve a browser. Adds 25 credits per page visit.
- **Block Ads** and **Block Cookie Banners**: take ads and consent banners out of the page before it is read. Pages with ads usually load much faster.
- **Wait for Selector**: wait up to 10 seconds for an element, for pages whose content arrives after they load.
- **Wait for Result** and **Wait Timeout**: see below.
- **Report To**: a webhook URL for the result, when Wait for Result is off.

Lighthouse audits load the page for themselves, so the page options (ads, cookie banners, selector) don't apply to Run Lighthouse Audit.

## Waiting for results

By default the node waits for each result and outputs it. Most pages take a few seconds. When an analysis runs past a minute, such as a Lighthouse audit of a heavy page, the node keeps checking every 2 seconds until the result is ready, up to **Wait Timeout** (300 seconds by default).

Turn **Wait for Result** off to get `{token, status: "accepted"}` right away instead. Then either:

- collect the result later with the **Get Result** operation and the token, or
- set **Report To** to the production URL of an n8n **Webhook** node (method POST). URLpipe posts the result there when it is ready, with your labels, and that workflow starts with it. The URL must be public, on the default port: n8n Cloud webhook URLs work; a self-hosted n8n needs a public hostname on port 443.

## Errors and retries

Failures come back with URLpipe's own message and what to do next: a key the API does not accept, an email address still to confirm, used-up credits (with the date they reset), or a page that could not be analyzed. Requests that fail cost no credits.

Turn on **Continue On Fail** in the node settings to output a failed item as `{error, description}` and go on with the rest. If URLpipe asks the node to slow down, it waits the time the API gives and tries once more; for anything else, use n8n's **Retry On Fail** setting. The API takes 60 requests a minute per project.

## Compatibility

Tested with n8n 2.40. The node uses n8n Nodes API version 1, and has no runtime dependencies.

## Resources

- [URLpipe in n8n](https://urlpipe.dev/integrations/n8n)
- [URLpipe API docs](https://urlpipe.dev/docs)
- [Pricing and credits](https://urlpipe.dev/pricing)
- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)

## Version history

See [CHANGELOG.md](CHANGELOG.md).

## License

[MIT](LICENSE)
