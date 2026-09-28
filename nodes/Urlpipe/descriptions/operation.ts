import type { INodeProperties } from 'n8n-workflow';

export const resourceProperty: INodeProperties = {
	displayName: 'Resource',
	name: 'resource',
	type: 'options',
	noDataExpression: true,
	options: [{ name: 'Page', value: 'page' }],
	default: 'page',
};

export const operationProperty: INodeProperties = {
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	displayOptions: { show: { resource: ['page'] } },
	options: [
		{
			name: 'Get Console Errors',
			value: 'console',
			description: 'List the errors, warnings and uncaught exceptions a page logs as it loads',
			action: 'Get console errors of page',
		},
		{
			name: 'Get Keywords',
			value: 'keywords',
			description: 'Pick out the keywords and topics of a page with AI',
			action: 'Get keywords of page',
		},
		{
			name: 'Get Markdown',
			value: 'markdown',
			description: "Convert a page's main content to clean Markdown, ready for an LLM",
			action: 'Get markdown of page',
		},
		{
			name: 'Get Metadata',
			value: 'meta',
			description: 'Read the title, description, language, main image, author and feed of a page',
			action: 'Get metadata of page',
		},
		{
			name: 'Get Rendered HTML',
			value: 'html',
			description: 'Get the HTML of a page after its JavaScript has run',
			action: 'Get rendered HTML of page',
		},
		{
			name: 'Get Result',
			value: 'getResult',
			description: 'Fetch the result of an earlier request by its token',
			action: 'Get result by token',
		},
		{
			name: 'Get Summary',
			value: 'summarize',
			description: 'Summarize a page with AI, as Markdown',
			action: 'Get summary of page',
		},
		{
			name: 'Run Lighthouse Audit',
			value: 'lighthouse',
			description: 'Score the performance, accessibility, best practices and SEO of a page',
			action: 'Run lighthouse audit on page',
		},
		{
			name: 'Scrape',
			value: 'scrape',
			description: 'Run several of these operations off a single page visit',
			action: 'Scrape page',
		},
		{
			name: 'Take Screenshot',
			value: 'screenshot',
			description: 'Capture a page as a PNG, JPEG or WebP image',
			action: 'Take screenshot of page',
		},
	],
	default: 'markdown',
};
