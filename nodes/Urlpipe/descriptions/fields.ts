import type { INodeProperties } from 'n8n-workflow';

const PAGE_OPERATIONS = [
	'markdown',
	'html',
	'summarize',
	'screenshot',
	'pdf',
	'meta',
	'keywords',
	'extract',
	'console',
	'technologies',
	'lighthouse',
	'scrape',
];

export const urlField: INodeProperties = {
	displayName: 'URL',
	name: 'url',
	type: 'string',
	required: true,
	default: '',
	placeholder: 'e.g. https://example.com',
	description:
		'The address of the page. It is opened in real Chrome, so JavaScript runs and redirects are followed.',
	displayOptions: { show: { resource: ['page'], operation: PAGE_OPERATIONS } },
};

export const tokenField: INodeProperties = {
	displayName: 'Token',
	name: 'resultId',
	type: 'string',
	required: true,
	default: '',
	description:
		"The token of an earlier request, from the 'token' field of its output or from a webhook delivery",
	displayOptions: { show: { resource: ['page'], operation: ['getResult'] } },
};

export const scrapeOperationsField: INodeProperties = {
	displayName: 'Operations',
	name: 'scrapeOperations',
	type: 'multiOptions',
	required: true,
	default: ['markdown', 'meta'],
	description: 'What to get from the page. Each one is billed as it would be on its own.',
	options: [
		{ name: 'Console Errors', value: 'console' },
		{ name: 'Keywords', value: 'keywords' },
		{ name: 'Lighthouse Audit', value: 'lighthouse' },
		{ name: 'Markdown', value: 'markdown' },
		{ name: 'Metadata', value: 'meta' },
		{ name: 'Rendered HTML', value: 'html' },
		{ name: 'Screenshot', value: 'screenshot' },
		{ name: 'Summary', value: 'summarize' },
		{ name: 'Technologies', value: 'technologies' },
	],
	displayOptions: { show: { resource: ['page'], operation: ['scrape'] } },
};

export const deviceField: INodeProperties = {
	displayName: 'Device',
	name: 'device',
	type: 'options',
	default: 'mobile',
	description:
		'The device the Lighthouse audit emulates. Mobile throttles the CPU and network, like a mid-range phone.',
	options: [
		{ name: 'Mobile', value: 'mobile' },
		{ name: 'Desktop', value: 'desktop' },
	],
	displayOptions: { show: { resource: ['page'], operation: ['lighthouse', 'scrape'] } },
};

export const includeAuditsField: INodeProperties = {
	displayName: 'Include Audits',
	name: 'includeAudits',
	type: 'boolean',
	default: false,
	description:
		'Whether to add the full list of 150+ Lighthouse audits, with the elements to fix, to the scores and metrics',
	displayOptions: { show: { resource: ['page'], operation: ['lighthouse', 'scrape'] } },
};

export const binaryPropertyField: INodeProperties = {
	displayName: 'Put Output File in Field',
	name: 'binaryPropertyName',
	type: 'string',
	required: true,
	default: 'data',
	hint: 'The name of the output binary field to put the screenshot or the PDF in',
	displayOptions: { show: { resource: ['page'], operation: ['screenshot', 'pdf', 'scrape'] } },
};

export const extractFieldsField: INodeProperties = {
	displayName: 'Fields',
	name: 'extractFields',
	type: 'json',
	required: true,
	default:
		'[\n  { "name": "title", "type": "string" },\n  { "name": "price", "type": "number", "description": "The current price, without the currency" }\n]',
	description:
		'The data to read off the page, as a JSON list of fields. Each has a name, a type (string, number, integer, boolean, date, datetime, URL, email, object or array) and optionally a description of what to take. An object has its own fields; an array has items. The output carries exactly these names, empty where the page gives no value.',
	displayOptions: { show: { resource: ['page'], operation: ['extract'] } },
};

export const instructionsField: INodeProperties = {
	displayName: 'Instructions',
	name: 'instructions',
	type: 'string',
	typeOptions: { rows: 2 },
	default: '',
	placeholder: 'e.g. Ignore the related products',
	description: 'Guidance for the extraction, in plain words',
	displayOptions: { show: { resource: ['page'], operation: ['extract'] } },
};

