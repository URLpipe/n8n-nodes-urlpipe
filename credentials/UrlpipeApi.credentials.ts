import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class UrlpipeApi implements ICredentialType {
	name = 'urlpipeApi';

	displayName = 'URLpipe API';

	icon: Icon = { light: 'file:../icons/urlpipe.svg', dark: 'file:../icons/urlpipe.dark.svg' };

	documentationUrl = 'https://urlpipe.dev/docs/authentication';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description:
				'Your project API key, from the URLpipe dashboard. The free plan includes 1,000 credits a month.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	// Looking up a token that does not exist costs nothing: a valid key gets a
	// 404 "not_found", a bad key a 401, and an account whose email address is
	// not confirmed yet a 403. HTTP errors are read from the body, not thrown,
	// so the 404 counts as a pass.
	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://urlpipe.dev',
			url: '/result/credential-check',
			method: 'GET',
			json: true,
			ignoreHttpStatusErrors: true,
		},
		rules: [
			{
				type: 'responseSuccessBody',
				properties: {
					key: 'error',
					value: 'invalid_api_key',
					message:
						'URLpipe did not accept this API key. Copy the project API key from the URLpipe dashboard again.',
				},
			},
			{
				type: 'responseSuccessBody',
				properties: {
					key: 'error',
					value: 'email_unverified',
					message:
						'The key is valid, but the email address on the URLpipe account is not confirmed yet. Click the link URLpipe emailed you, then test again.',
				},
			},
		],
	};
}
