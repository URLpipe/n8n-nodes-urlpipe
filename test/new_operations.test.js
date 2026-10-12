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
			options: { blockPopups: true, scrollToBottom: true },
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
	assert.deepEqual(requests[0].options.body.page_options, { block_popups: true, scroll_to_bottom: true });

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

test('Scrape with a PDF and extracted data sends their options and moves the PDF into binary data', async () => {
	const fields = [{ name: 'price', type: 'number' }];
	const scrape = {
		url: 'https://example.com/shoe',
		operations: {
			pdf: { success: true, result: PDF.toString('base64'), cached: false },
			extract: { success: true, result: { price: 89.5 }, cached: false },
		},
	};
	const { output, requests } = await run({
		params: {
			resource: 'page',
			operation: 'scrape',
			url: 'https://example.com/shoe',
			scrapeOperations: ['pdf', 'extract'],
			binaryPropertyName: 'file',
			pdfOptions: { paperSize: 'letter' },
			extractFields: JSON.stringify(fields),
			instructions: 'Prices in euros.',
		},
		responses: [{ status: 200, body: scrape, headers: jsonHeaders() }],
	});

	assert.deepEqual(requests[0].options.body, {
		url: 'https://example.com/shoe',
		sync: true,
		operations: ['pdf', 'extract'],
		pdf_options: { paper_size: 'letter' },
		fields,
		instructions: 'Prices in euros.',
	});

	const [item] = output;
	assert.deepEqual(item.json.operations.extract.result, { price: 89.5 });
	assert.deepEqual(item.json.operations.pdf.result, {
		binaryProperty: 'file',
		mimeType: 'application/pdf',
	});
	assert.equal(item.binary.file.fileName, 'example.com.pdf');
});

test('Scrape with a screenshot and a PDF outputs both files', async () => {
	const PNG = Buffer.from('89504e470d0a1a0a', 'hex');
	const scrape = {
		url: 'https://example.com',
		operations: {
			screenshot: { success: true, result: PNG.toString('base64'), cached: false },
			pdf: { success: true, result: PDF.toString('base64'), cached: false },
		},
	};
	const { output, requests } = await run({
		params: {
			resource: 'page',
			operation: 'scrape',
			url: 'https://example.com',
			scrapeOperations: ['screenshot', 'pdf'],
			binaryPropertyName: 'data',
		},
		responses: [{ status: 200, body: scrape, headers: jsonHeaders() }],
	});

	// No extraction among the operations, so no fields are sent.
	assert.deepEqual(requests[0].options.body, {
		url: 'https://example.com',
		sync: true,
		operations: ['screenshot', 'pdf'],
	});
	assert.equal(output[0].binary.data.mimeType, 'image/png');
	assert.equal(output[0].binary.data_pdf.mimeType, 'application/pdf');
	assert.equal(output[0].json.operations.pdf.result.binaryProperty, 'data_pdf');
});

test('The extraction fields show for a Scrape only when it extracts', () => {
	const { NodeHelpers } = require('n8n-workflow');
	const { Urlpipe } = require('../dist/nodes/Urlpipe/Urlpipe.node.js');
	const node = { typeVersion: 1, parameters: {} };
	const shown = (parameters) =>
		new Urlpipe().description.properties
			.filter((property) => NodeHelpers.displayParameter(parameters, property, node, null))
			.map((property) => property.name);

	const scrape = { resource: 'page', operation: 'scrape' };
	const extracting = shown({ ...scrape, scrapeOperations: ['markdown', 'extract'] });
	assert.equal(extracting.filter((name) => name === 'extractFields').length, 1);
	assert.equal(extracting.filter((name) => name === 'instructions').length, 1);

	const names = new Set(shown({ ...scrape, scrapeOperations: ['markdown'] }));
	assert.equal(names.has('extractFields'), false);
	assert.equal(shown({ resource: 'page', operation: 'extract' }).includes('extractFields'), true);
});
