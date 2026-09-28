import type { IDataObject } from 'n8n-workflow';

import type { Operation } from './constants';

export interface PageOptions {
	blockAds?: boolean;
	blockCookieBanners?: boolean;
	labels?: { label?: Array<{ name?: string; value?: string }> };
	maxAge?: string | number;
	reportTo?: string;
	residential?: boolean;
	waitForResult?: boolean;
	waitForSelector?: string;
	waitTimeout?: number;
}

export interface ScreenshotOptions {
	darkMode?: boolean;
	deviceScaleFactor?: number;
	format?: string;
	fullPage?: boolean;
	quality?: number;
	selector?: string;
	viewportHeight?: number;
	viewportWidth?: number;
}

export interface BodyInput {
	operation: Operation;
	url: string;
	options: PageOptions;
	scrapeOperations?: string[];
	device?: string;
	includeAudits?: boolean;
	screenshotOptions?: ScreenshotOptions;
}

/** "3600" is sent as a number of seconds; "3 days" as the duration it is. */
function maxAgeValue(maxAge: string | number | undefined): string | number | undefined {
	if (maxAge === undefined || maxAge === null) return undefined;
	if (typeof maxAge === 'number') return maxAge;
	const trimmed = maxAge.trim();
	if (!trimmed) return undefined;
	return /^\d+$/.test(trimmed) ? Number(trimmed) : trimmed;
}

function labelsValue(labels: PageOptions['labels']): IDataObject | undefined {
	const entries = labels?.label ?? [];
	const result: IDataObject = {};
	for (const { name, value } of entries) {
		if (name && name.trim()) result[name.trim()] = value ?? '';
	}
	return Object.keys(result).length ? result : undefined;
}

function pageOptionsValue(options: PageOptions): IDataObject | undefined {
	const pageOptions: IDataObject = {};
	if (options.blockAds) pageOptions.block_ads = true;
	if (options.blockCookieBanners) pageOptions.block_cookie_banners = true;
	if (options.waitForSelector && options.waitForSelector.trim()) {
		pageOptions.wait_for_selector = options.waitForSelector.trim();
	}
	return Object.keys(pageOptions).length ? pageOptions : undefined;
}

function screenshotOptionsValue(options: ScreenshotOptions | undefined): IDataObject | undefined {
	if (!options) return undefined;
	const result: IDataObject = {};
	if (options.fullPage !== undefined) result.full_page = options.fullPage;
	if (options.viewportWidth !== undefined) result.viewport_width = options.viewportWidth;
	if (options.viewportHeight !== undefined) result.viewport_height = options.viewportHeight;
	if (options.deviceScaleFactor !== undefined) {
		result.device_scale_factor = Number(options.deviceScaleFactor);
	}
	if (options.format) result.format = options.format;
	if (options.quality !== undefined) result.quality = options.quality;
	if (options.darkMode !== undefined) result.dark_mode = options.darkMode;
	if (options.selector && options.selector.trim()) result.selector = options.selector.trim();
	return Object.keys(result).length ? result : undefined;
}

/** Whether the call waits for the result: on unless 'Wait for Result' is turned off. */
export function isSync(options: PageOptions): boolean {
	return options.waitForResult !== false;
}

/** The JSON body for POST /<operation>, carrying only what the user set. */
export function buildBody(input: BodyInput): IDataObject {
	const { operation, options } = input;
	const sync = isSync(options);
	const body: IDataObject = { url: input.url.trim(), sync };

	const maxAge = maxAgeValue(options.maxAge);
	if (maxAge !== undefined) body.max_age = maxAge;

	const labels = labelsValue(options.labels);
	if (labels) body.labels = labels;

	if (options.residential) body.residential = true;

	if (!sync && options.reportTo && options.reportTo.trim()) {
		body.report_to = options.reportTo.trim();
	}

	if (operation !== 'lighthouse') {
		const pageOptions = pageOptionsValue(options);
		if (pageOptions) body.page_options = pageOptions;
	}

	const included = operation === 'scrape' ? (input.scrapeOperations ?? []) : [operation];
	if (operation === 'scrape') body.operations = included;

	if (included.includes('screenshot')) {
		const screenshotOptions = screenshotOptionsValue(input.screenshotOptions);
		if (screenshotOptions) body.screenshot_options = screenshotOptions;
	}

	if (included.includes('lighthouse')) {
		if (input.device) body.device = input.device;
		if (input.includeAudits) body.include_audits = true;
	}

	return body;
}
