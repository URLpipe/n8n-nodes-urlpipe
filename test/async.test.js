'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { run, runExpectingError, textHeaders, jsonHeaders, PNG } = require('./helpers');

const markdownParams = (options = {}) => ({
	resource: 'page',
	operation: 'markdown',
	url: 'https://example.com',
	options,
});

test('with Wait for Result off, the token comes back at once and Report To is sent', async () => {
	const { output, requests } = await run({
		params: markdownParams({
			waitForResult: false,
			reportTo: 'https://n8n.example.com/webhook/urlpipe',
			labels: { label: [{ name: 'row', value: '7' }] },
		}),
		responses: [
			{
				status: 200,
				body: { token: 'tok_async', status: 'accepted', labels: { row: '7' } },
				headers: jsonHeaders({ 'x-result-token': 'tok_async' }),
			},
		],
	});

	assert.deepEqual(requests[0].options.body, {
		url: 'https://example.com',
		sync: false,
		labels: { row: '7' },
		report_to: 'https://n8n.example.com/webhook/urlpipe',
	});
	assert.deepEqual(output[0].json, {
		url: 'https://example.com',
		token: 'tok_async',
		status: 'accepted',
		labels: { row: '7' },
	});
});

test('Report To is left out of a call that waits for the result', async () => {
	const { requests } = await run({
		params: markdownParams({ reportTo: 'https://n8n.example.com/webhook/urlpipe' }),
		responses: [{ status: 200, body: '# Example', headers: textHeaders() }],
	});
	assert.deepEqual(requests[0].options.body, { url: 'https://example.com', sync: true });
});

test('a sync call answered 504 processing_timeout polls GET /result until it is ready', async () => {
	const { output, requests } = await run({
		params: markdownParams(),
		responses: [
			{ status: 504, body: { error: 'processing_timeout', token: 'tok_slow' }, headers: {} },
			{ status: 202, body: { status: 'processing', token: 'tok_slow', labels: {} }, headers: {} },
			{ status: 504, body: { error: 'processing_timeout', token: 'tok_slow' }, headers: {} },
			{ status: 200, body: '# Finally', headers: textHeaders({ 'x-result-token': 'tok_slow' }) },
		],
	});

	assert.deepEqual(
		requests.map((r) => `${r.options.method} ${r.options.url}`),
		['POST /markdown', 'GET /result/tok_slow', 'GET /result/tok_slow', 'GET /result/tok_slow'],
	);
	assert.equal(output[0].json.markdown, '# Finally');
	assert.equal(output[0].json.token, 'tok_slow');
	assert.equal(output[0].json.url, 'https://example.com');
});

test('polling gives up after the wait timeout and names the token to fetch later', async () => {
	const { error } = await runExpectingError({
		params: markdownParams({ waitTimeout: 0.03 }),
		responses: (index) =>
			index === 0
				? { status: 504, body: { error: 'processing_timeout', token: 'tok_slow' } }
				: { status: 202, body: { status: 'processing', token: 'tok_slow' } },
	});
	assert.equal(error.name, 'NodeOperationError');
	assert.match(error.message, /not ready within 0.03 seconds/);
	assert.match(error.description, /tok_slow/);
});

test('Get Result returns a result still being worked on with status processing', async () => {
	const { output, requests } = await run({
		params: { resource: 'page', operation: 'getResult', resultId: 'tok_1', resultOptions: {} },
		responses: [{ status: 202, body: { status: 'processing', token: 'tok_1', labels: {} } }],
	});
	assert.equal(requests[0].options.method, 'GET');
	assert.equal(requests[0].options.url, '/result/tok_1');
	assert.deepEqual(output[0].json, { token: 'tok_1', status: 'processing', labels: {} });
});

test('Get Result detects a JSON result and keeps a text one as text', async () => {
	const json = await run({
		params: { resource: 'page', operation: 'getResult', resultId: 'tok_1' },
		responses: [{ status: 200, body: { title: 'Example' }, headers: jsonHeaders() }],
	});
	assert.equal(json.output[0].json.title, 'Example');
	assert.equal(json.output[0].json.token, 'tok_1');

	const text = await run({
		params: { resource: 'page', operation: 'getResult', resultId: 'tok_2' },
		responses: [{ status: 200, body: '# Example', headers: textHeaders() }],
	});
	assert.equal(text.output[0].json.result, '# Example');
});

test('Get Result with Original Operation set to Take Screenshot outputs the image file', async () => {
	const { output } = await run({
		params: {
			resource: 'page',
			operation: 'getResult',
			resultId: 'tok_shot',
			resultOptions: { originalOperation: 'screenshot', binaryPropertyName: 'shot' },
		},
		responses: [{ status: 200, body: PNG.toString('base64'), headers: textHeaders() }],
	});
	assert.equal(output[0].binary.shot.mimeType, 'image/png');
	assert.equal(output[0].binary.shot.fileName, 'screenshot.png');
});

test('Get Result with Wait Until Ready polls until the result arrives', async () => {
	const { output, requests } = await run({
		params: {
			resource: 'page',
			operation: 'getResult',
			resultId: 'tok_1',
			resultOptions: { waitUntilReady: true, originalOperation: 'markdown' },
		},
		responses: [
			{ status: 202, body: { status: 'processing', token: 'tok_1' } },
			{ status: 200, body: '# Ready', headers: textHeaders() },
		],
	});
	assert.equal(requests.length, 2);
	assert.equal(output[0].json.markdown, '# Ready');
});