export const pdfOptionsField: INodeProperties = {
	displayName: 'PDF Options',
	name: 'pdfOptions',
	type: 'collection',
	placeholder: 'Add option',
	default: {},
	displayOptions: { show: { resource: ['page'], operation: ['pdf'] } },
	options: [
		{
			displayName: 'Landscape',
			name: 'landscape',
			type: 'boolean',
			default: false,
			description: 'Whether to turn the paper sideways',
		},
		{
			displayName: 'Margin',
			name: 'margin',
			type: 'number',
			default: 10,
			typeOptions: { minValue: 0, maxValue: 50 },
			description: 'The margin on every side in millimetres, from 0 to 50',
		},
		{
			displayName: 'Paper Size',
			name: 'paperSize',
			type: 'options',
			default: 'a4',
			options: [
				{ name: 'A3', value: 'a3' },
				{ name: 'A4', value: 'a4' },
				{ name: 'A5', value: 'a5' },
				{ name: 'Legal', value: 'legal' },
				{ name: 'Letter', value: 'letter' },
				{ name: 'Tabloid', value: 'tabloid' },
			],
		},
		{
			displayName: 'Print Backgrounds',
			name: 'printBackground',
			type: 'boolean',
			default: true,
			description: 'Whether to print background colours and images',
		},
		{
			displayName: 'Scale',
			name: 'scale',
			type: 'number',
			default: 100,
			typeOptions: { minValue: 10, maxValue: 200 },
			description: 'The scale of the page in percent, from 10 to 200',
		},
		{
			displayName: 'Single Page',
			name: 'singlePage',
			type: 'boolean',
			default: false,
			description:
				'Whether to make one page as tall as the document, instead of cutting it into sheets',
		},
		{
			displayName: 'Stylesheet',
			name: 'media',
			type: 'options',
			default: 'print',
			options: [
				{
					name: 'Print',
					value: 'print',
					description: "The page's print stylesheet, as a browser prints it",
				},
				{
					name: 'Screen',
					value: 'screen',
					description: 'The page as it looks in a browser window',
				},
			],
		},
	],
};

export const screenshotOptionsField: INodeProperties = {
	displayName: 'Screenshot Options',
	name: 'screenshotOptions',
	type: 'collection',
	placeholder: 'Add option',
	default: {},
	displayOptions: { show: { resource: ['page'], operation: ['screenshot', 'scrape'] } },
	options: [
		{
			displayName: 'Dark Mode',
			name: 'darkMode',
			type: 'boolean',
			default: false,
			description: 'Whether to render the page with its dark theme, if it has one',
		},
		{
			displayName: 'Element Selector',
			name: 'selector',
			type: 'string',
			default: '',
			placeholder: 'e.g. #pricing',
			description: 'A CSS selector: capture only the first element it matches instead of the page',
		},
		{
			displayName: 'Format',
			name: 'format',
			type: 'options',
			default: 'png',
			options: [
				{ name: 'PNG', value: 'png' },
				{ name: 'JPEG', value: 'jpeg' },
				{ name: 'WebP', value: 'webp' },
			],
			description: 'The image format. WebP is usually the smallest for a long page.',
		},
		{
			displayName: 'Full Page',
			name: 'fullPage',
			type: 'boolean',
			default: true,
			description: 'Whether to capture the whole page top to bottom, rather than only the viewport',
		},
		{
			displayName: 'Quality',
			name: 'quality',
			type: 'number',
			default: 80,
			typeOptions: { minValue: 1, maxValue: 100 },
			description: 'Image quality from 1 to 100, for JPEG and WebP. PNG is always lossless.',
		},
		{
			displayName: 'Scale',
			name: 'deviceScaleFactor',
			type: 'options',
			default: 1,
			options: [
				{ name: '1x', value: 1 },
				{ name: '2x (Retina)', value: 2 },
				{ name: '3x', value: 3 },
			],
			description: 'Pixel density. 2x renders a retina image at twice the width and height.',
		},
		{
			displayName: 'Viewport Height',
			name: 'viewportHeight',
			type: 'number',
			default: 797,
			typeOptions: { minValue: 240, maxValue: 1080 },
			description: 'Height of the browser window in pixels, from 240 to 1080',
		},
		{
			displayName: 'Viewport Width',
			name: 'viewportWidth',
			type: 'number',
			default: 1350,
			typeOptions: { minValue: 320, maxValue: 1920 },
			description:
				"Width of the browser window in pixels, from 320 to 1920. Use 390 for a phone's layout.",
		},
	],
};

export const fieldProperties: INodeProperties[] = [
	urlField,
	tokenField,
	scrapeOperationsField,
	deviceField,
	includeAuditsField,
	extractFieldsField,
	instructionsField,
	binaryPropertyField,
	screenshotOptionsField,
	pdfOptionsField,
];
