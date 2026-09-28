import type { INodeProperties } from 'n8n-workflow';

import { DEFAULT_WAIT_TIMEOUT_SECONDS } from '../shared/constants';

const waitTimeoutOption: INodeProperties = {
	displayName: 'Wait Timeout',
	name: 'waitTimeout',
	type: 'number',
	default: DEFAULT_WAIT_TIMEOUT_SECONDS,
	typeOptions: { minValue: 1 },
	description:
		'While waiting for a result: how many seconds to keep checking on one that takes longer than a minute, such as a Lighthouse audit, before giving up',
};

export const pageOptionsField: INodeProperties = {
	displayName: 'Options',
	name: 'options',
	type: 'collection',
	placeholder: 'Add option',
	default: {},
	displayOptions: {
		show: {
			resource: ['page'],
			operation: [
				'markdown',
				'html',
				'summarize',
				'screenshot',
				'meta',
				'keywords',
				'console',
				'lighthouse',
				'scrape',
			],
		},
	},
	options: [
		{
			displayName: 'Block Ads',
			name: 'blockAds',
			type: 'boolean',
			default: false,
			description:
				'Whether to block the major ad networks and remove their slots before the page is read. Pages with ads usually load much faster.',
			displayOptions: { hide: { '/operation': ['lighthouse'] } },
		},
		{
			displayName: 'Block Cookie Banners',
			name: 'blockCookieBanners',
			type: 'boolean',
			default: false,
			description:
				'Whether to remove cookie-consent banners and their policy text from the page. Nothing is clicked, so no consent is given.',
			displayOptions: { hide: { '/operation': ['lighthouse'] } },
		},
		{
			displayName: 'Labels',
			name: 'labels',
			type: 'fixedCollection',
			placeholder: 'Add label',
			default: {},
			typeOptions: { multipleValues: true },
			description:
				'Your own tags for this request, such as a client or a campaign. The URLpipe dashboard filters history and totals credits by them.',
			options: [
				{
					displayName: 'Label',
					name: 'label',
					values: [
						{
							displayName: 'Name',
							name: 'name',
							type: 'string',
							default: '',
							placeholder: 'e.g. client',
						},
						{
							displayName: 'Value',
							name: 'value',
							type: 'string',
							default: '',
							placeholder: 'e.g. acme',
						},
					],
				},
			],
		},
		{
			displayName: 'Max Age',
			name: 'maxAge',
			type: 'string',
			default: '',
			placeholder: 'e.g. 3 days',
			description:
				'How fresh a stored result must be to be reused for free: seconds (3600) or a duration such as 2 hours or 3 days. Leave empty for 7 days; 0 always loads the page again.',
		},
		{
			displayName: 'Report To',
			name: 'reportTo',
			type: 'string',
			default: '',
			placeholder: 'e.g. https://n8n.example.com/webhook/urlpipe',
			description:
				"A URL that URLpipe posts the result to when it is ready. The production URL of an n8n Webhook node works: that workflow then starts with the result. It must be a public address on the default port. Leave empty to use the project's default webhook, if it has one.",
			displayOptions: { show: { waitForResult: [false] } },
		},
		{
			displayName: 'Residential',
			name: 'residential',
			type: 'boolean',
			default: false,
			description:
				'Whether to load the page from a residential address instead of a datacentre one, for sites that serve a datacentre less than they serve a browser. Adds 25 credits per page visit.',
		},
		{
			displayName: 'Wait for Result',
			name: 'waitForResult',
			type: 'boolean',
			default: true,
			description:
				"Whether to wait for the result and output it. Turn it off to get a token right away and collect the result later, with 'Get Result' or at a webhook.",
		},
		{
			displayName: 'Wait for Selector',
			name: 'waitForSelector',
			type: 'string',
			default: '',
			placeholder: 'e.g. #content',
			description:
				'A CSS selector to wait for, up to 10 seconds, before the page is read. For pages whose content arrives after they load.',
			displayOptions: { hide: { '/operation': ['lighthouse'] } },
		},
		waitTimeoutOption,
	],
};

export const resultOptionsField: INodeProperties = {
	displayName: 'Options',
	name: 'resultOptions',
	type: 'collection',
	placeholder: 'Add option',
	default: {},
	displayOptions: { show: { resource: ['page'], operation: ['getResult'] } },
	options: [
		{
			displayName: 'Original Operation',
			name: 'originalOperation',
			type: 'options',
			default: 'auto',
			description:
				'The operation that produced the token, so the result is shaped the same way. Choose Take Screenshot to get the image as a file.',
			options: [
				{ name: 'Detect From Result', value: 'auto' },
				{ name: 'Get Console Errors', value: 'console' },
				{ name: 'Get Keywords', value: 'keywords' },
				{ name: 'Get Markdown', value: 'markdown' },
				{ name: 'Get Metadata', value: 'meta' },
				{ name: 'Get Rendered HTML', value: 'html' },
				{ name: 'Get Summary', value: 'summarize' },
				{ name: 'Run Lighthouse Audit', value: 'lighthouse' },
				{ name: 'Scrape', value: 'scrape' },
				{ name: 'Take Screenshot', value: 'screenshot' },
			],
		},
		{
			displayName: 'Put Output File in Field',
			name: 'binaryPropertyName',
			type: 'string',
			default: 'data',
			description: 'The name of the output binary field to put a screenshot in',
		},
		{
			displayName: 'Wait Until Ready',
			name: 'waitUntilReady',
			type: 'boolean',
			default: false,
			description:
				"Whether to keep checking until the result is ready. Off, a result still being worked on comes back with status 'processing'.",
		},
		waitTimeoutOption,
	],
};
