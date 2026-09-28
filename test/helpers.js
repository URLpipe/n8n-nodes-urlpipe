'use strict';

// A stand-in for n8n's IExecuteFunctions: node parameters come from a plain
// object, and HTTP answers are queued in advance. Only URLpipe's HTTP API is
// faked; the node's own code runs as built in dist/.

const { Urlpipe } = require('../dist/nodes/Urlpipe/Urlpipe.node.js');
const constants = require('../dist/nodes/Urlpipe/shared/constants.js');

constants.timing.pollIntervalMs = 5;
constants.timing.maxRetryAfterMs = 10;

function lookup(object, path) {
	return path.split('.').reduce((value, key) => (value == null ? undefined : value[key]), object);
}

/**
 * @param {object} setup
 * @param {object | object[]} setup.params node parameters, or one object per item
 * @param {Array<object | Error> | (() => object)} setup.responses queued answers: { status, body, headers }
 * @param {number} [setup.items] how many input items (default: one per params entry)
 * @param {boolean} [setup.continueOnFail]
 */
function createContext({ params, responses = [], items, continueOnFail = false }) {
	const perItem = Array.isArray(params) ? params : null;
	const count = items ?? (perItem ? perItem.length : 1);
	const requests = [];

	const nextResponse = () => {
		if (typeof responses === 'function') return responses(requests.length - 1);
		if (responses.length === 0) throw new Error('No response queued for this request');
		return responses.shift();
	};

	const ctx = {
		getInputData: () => Array.from({ length: count }, (_, i) => ({ json: { index: i } })),
		getNodeParameter(name, itemIndex, fallback) {
			const source = perItem ? perItem[itemIndex] : params;
			const value = lookup(source, name);
			if (value !== undefined) return value;
			if (fallback !== undefined) return fallback;
			throw new Error(`Missing parameter ${name}`);
		},
		getNode: () => ({
			id: 'test-node',
			name: 'URLpipe',
			type: 'n8n-nodes-urlpipe.urlpipe',
			typeVersion: 1,
			position: [0, 0],
			parameters: {},
		}),
		continueOnFail: () => continueOnFail,
		helpers: {
			async httpRequestWithAuthentication(credentialName, options) {
				requests.push({ credentialName, options });
				const answer = nextResponse();
				if (answer instanceof Error) throw answer;
				const body =
					answer.body !== undefined && typeof answer.body !== 'string'
						? JSON.stringify(answer.body)
						: (answer.body ?? '');
				return { statusCode: answer.status, headers: answer.headers ?? {}, body };
			},
			async prepareBinaryData(buffer, fileName, mimeType) {
				return {
					data: buffer.toString('base64'),
					fileName,
					mimeType,
					fileSize: `${buffer.length} B`,
				};
			},
		},
	};

	return { ctx, requests };
}

async function run(setup) {
	const { ctx, requests } = createContext(setup);
	const [output] = await new Urlpipe().execute.call(ctx);
	return { output, requests };
}

async function runExpectingError(setup) {
	const { ctx, requests } = createContext(setup);
	try {
		await new Urlpipe().execute.call(ctx);
	} catch (error) {
		return { error, requests };
	}
	throw new Error('Expected the node to throw');
}

const textHeaders = (extra = {}) => ({
	'content-type': 'text/plain; charset=utf-8',
	'x-result-token': 'tok_123',
	'x-cache': 'miss',
	'x-quota-cost': '1',
	...extra,
});

const jsonHeaders = (extra = {}) => ({
	...textHeaders(extra),
	'content-type': 'application/json',
});

// Smallest possible images, enough for the magic-byte check.
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46]);
const WEBP = Buffer.concat([
	Buffer.from('RIFF'),
	Buffer.from([0, 0, 0, 0]),
	Buffer.from('WEBPVP8 '),
]);

module.exports = {
	constants,
	createContext,
	run,
	runExpectingError,
	textHeaders,
	jsonHeaders,
	PNG,
	JPEG,
	WEBP,
};
