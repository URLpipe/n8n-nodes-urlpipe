import type { IDataObject, IExecuteFunctions, JsonObject } from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

import type { RawResponse } from './transport';

const CODE_PATTERN = /^[a-z][a-z0-9_]*$/;

/** Parses a JSON body; anything else comes back as `{ error: <text> }`. */
export function parseBody(text: string): IDataObject {
	const trimmed = text.trim();
	if (trimmed.startsWith('{')) {
		try {
			const parsed = JSON.parse(trimmed) as unknown;
			if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
				return parsed as IDataObject;
			}
		} catch {
			// Not JSON after all: fall through and keep the text.
		}
	}
	return trimmed ? { error: trimmed } : {};
}

function stringField(body: IDataObject, key: string): string | undefined {
	const value = body[key];
	return typeof value === 'string' && value.trim() ? value : undefined;
}

/** The body's `error` when it is a machine code such as `invalid_url`. */
function errorCode(body: IDataObject): string | undefined {
	const error = stringField(body, 'error');
	return error && CODE_PATTERN.test(error) ? error : undefined;
}

/** The API's own sentence: `message`, else an `error` that is a sentence. */
function apiMessage(body: IDataObject): string | undefined {
	const message = stringField(body, 'message');
	if (message) return message;
	const error = stringField(body, 'error');
	return error && !CODE_PATTERN.test(error) ? error : undefined;
}

function scrapeFailures(body: IDataObject): string | undefined {
	const operations = body.operations;
	if (!operations || typeof operations !== 'object' || Array.isArray(operations)) return undefined;
	const parts = Object.entries(operations as IDataObject).map(([name, entry]) => {
		const error = entry && typeof entry === 'object' ? (entry as IDataObject).error : undefined;
		return `${name}: ${typeof error === 'string' ? error : 'failed'}`;
	});
	return parts.length ? `Every operation failed: ${parts.join('; ')}` : undefined;
}

const VALIDATION_HINTS: Record<string, string> = {
	invalid_url:
		"Check the 'URL' parameter: it must be a full http or https address on a public domain, with no username, password or custom port.",
	invalid_max_age:
		"Check 'Max Age' in the options: use a number of seconds (3600) or a duration such as 2 hours or 3 days.",
	invalid_options:
		'Check the page and screenshot options: the message above names the value that is out of range.',
	invalid_labels:
		"Check 'Labels' in the options: up to 16 labels, each with a name and a text value.",
	invalid_idempotency_key: 'Send a key of 1 to 255 printable characters, with no spaces.',
	idempotency_key_reused: 'Send a new key for a new request.',
};

interface Explained {
	message: string;
	description: string;
}

function quotaDescription(body: IDataObject): string {
	const resetsAt = stringField(body, 'resets_at');
	const reset = resetsAt ? `Your credits reset on ${resetsAt.slice(0, 10)}. ` : '';
	return `${reset}Add a card in the URLpipe dashboard to keep going past the free allowance. Results served from the cache are free, so a longer 'Max Age' also saves credits.`;
}

function explain(statusCode: number, body: IDataObject, operation: string): Explained {
	const code = errorCode(body);
	const own = apiMessage(body);

	if (statusCode === 401) {
		return {
			message: own ?? 'URLpipe did not accept the API key',
			description:
				'Open the URLpipe credential and paste the project API key from the URLpipe dashboard again.',
		};
	}
	if (statusCode === 403 && code === 'email_unverified') {
		return {
			message: 'The email address on the URLpipe account is not confirmed yet',
			description:
				'Click the confirmation link URLpipe emailed you. To get a new one, sign in and use Account Settings → Send a confirmation link. The API key itself is fine.',
		};
	}
	if (statusCode === 404) {
		return {
			message: 'No result was found for this token',
			description:
				'Check the token. Results belong to the project whose API key started the request, so use the same credential.',
		};
	}
	if (statusCode === 410) {
		return {
			message: own ?? 'This result is older than the 30-day retention window',
			description: 'Run the operation again to get a fresh result.',
		};
	}
	if (statusCode === 422) {
		if (code && VALIDATION_HINTS[code]) {
			return { message: own ?? code, description: VALIDATION_HINTS[code] };
		}
		const reportTo = stringField(body, 'error');
		if (reportTo?.startsWith('report_to')) {
			return {
				message: own ?? reportTo,
				description:
					"Check 'Report To' in the options: it must be a public http or https address on the default port, such as an n8n Webhook node's production URL.",
			};
		}
		const failed = operation === 'scrape' ? scrapeFailures(body) : undefined;
		return {
			message: failed ?? own ?? 'URLpipe could not analyze this page',
			description: 'The message above says what stopped it. Requests that fail cost no credits.',
		};
	}
	if (statusCode === 429 && code === 'quota_exceeded') {
		return {
			message: own ?? 'The monthly credits for this URLpipe account are used up',
			description: quotaDescription(body),
		};
	}
	if (statusCode === 429 && code === 'concurrency_limit') {
		return {
			message: own ?? 'Too many URLpipe requests are running at once',
			description: `Your plan runs ${String(body.limit ?? 'a limited number of')} requests at a time. Turn on 'Retry On Fail' in the node settings, or send fewer items at once with a Loop Over Items node.`,
		};
	}
	if (statusCode === 429 && code === 'rate_limited') {
		return {
			message: own ?? 'URLpipe is receiving requests from this project too fast',
			description:
				"The API takes 60 requests a minute per project. Turn on 'Retry On Fail' in the node settings, or add a Wait node between batches.",
		};
	}
	if (statusCode >= 500) {
		return {
			message: own ?? 'URLpipe could not complete the request',
			description:
				"Run the node again in a moment. 'Retry On Fail' in the node settings does this for you.",
		};
	}
	return {
		message: own ?? code ?? `URLpipe answered with HTTP ${statusCode}`,
		description: 'See https://urlpipe.dev/docs/errors for what this answer means.',
	};
}

/** Turns a non-success answer into a NodeApiError with a message and a way forward. */
export function apiError(
	ctx: IExecuteFunctions,
	operation: string,
	response: RawResponse,
	body: IDataObject,
	itemIndex: number,
): NodeApiError {
	const { message, description } = explain(response.statusCode, body, operation);
	return new NodeApiError(ctx.getNode(), body as JsonObject, {
		message,
		description,
		httpCode: String(response.statusCode),
		itemIndex,
	});
}
