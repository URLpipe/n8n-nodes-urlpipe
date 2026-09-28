import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	IN8nHttpFullResponse,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeOperationError, sleep } from 'n8n-workflow';

import { BASE_URL, CREDENTIAL_NAME, REQUEST_TIMEOUT_MS, timing, USER_AGENT } from './constants';
import { apiError, parseBody } from './errors';

/** One HTTP answer from URLpipe, with the body left as the text that was sent. */
export interface RawResponse {
	statusCode: number;
	headers: Record<string, string>;
	text: string;
}

export type ResultStatus = 'completed' | 'accepted' | 'processing';

export interface OperationResult {
	status: ResultStatus;
	response: RawResponse;
	token?: string;
}

function normalizeHeaders(headers: unknown): Record<string, string> {
	const normalized: Record<string, string> = {};
	if (!headers || typeof headers !== 'object') return normalized;
	for (const [key, value] of Object.entries(headers as Record<string, unknown>)) {
		if (value === undefined || value === null) continue;
		normalized[key.toLowerCase()] = Array.isArray(value) ? value.join(', ') : String(value);
	}
	return normalized;
}

function bodyAsText(body: unknown): string {
	if (typeof body === 'string') return body;
	if (body === undefined || body === null) return '';
	if (Buffer.isBuffer(body)) return body.toString('utf8');
	return JSON.stringify(body);
}

async function send(
	ctx: IExecuteFunctions,
	method: IHttpRequestMethods,
	path: string,
	body: IDataObject | undefined,
	itemIndex: number,
): Promise<RawResponse> {
	const options: IHttpRequestOptions = {
		method,
		baseURL: BASE_URL,
		url: path,
		headers: { 'User-Agent': USER_AGENT, Accept: 'application/json, text/plain' },
		encoding: 'text',
		json: false,
		returnFullResponse: true,
		ignoreHttpStatusErrors: true,
		timeout: REQUEST_TIMEOUT_MS,
	};
	if (body !== undefined) {
		options.body = body;
		options.headers = { ...options.headers, 'Content-Type': 'application/json' };
	}

	let response: IN8nHttpFullResponse;
	try {
		response = (await ctx.helpers.httpRequestWithAuthentication.call(
			ctx,
			CREDENTIAL_NAME,
			options,
		)) as IN8nHttpFullResponse;
	} catch (error) {
		throw new NodeApiError(ctx.getNode(), error as JsonObject, {
			message: 'Could not reach URLpipe',
			description:
				'Check that this n8n instance can make outbound HTTPS requests to urlpipe.dev, then run the node again.',
			itemIndex,
		});
	}

	return {
		statusCode: response.statusCode,
		headers: normalizeHeaders(response.headers),
		text: bodyAsText(response.body),
	};
}

function retryAfterMs(response: RawResponse, body: IDataObject): number {
	const header = Number(response.headers['retry-after']);
	const fromBody = Number(body.retry_after);
	const seconds = Number.isFinite(header) ? header : Number.isFinite(fromBody) ? fromBody : 1;
	return Math.min(Math.max(seconds, 0) * 1000, timing.maxRetryAfterMs);
}

/**
 * Sends one request. A 429 "rate_limited" is retried once after the
 * Retry-After the API asks for; every other answer is returned as it came.
 * Broader retries are left to the node's own "Retry On Fail" setting.
 */
export async function urlpipeRequest(
	ctx: IExecuteFunctions,
	method: IHttpRequestMethods,
	path: string,
	body: IDataObject | undefined,
	itemIndex: number,
): Promise<RawResponse> {
	const response = await send(ctx, method, path, body, itemIndex);
	if (response.statusCode !== 429) return response;

	const parsed = parseBody(response.text);
	if (parsed.error !== 'rate_limited') return response;

	await sleep(retryAfterMs(response, parsed));
	return await send(ctx, method, path, body, itemIndex);
}

function tokenOf(response: RawResponse, body?: IDataObject): string | undefined {
	const fromBody = body && typeof body.token === 'string' ? body.token : undefined;
	return fromBody ?? response.headers['x-result-token'];
}

/** GET /result/:token once. A result still being worked on is not an error. */
export async function fetchResult(
	ctx: IExecuteFunctions,
	token: string,
	itemIndex: number,
): Promise<OperationResult> {
	const path = `/result/${encodeURIComponent(token)}`;
	const response = await urlpipeRequest(ctx, 'GET', path, undefined, itemIndex);

	if (response.statusCode === 200) return { status: 'completed', response, token };

	const body = parseBody(response.text);
	if (response.statusCode === 202) return { status: 'processing', response, token };
	if (response.statusCode === 504 && body.error === 'processing_timeout') {
		return { status: 'processing', response, token };
	}
	throw apiError(ctx, 'result', response, body, itemIndex);
}

/** Polls GET /result/:token until the result is ready or the timeout passes. */
export async function waitForResult(
	ctx: IExecuteFunctions,
	token: string,
	timeoutSeconds: number,
	itemIndex: number,
): Promise<OperationResult> {
	const deadline = Date.now() + timeoutSeconds * 1000;
	for (;;) {
		const result = await fetchResult(ctx, token, itemIndex);
		if (result.status === 'completed') return result;
		if (Date.now() + timing.pollIntervalMs > deadline) {
			throw new NodeOperationError(
				ctx.getNode(),
				`The result was not ready within ${timeoutSeconds} seconds`,
				{
					description: `URLpipe is still working on it. Fetch it later with the 'Get Result' operation and the token ${token}, or raise 'Wait Timeout' in the node's options.`,
					itemIndex,
				},
			);
		}
		await sleep(timing.pollIntervalMs);
	}
}

/**
 * POST /<operation>. A synchronous call the API answers with 504
 * "processing_timeout" is still running, so its token is polled until the
 * result is ready: the caller gets one result either way.
 */
export async function runOperation(
	ctx: IExecuteFunctions,
	operation: string,
	body: IDataObject,
	waitTimeoutSeconds: number,
	itemIndex: number,
): Promise<OperationResult> {
	const response = await urlpipeRequest(ctx, 'POST', `/${operation}`, body, itemIndex);

	if (response.statusCode === 200) {
		if (body.sync === true) return { status: 'completed', response, token: tokenOf(response) };
		const accepted = parseBody(response.text);
		return { status: 'accepted', response, token: tokenOf(response, accepted) };
	}

	const errorBody = parseBody(response.text);
	const token = tokenOf(response, errorBody);
	if (response.statusCode === 504 && errorBody.error === 'processing_timeout' && token) {
		return await waitForResult(ctx, token, waitTimeoutSeconds, itemIndex);
	}
	throw apiError(ctx, operation, response, errorBody, itemIndex);
}
