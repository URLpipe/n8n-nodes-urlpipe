import type { IBinaryData, IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import type { Operation } from './constants';
import { parseBody } from './errors';
import type { OperationResult, RawResponse } from './transport';

const TEXT_FIELDS: Partial<Record<Operation, string>> = {
	markdown: 'markdown',
	html: 'html',
	summarize: 'summary',
};

/** What the response headers say about the request: its token, cache verdict and cost. */
function requestFacts(result: OperationResult): IDataObject {
	const { headers } = result.response;
	const cost = Number(headers['x-quota-cost']);
	return {
		token: result.token ?? headers['x-result-token'] ?? null,
		cache: headers['x-cache'] ?? null,
		credits: Number.isFinite(cost) ? cost : null,
	};
}

function parseJson(response: RawResponse, ctx: IExecuteFunctions, itemIndex: number): unknown {
	try {
		return JSON.parse(response.text) as unknown;
	} catch {
		throw new NodeOperationError(ctx.getNode(), 'URLpipe sent a result that is not valid JSON', {
			description:
				"If this token came from a text operation, set 'Original Operation' to it in the options.",
			itemIndex,
		});
	}
}

export function mimeTypeOf(image: Buffer): string {
	if (image.length >= 3 && image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff) {
		return 'image/jpeg';
	}
	if (
		image.length >= 12 &&
		image.toString('ascii', 0, 4) === 'RIFF' &&
		image.toString('ascii', 8, 12) === 'WEBP'
	) {
		return 'image/webp';
	}
	return 'image/png';
}

const EXTENSIONS: Record<string, string> = {
	'image/png': 'png',
	'image/jpeg': 'jpg',
	'image/webp': 'webp',
};

/** A file name from the page's host, e.g. "example.com.png". */
export function fileNameFor(url: string | undefined, mimeType: string): string {
	let base = 'screenshot';
	if (url) {
		try {
			base = new URL(url).hostname || base;
		} catch {
			// Not a parseable URL: keep the generic name.
		}
	}
	return `${base}.${EXTENSIONS[mimeType] ?? 'png'}`;
}

async function screenshotBinary(
	ctx: IExecuteFunctions,
	base64: string,
	url: string | undefined,
): Promise<IBinaryData> {
	const image = Buffer.from(base64.trim(), 'base64');
	const mimeType = mimeTypeOf(image);
	return await ctx.helpers.prepareBinaryData(image, fileNameFor(url, mimeType), mimeType);
}

export interface ShapeInput {
	operation: Operation | 'auto';
	result: OperationResult;
	url?: string;
	binaryPropertyName: string;
	itemIndex: number;
}

function withUrl(url: string | undefined, fields: IDataObject): IDataObject {
	return url === undefined ? fields : { url, ...fields };
}

/** Turns a completed result into the node's output item, typed by its operation. */
export async function shapeCompleted(
	ctx: IExecuteFunctions,
	input: ShapeInput,
): Promise<INodeExecutionData> {
	const { operation, result, url, binaryPropertyName, itemIndex } = input;
	const { response } = result;
	const facts = requestFacts(result);
	const pairedItem = { item: itemIndex };

	const textField = operation === 'auto' ? undefined : TEXT_FIELDS[operation];
	if (textField) {
		return { json: withUrl(url, { [textField]: response.text, ...facts }), pairedItem };
	}

	if (operation === 'screenshot') {
		const binary = await screenshotBinary(ctx, response.text, url);
		return {
			json: withUrl(url, {
				resultUrl: response.headers['x-result-url'] ?? null,
				mimeType: binary.mimeType,
				fileName: binary.fileName ?? null,
				fileSize: binary.fileSize ?? null,
				...facts,
			}),
			binary: { [binaryPropertyName]: binary },
			pairedItem,
		};
	}

	if (operation === 'auto') {
		const trimmed = response.text.trim();
		const looksJson = trimmed.startsWith('{') || trimmed.startsWith('[');
		const data = looksJson ? parseJson(response, ctx, itemIndex) : response.text;
		const json =
			data && typeof data === 'object' && !Array.isArray(data)
				? { ...(data as IDataObject), ...facts }
				: { result: data as IDataObject[] | string, ...facts };
		return { json, pairedItem };
	}

	const data = parseJson(response, ctx, itemIndex);

	if (operation === 'keywords') {
		return { json: withUrl(url, { keywords: data as string[], ...facts }), pairedItem };
	}

	if (operation === 'console') {
		const entries = Array.isArray(data) ? (data as IDataObject[]) : [];
		const errorCount = entries.filter((entry) => entry.type !== 'warning').length;
		return {
			json: withUrl(url, {
				entries,
				errorCount,
				warningCount: entries.length - errorCount,
				...facts,
			}),
			pairedItem,
		};
	}

	const object = (data && typeof data === 'object' ? data : {}) as IDataObject;

	if (operation === 'scrape') {
		return await shapeScrape(ctx, object, facts, url, binaryPropertyName, itemIndex);
	}

	// meta and lighthouse: the object as the API sent it.
	return { json: { ...withUrl(url, {}), ...object, ...facts }, pairedItem };
}

/** A scrape's screenshot moves out of the JSON and into a binary field. */
async function shapeScrape(
	ctx: IExecuteFunctions,
	object: IDataObject,
	facts: IDataObject,
	url: string | undefined,
	binaryPropertyName: string,
	itemIndex: number,
): Promise<INodeExecutionData> {
	const pageUrl = typeof object.url === 'string' ? object.url : url;
	const operations = { ...((object.operations as IDataObject | undefined) ?? {}) };
	const screenshot = operations.screenshot as IDataObject | undefined;
	const item: INodeExecutionData = {
		json: { ...object, operations, ...facts },
		pairedItem: { item: itemIndex },
	};

	if (screenshot?.success === true && typeof screenshot.result === 'string') {
		const binary = await screenshotBinary(ctx, screenshot.result, pageUrl);
		operations.screenshot = {
			...screenshot,
			result: { binaryProperty: binaryPropertyName, mimeType: binary.mimeType },
		};
		item.binary = { [binaryPropertyName]: binary };
	}
	return item;
}

/** The output when the result is not ready yet, or was not waited for. */
export function shapePending(
	result: OperationResult,
	url: string | undefined,
	itemIndex: number,
): INodeExecutionData {
	const body = parseBody(result.response.text);
	const labels = body.labels && typeof body.labels === 'object' ? body.labels : {};
	return {
		json: withUrl(url, {
			token: result.token ?? null,
			status: result.status,
			labels: labels as IDataObject,
		}),
		pairedItem: { item: itemIndex },
	};
}
