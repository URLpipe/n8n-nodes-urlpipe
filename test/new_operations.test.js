'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { run, runExpectingError, textHeaders, jsonHeaders } = require('./helpers');

const PDF = Buffer.from('%PDF-1.4\n%%EOF');

test('Get PDF sends the PDF options and outputs the file as binary data named after the host', async () => {
	const { output, requests } = await run({
		params: {
			resource: 'page',
			operation: 'pdf',
			url: 'https://www.example.com/invoice',
			binaryPropertyName: 'file',
			pdfOptions: {
				paperSize: 'letter',
				landscape: true,
				printBackground: false,
				scale: 80,
				margin: 0,
				media: 'screen',
				singlePage: false,
			},
			options: { blockPopups: true },
		},
		responses: [
			{
				status: 200,
				body: PDF.toString('base64'),
				headers: textHeaders({ 'x-result-url': 'https://urlpipe.dev/r/abc.pdf' }),
			},
		],
	});

	assert.equal(requests[0].options.url, '/pdf');
	assert.deepEqual(requests[0].options.body.pdf_options, {
		paper_size: 'letter',
		landscape: true,
		print_background: false,
		scale: 80,
		margin: 0,
		media: 'screen',
		single_page: false,
	});
	assert.deepEqual(requests[0].options.body.page_options, { block_popups: true });

	const [item] = output;
	assert.equal(item.binary.file.mimeType, 'application/pdf');
	assert.equal(item.binary.file.fileName, 'www.example.com.pdf');
	assert.equal(item.binary.file.data, PDF.toString('base64'));
	assert.equal(item.json.resultUrl, 'https://urlpipe.dev/r/abc.pdf');
	assert.equal(item.json.mimeType, 'application/pdf');
	assert.equal(item.json.token, 'tok_123');
});

test('Get Result shaped as Get PDF outputs the file', async () => {
	const { output } = await run({
		params: {
			resource: 'page',
			operation: 'getResult',
			resultId: 'tok_123',
			resultOptions: { originalOperation: 'pdf' },
		},
		responses: [{ status: 200, body: PDF.toString('base64'), headers: textHeaders() }],
	});
	assert.equal(output[0].binary.data.mimeType, 'application/pdf');
	assert.equal(output[0].binary.data.fileName, 'page.pdf');
});

test('Extract Data sends the fields and instructions and keeps the result under data', async () => {
	const fields = [
		{ name: 'name', type: 'string' },
		{ name: 'price', type: 'number', description: 'The current price' },
		{ name: 'token', type: 'string' },
	];
	const { output, requests } = await run({
		params: {
			resource: 'page',
			operation: 'extract',
			url: 'https://example.com/shoe',
			extractFields: JSON.stringify(fields),
			instructions: ' Prices in euros. ',
		},
		responses: [
			{
				status: 200,
				body: { name: 'Trail Shoe', price: 89.5, token: null },
				headers: jsonHeaders({ 'x-quota-cost': '24' }),
			},
		],
	});

	assert.equal(requests[0].options.url, '/extract');
	assert.deepEqual(requests[0].options.body, {
		url: 'https://example.com/shoe',
		sync: true,
		fields,
		instructions: 'Prices in euros.',
	});
	assert.deepEqual(output[0].json, {
		url: 'https://example.com/shoe',
		data: { name: 'Trail Shoe', price: 89.5, token: null },
		token: 'tok_123',
		finalUrl: null,
		cache: 'miss',
		credits: 24,
	});
});

test('Extract Data takes fields that an expression already parsed', async () => {
	const fields = [{ name: 'price', type: 'number' }];
	const { requests } = await run({
		params: {
			resource: 'page',
			operation: 'extract',
			url: 'https://example.com',
			extractFields: fields,
		},
		responses: [{ status: 200, body: { price: 1 }, headers: jsonHeaders() }],
	});
	assert.deepEqual(requests[0].options.body.fields, fields);
});

test('Extract Data without a list of fields says what to enter, and calls nothing', async () => {
	for (const extractFields of ['', '{ not json', '[]', '{"name": "price"}']) {
		const { error, requests } = await runExpectingError({
			params: { resource: 'page', operation: 'extract', url: 'https://example.com', extractFields },
		});
		assert.match(error.message, /'Fields' parameter is not a list of fields/);
		assert.equal(requests.length, 0);
	}
});

test('Detect Technologies outputs the result as the API sent it', async () => {
	const result = {
		final_url: 'https://example.com/',
		technologies: [{ name: 'WordPress', slug: 'wordpress', version: '6.4.2', confidence: 100 }],
	};
	const { output, requests } = await run({
		params: { resource: 'page', operation: 'technologies', url: 'https://example.com' },
		responses: [{ status: 200, body: result, headers: jsonHeaders() }],
	});
	assert.equal(requests[0].options.url, '/technologies');
	assert.deepEqual(output[0].json.technologies, result.technologies);
	assert.equal(output[0].json.url, 'https://example.com');
	assert.equal(output[0].json.token, 'tok_123');
});
