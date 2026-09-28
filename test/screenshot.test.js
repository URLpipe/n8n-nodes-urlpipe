'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { run, textHeaders, jsonHeaders, PNG, JPEG, WEBP } = require('./helpers');

test('Take Screenshot outputs the image as binary data named after the host', async () => {
	const { output, requests } = await run({
		params: {
			resource: 'page',
			operation: 'screenshot',
			url: 'https://www.example.com/pricing',
			binaryPropertyName: 'image',
			screenshotOptions: {
				fullPage: false,
				viewportWidth: 390,
				viewportHeight: 844,
				deviceScaleFactor: 2,
				format: 'jpeg',
				quality: 70,
				darkMode: true,
				selector: '#pricing',
			},
		},
		responses: [
			{
				status: 200,
				body: JPEG.toString('base64'),
				headers: textHeaders({ 'x-result-url': 'https://urlpipe.dev/r/abc.jpg' }),
			},
		],
	});

	assert.equal(requests[0].options.url, '/screenshot');
	assert.deepEqual(requests[0].options.body.screenshot_options, {
		full_page: false,
		viewport_width: 390,
		viewport_height: 844,
		device_scale_factor: 2,
		format: 'jpeg',
		quality: 70,
		dark_mode: true,
		selector: '#pricing',
	});

	const [item] = output;
	assert.equal(item.binary.image.mimeType, 'image/jpeg');
	assert.equal(item.binary.image.fileName, 'www.example.com.jpg');
	assert.equal(item.binary.image.data, JPEG.toString('base64'));
	assert.equal(item.json.resultUrl, 'https://urlpipe.dev/r/abc.jpg');
	assert.equal(item.json.mimeType, 'image/jpeg');
	assert.equal(item.json.token, 'tok_123');
	assert.equal(item.json.url, 'https://www.example.com/pricing');
});

test('the mime type comes from the image bytes: PNG and WebP', async () => {
	for (const [bytes, mimeType, extension] of [
		[PNG, 'image/png', 'png'],
		[WEBP, 'image/webp', 'webp'],
	]) {
		const { output } = await run({
			params: {
				resource: 'page',
				operation: 'screenshot',
				url: 'https://example.com',
				binaryPropertyName: 'data',
			},
			responses: [{ status: 200, body: bytes.toString('base64'), headers: textHeaders() }],
		});
		assert.equal(output[0].binary.data.mimeType, mimeType);
		assert.equal(output[0].binary.data.fileName, `example.com.${extension}`);
	}
});

test('Scrape sends the chosen operations and moves the screenshot into binary data', async () => {
	const scrape = {
		url: 'https://example.com',
		operations: {
			markdown: { success: true, result: '# Example', cached: false },
			screenshot: { success: true, result: PNG.toString('base64'), cached: true },
			summarize: { success: false, error: 'The page is too big to be processed.' },
		},
	};
	const { output, requests } = await run({
		params: {
			resource: 'page',
			operation: 'scrape',
			url: 'https://example.com',
			scrapeOperations: ['markdown', 'screenshot', 'summarize'],
			binaryPropertyName: 'data',
			device: 'desktop',
			includeAudits: true,
			screenshotOptions: { format: 'png' },
		},
		responses: [{ status: 200, body: scrape, headers: jsonHeaders({ 'x-cache': 'partial' }) }],
	});

	assert.equal(requests[0].options.url, '/scrape');
	// No lighthouse among the operations, so no device or audits are sent.
	assert.deepEqual(requests[0].options.body, {
		url: 'https://example.com',
		sync: true,
		operations: ['markdown', 'screenshot', 'summarize'],
		screenshot_options: { format: 'png' },
	});

	const [item] = output;
	assert.equal(item.json.operations.markdown.result, '# Example');
	assert.deepEqual(item.json.operations.screenshot.result, {
		binaryProperty: 'data',
		mimeType: 'image/png',
	});
	assert.equal(item.json.operations.summarize.error, 'The page is too big to be processed.');
	assert.equal(item.json.cache, 'partial');
	assert.equal(item.binary.data.fileName, 'example.com.png');
});

test('Scrape with a Lighthouse audit sends its device and audits option', async () => {
	const { requests } = await run({
		params: {
			resource: 'page',
			operation: 'scrape',
			url: 'https://example.com',
			scrapeOperations: ['lighthouse'],
			device: 'desktop',
			includeAudits: true,
		},
		responses: [
			{ status: 200, body: { url: 'https://example.com', operations: {} }, headers: jsonHeaders() },
		],
	});
	assert.deepEqual(requests[0].options.body, {
		url: 'https://example.com',
		sync: true,
		operations: ['lighthouse'],
		device: 'desktop',
		include_audits: true,
	});
});
