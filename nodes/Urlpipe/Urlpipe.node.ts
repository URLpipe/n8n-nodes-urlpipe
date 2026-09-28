import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { fieldProperties } from './descriptions/fields';
import { operationProperty, resourceProperty } from './descriptions/operation';
import { pageOptionsField, resultOptionsField } from './descriptions/options';
import type { PageOptions, ScreenshotOptions } from './shared/body';
import { buildBody } from './shared/body';
import type { Operation } from './shared/constants';
import { CREDENTIAL_NAME, DEFAULT_WAIT_TIMEOUT_SECONDS, OPERATIONS } from './shared/constants';
import { shapeCompleted, shapePending } from './shared/output';
import { fetchResult, runOperation, waitForResult } from './shared/transport';

interface ResultOptions {
	originalOperation?: Operation | 'auto';
	binaryPropertyName?: string;
	waitUntilReady?: boolean;
	waitTimeout?: number;
}

async function runPageOperation(
	ctx: IExecuteFunctions,
	operation: Operation,
	itemIndex: number,
): Promise<INodeExecutionData> {
	const url = ctx.getNodeParameter('url', itemIndex) as string;
	if (!url.trim()) {
		throw new NodeOperationError(ctx.getNode(), "The 'URL' parameter is empty", {
			description: 'Enter the address of the page, such as https://example.com.',
			itemIndex,
		});
	}
	const options = ctx.getNodeParameter('options', itemIndex, {}) as PageOptions;
	const withScreenshot = operation === 'screenshot' || operation === 'scrape';
	const withLighthouse = operation === 'lighthouse' || operation === 'scrape';

	const scrapeOperations =
		operation === 'scrape'
			? (ctx.getNodeParameter('scrapeOperations', itemIndex, []) as string[])
			: undefined;
	if (scrapeOperations && scrapeOperations.length === 0) {
		throw new NodeOperationError(ctx.getNode(), "No operations are selected in 'Operations'", {
			description: 'Pick at least one thing to get from the page, such as Markdown.',
			itemIndex,
		});
	}

	const body = buildBody({
		operation,
		url,
		options,
		scrapeOperations,
		device: withLighthouse
			? (ctx.getNodeParameter('device', itemIndex, 'mobile') as string)
			: undefined,
		includeAudits: withLighthouse
			? (ctx.getNodeParameter('includeAudits', itemIndex, false) as boolean)
			: undefined,
		screenshotOptions: withScreenshot
			? (ctx.getNodeParameter('screenshotOptions', itemIndex, {}) as ScreenshotOptions)
			: undefined,
	});

	const waitTimeout = options.waitTimeout ?? DEFAULT_WAIT_TIMEOUT_SECONDS;
	const result = await runOperation(ctx, operation, body, waitTimeout, itemIndex);
	const pageUrl = body.url as string;
	if (result.status !== 'completed') return shapePending(result, pageUrl, itemIndex);

	const binaryPropertyName = withScreenshot
		? (ctx.getNodeParameter('binaryPropertyName', itemIndex, 'data') as string)
		: 'data';
	return await shapeCompleted(ctx, {
		operation,
		result,
		url: pageUrl,
		binaryPropertyName,
		itemIndex,
	});
}

async function runGetResult(
	ctx: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData> {
	const token = (ctx.getNodeParameter('resultId', itemIndex) as string).trim();
	if (!token) {
		throw new NodeOperationError(ctx.getNode(), "The 'Token' parameter is empty", {
			description: "Map the 'token' field from the node that started the request.",
			itemIndex,
		});
	}
	const options = ctx.getNodeParameter('resultOptions', itemIndex, {}) as ResultOptions;

	const result = options.waitUntilReady
		? await waitForResult(
				ctx,
				token,
				options.waitTimeout ?? DEFAULT_WAIT_TIMEOUT_SECONDS,
				itemIndex,
			)
		: await fetchResult(ctx, token, itemIndex);
	if (result.status !== 'completed') return shapePending(result, undefined, itemIndex);

	return await shapeCompleted(ctx, {
		operation: options.originalOperation ?? 'auto',
		result,
		binaryPropertyName: options.binaryPropertyName || 'data',
		itemIndex,
	});
}

export class Urlpipe implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'URLpipe',
		name: 'urlpipe',
		icon: { light: 'file:../../icons/urlpipe.svg', dark: 'file:../../icons/urlpipe.dark.svg' },
		group: ['transform'],
		version: [1],
		subtitle:
			'={{ {"console": "Get Console Errors", "keywords": "Get Keywords", "markdown": "Get Markdown", "meta": "Get Metadata", "html": "Get Rendered HTML", "getResult": "Get Result", "summarize": "Get Summary", "lighthouse": "Run Lighthouse Audit", "scrape": "Scrape", "screenshot": "Take Screenshot"}[$parameter["operation"]] }}',
		description:
			'Turn any URL into Markdown, a screenshot, metadata, console errors or a Lighthouse audit, rendered in real Chrome',
		defaults: {
			name: 'URLpipe',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [
			{
				name: CREDENTIAL_NAME,
				required: true,
			},
		],
		properties: [
			resourceProperty,
			operationProperty,
			...fieldProperties,
			pageOptionsField,
			resultOptionsField,
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const operation = this.getNodeParameter('operation', itemIndex) as string;
				if (operation === 'getResult') {
					returnData.push(await runGetResult(this, itemIndex));
				} else if ((OPERATIONS as string[]).includes(operation)) {
					returnData.push(await runPageOperation(this, operation as Operation, itemIndex));
				} else {
					throw new NodeOperationError(
						this.getNode(),
						`The operation "${operation}" is not known`,
						{
							itemIndex,
						},
					);
				}
			} catch (error) {
				if (this.continueOnFail()) {
					const json: IDataObject = { error: (error as Error).message };
					const description = (error as { description?: unknown }).description;
					if (typeof description === 'string') json.description = description;
					returnData.push({ json, pairedItem: { item: itemIndex } });
					continue;
				}
				const failure =
					error instanceof NodeApiError || error instanceof NodeOperationError
						? error
						: new NodeOperationError(this.getNode(), error as Error, { itemIndex });
				throw failure;
			}
		}

		return [returnData];
	}
}
