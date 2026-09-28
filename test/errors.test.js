'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { run, runExpectingError, textHeaders } = require('./helpers');

const markdown = { resource: 'page', operation: 'markdown', url: 'https://example.com' };

async function failWith(answer, params = markdown) {
	const { error } = await runExpectingError({ params, responses: [answer] });
	return error;
}

test('401 becomes a NodeApiError that points at the credential', async () => {
	const error = await failWith({
		status: 401,
		body: { error: 'invalid_api_key', message: 'The API key is not valid.' },
	});
	assert.equal(error.name, 'NodeApiError');
	assert.equal(error.httpCode, '401');
	assert.equal(error.message, 'The API key is not valid.');
	assert.match(error.description, /credential/);
});

test('403 email_unverified asks for the email confirmation', async () => {
	const error = await failWith({
		status: 403,
		body: { error: 'email_unverified', message: 'Confirm the email address on this account.' },
	});
	assert.equal(error.httpCode, '403');
	assert.equal(error.message, 'The email address on the URLpipe account is not confirmed yet');
	assert.match(error.description, /confirmation link/);
});

test('422 invalid_url keeps the API message and names the URL parameter', async () => {
	const error = await failWith({
		status: 422,
		body: { error: 'invalid_url', message: 'The url must be a public http or https address.' },
	});
	assert.equal(error.message, 'The url must be a public http or https address.');
	assert.match(error.description, /'URL' parameter/);
});

test('422 with a sentence is the reason the page could not be analyzed', async () => {
	const error = await failWith({ status: 422, body: { error: 'The request timed out.' } });
	assert.equal(error.message, 'The request timed out.');
	assert.match(error.description, /cost no credits/);
});

test('a scrape where every operation failed lists each failure', async () => {
	const error = await failWith(
		{
			status: 422,
			body: {
				url: 'https://example.com',
				operations: {
					markdown: { success: false, error: 'The page could not be loaded.' },
					meta: { success: false, error: 'The page could not be loaded.' },
				},
			},
		},
		{ ...markdown, operation: 'scrape', scrapeOperations: ['markdown', 'meta'] },
	);
	assert.equal(
		error.message,
		'Every operation failed: markdown: The page could not be loaded.; meta: The page could not be loaded.',
	);
});

test('429 quota_exceeded says when the credits reset', async () => {
	const error = await failWith({
		status: 429,
		body: {
			error: 'quota_exceeded',
			message: 'This organization has used its 1000 monthly credits.',
			limit: 1000,
			used: 1000,
			needed: 1,
			resets_at: '2026-10-01T00:00:00Z',
		},
	});
	assert.equal(error.httpCode, '429');
	assert.equal(error.message, 'This organization has used its 1000 monthly credits.');
	assert.match(error.description, /reset on 2026-10-01/);
});

test('429 concurrency_limit suggests Retry On Fail', async () => {
	const error = await failWith({
		status: 429,
		body: {
			error: 'concurrency_limit',
			message: 'Too many requests running.',
			limit: 2,
			running: 2,
		},
	});
	assert.match(error.description, /runs 2 requests at a time/);
	assert.match(error.description, /Retry On Fail/);
});

test('429 rate_limited is retried once after Retry-After, then succeeds', async () => {
	const { output, requests } = await run({
		params: markdown,
		responses: [
			{
				status: 429,
				body: { error: 'rate_limited', message: 'Slow down.', retry_after: 1 },
				headers: { 'retry-after': '0' },
			},
			{ status: 200, body: '# Example', headers: textHeaders() },
		],
	});
	assert.equal(requests.length, 2);
	assert.deepEqual(requests[1].options.body, requests[0].options.body);
	assert.equal(output[0].json.markdown, '# Example');
});

test('a second rate_limited in a row is reported', async () => {
	const limited = {
		status: 429,
		body: { error: 'rate_limited', message: 'Slow down.' },
		headers: { 'retry-after': '0' },
	};
	const { error, requests } = await runExpectingError({
		params: markdown,
		responses: [limited, { ...limited }],
	});
	assert.equal(requests.length, 2);
	assert.equal(error.message, 'Slow down.');
	assert.match(error.description, /60 requests a minute/);
});

test('Get Result 404 and 410 explain what to do next', async () => {
	const getResult = { resource: 'page', operation: 'getResult', resultId: 'tok_x' };

	const missing = await failWith({ status: 404, body: { error: 'not_found' } }, getResult);
	assert.equal(missing.message, 'No result was found for this token');
	assert.equal(missing.httpCode, '404');

	const stale = await failWith(
		{
			status: 410,
			body: { error: 'stale', message: 'This result is older than the 30-day retention window.' },
		},
		getResult,
	);
	assert.equal(stale.message, 'This result is older than the 30-day retention window.');
	assert.match(stale.description, /Run the operation again/);
});

test('a 5xx with a plain-text body still becomes a NodeApiError', async () => {
	const error = await failWith({ status: 502, body: 'Bad Gateway' });
	assert.equal(error.name, 'NodeApiError');
	assert.equal(error.message, 'Bad Gateway');
	assert.match(error.description, /Retry On Fail/);
});

test('a network failure becomes a NodeApiError about reaching URLpipe', async () => {
	const error = await failWith(Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' }));
	assert.equal(error.name, 'NodeApiError');
	assert.match(error.description, /urlpipe\.dev/);
});

test('with Continue On Fail, a failed item becomes an error item and the rest run', async () => {
	const { output } = await run({
		continueOnFail: true,
		params: [markdown, { ...markdown, url: 'https://example.org' }],
		responses: [
			{ status: 422, body: { error: 'The requested page was not found.' } },
			{ status: 200, body: '# Org', headers: textHeaders() },
		],
	});
	assert.equal(output.length, 2);
	assert.equal(output[0].json.error, 'The requested page was not found.');
	assert.match(output[0].json.description, /cost no credits/);
	assert.deepEqual(output[0].pairedItem, { item: 0 });
	assert.equal(output[1].json.markdown, '# Org');
	assert.deepEqual(output[1].pairedItem, { item: 1 });
});

test('an empty URL is reported before any request is sent', async () => {
	const { error, requests } = await runExpectingError({
		params: { ...markdown, url: '  ' },
		responses: [],
	});
	assert.equal(error.name, 'NodeOperationError');
	assert.equal(error.message, "The 'URL' parameter is empty");
	assert.equal(requests.length, 0);
});
