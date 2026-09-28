'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { run, textHeaders, jsonHeaders, constants } = require('./helpers');

const page = (operation, extra = {}) => ({
	resource: 'page',
	operation,
	url: 'https://example.com/blog',
	...extra,
});

test('Get Markdown posts the URL synchronously and outputs the text with the request facts', async () => {
	const { output, requests } = await run({
		params: page('markdown'),
		responses: [{ status: 200, body: '# Example', headers: textHeaders() }],
	});

	assert.equal(requests.length, 1);
	const { credentialName, options } = requests[0];
	assert.equal(credentialName, 'urlpipeApi');
	assert.equal(options.method, 'POST');
	assert.equal(options.baseURL, 'https://urlpipe.dev');
	assert.equal(options.url, '/markdown');
	assert.deepEqual(options.body, { url: 'https://example.com/blog', sync: true });
	assert.equal(options.headers['User-Agent'], `n8n-nodes-urlpipe/${constants.PACKAGE_VERSION}`);
	assert.equal(options.encoding, 'text');

	assert.deepEqual(output, [
		{
			json: {
				url: 'https://example.com/blog',
				markdown: '# Example',
				token: 'tok_123',
				cache: 'miss',
				credits: 1,
			},
			pairedItem: { item: 0 },
		},
	]);
});

test('Get Rendered HTML and Get Summary name their text field after what they return', async () => {
	const html = await run({
		params: page('html'),
		responses: [{ status: 200, body: '<html></html>', headers: textHeaders() }],
	});
	assert.equal(html.requests[0].options.url, '/html');
	assert.equal(html.output[0].json.html, '<html></html>');

	const summary = await run({
		params: page('summarize'),
		responses: [{ status: 200, body: 'A short summary.', headers: textHeaders() }],
	});
	assert.equal(summary.requests[0].options.url, '/summarize');
	assert.equal(summary.output[0].json.summary, 'A short summary.');
});

test('shared options become max_age, labels, residential and page_options', async () => {
	const { requests } = await run({
		params: page('markdown', {
			options: {
				maxAge: '3 days',
				labels: {
					label: [
						{ name: 'client', value: 'acme' },
						{ name: ' ', value: 'dropped' },
					],
				},
				residential: true,
				blockAds: true,
				blockCookieBanners: true,
				waitForSelector: '#content',
			},
		}),
		responses: [{ status: 200, body: '# Example', headers: textHeaders() }],
	});

	assert.deepEqual(requests[0].options.body, {
		url: 'https://example.com/blog',
		sync: true,
		max_age: '3 days',
		labels: { client: 'acme' },
		residential: true,
		page_options: { block_ads: true, block_cookie_banners: true, wait_for_selector: '#content' },
	});
});

test('a Max Age of only digits is sent as a number of seconds', async () => {
	const { requests } = await run({
		params: page('markdown', { options: { maxAge: '3600' } }),
		responses: [{ status: 200, body: '# Example', headers: textHeaders() }],
	});
	assert.equal(requests[0].options.body.max_age, 3600);
});

test('Get Metadata outputs the metadata object itself', async () => {
	const meta = { title: 'Example Domain', description: 'Examples.', language: 'en' };
	const { output, requests } = await run({
		params: page('meta'),
		responses: [{ status: 200, body: meta, headers: jsonHeaders({ 'x-quota-cost': '5' }) }],
	});
	assert.equal(requests[0].options.url, '/meta');
	assert.deepEqual(output[0].json, {
		url: 'https://example.com/blog',
		...meta,
		token: 'tok_123',
		cache: 'miss',
		credits: 5,
	});
});

test('Get Keywords outputs the keyword list', async () => {
	const { output } = await run({
		params: page('keywords'),
		responses: [{ status: 200, body: ['example', 'domain'], headers: jsonHeaders() }],
	});
	assert.deepEqual(output[0].json.keywords, ['example', 'domain']);
	assert.equal(output[0].json.url, 'https://example.com/blog');
});

test('Get Console Errors counts errors and exceptions apart from warnings', async () => {
	const entries = [
		{ type: 'error', text: 'Failed to fetch' },
		{ type: 'warning', text: 'Deprecated API' },
		{ type: 'exception', text: 'ReferenceError: bar is not defined' },
	];
	const { output, requests } = await run({
		params: page('console'),
		responses: [{ status: 200, body: entries, headers: jsonHeaders() }],
	});
	assert.equal(requests[0].options.url, '/console');
	assert.deepEqual(output[0].json.entries, entries);
	assert.equal(output[0].json.errorCount, 2);
	assert.equal(output[0].json.warningCount, 1);
});

test('Run Lighthouse Audit sends device and audits, and never page options', async () => {
	const audit = {
		url: 'https://example.com/blog',
		device: 'desktop',
		categories: { performance: { score: 0.95, title: 'Performance' } },
		metrics: {},
	};
	const { output, requests } = await run({
		params: page('lighthouse', {
			device: 'desktop',
			includeAudits: true,
			options: { blockAds: true, maxAge: '1 hour' },
		}),
		responses: [{ status: 200, body: audit, headers: jsonHeaders({ 'x-quota-cost': '2' }) }],
	});

	assert.deepEqual(requests[0].options.body, {
		url: 'https://example.com/blog',
		sync: true,
		max_age: '1 hour',
		device: 'desktop',
		include_audits: true,
	});
	assert.equal(output[0].json.categories.performance.score, 0.95);
	assert.equal(output[0].json.credits, 2);
});

test('every input item is processed and keeps its pairedItem', async () => {
	const { output, requests } = await run({
		params: [
			page('markdown', { url: 'https://a.example' }),
			page('markdown', { url: 'https://b.example' }),
		],
		responses: [
			{ status: 200, body: '# A', headers: textHeaders() },
			{ status: 200, body: '# B', headers: textHeaders() },
		],
	});
	assert.deepEqual(
		requests.map((r) => r.options.body.url),
		['https://a.example', 'https://b.example'],
	);
	assert.deepEqual(
		output.map((item) => [item.json.markdown, item.pairedItem.item]),
		[
			['# A', 0],
			['# B', 1],
		],
	);
});

test('the version in the User-Agent matches package.json', () => {
	const { version } = require('../package.json');
	assert.equal(constants.PACKAGE_VERSION, version);
});

test('the credential sends a Bearer header and is tested without spending credits', () => {
	const { UrlpipeApi } = require('../dist/credentials/UrlpipeApi.credentials.js');
	const credential = new UrlpipeApi();
	assert.equal(
		credential.authenticate.properties.headers.Authorization,
		'=Bearer {{$credentials.apiKey}}',
	);
	assert.equal(credential.test.request.url, '/result/credential-check');
	assert.equal(credential.test.request.ignoreHttpStatusErrors, true);
	assert.deepEqual(
		credential.test.rules.map((rule) => rule.properties.value),
		['invalid_api_key', 'email_unverified'],
	);
});
