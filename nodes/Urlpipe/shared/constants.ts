export const BASE_URL = 'https://urlpipe.dev';

export const CREDENTIAL_NAME = 'urlpipeApi';

// Kept in step with package.json; a test checks that they match.
export const PACKAGE_VERSION = '0.1.1';

export const USER_AGENT = `n8n-nodes-urlpipe/${PACKAGE_VERSION}`;

// The API holds a synchronous request for up to 60 seconds, so each HTTP
// request is allowed a little longer than that.
export const REQUEST_TIMEOUT_MS = 90_000;

// Mutable so the tests can shrink the waits; nothing else changes them.
export const timing = {
	pollIntervalMs: 2_000,
	maxRetryAfterMs: 60_000,
};

export const DEFAULT_WAIT_TIMEOUT_SECONDS = 300;

export type Operation =
	| 'markdown'
	| 'html'
	| 'summarize'
	| 'screenshot'
	| 'meta'
	| 'keywords'
	| 'console'
	| 'lighthouse'
	| 'scrape';

export const OPERATIONS: Operation[] = [
	'markdown',
	'html',
	'summarize',
	'screenshot',
	'meta',
	'keywords',
	'console',
	'lighthouse',
	'scrape',
];
