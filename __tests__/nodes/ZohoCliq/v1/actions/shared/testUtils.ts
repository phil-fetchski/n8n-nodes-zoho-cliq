export const ZOHO_CLIQ_PASSTHROUGH_KEYS: ReadonlyArray<string> = [
	'richText',
	'addCardIcon',
	'addCardThumbnail',
	'cardIcon',
	'cardIconGroup',
	'cardIconInputMode',
	'cardIconPicker',
	'cardIconIconify',
	'cardInputMode',
	'cardTheme',
	'cardThumbnail',
	'cardThumbnailGroup',
	'cardThumbnailInputMode',
	'cardThumbnailPicker',
	'cardThumbnailIconify',
	'cardTitle',
	'richPayloadJson',
	'postAsBot',
	'botDisplayName',
	'botUniqueName',
	'botImage',
	'slides',
	'buttons',
];

export function createRichMessageParameterMock(
	getNodeParameterMock: jest.Mock,
	params: Record<string, unknown>,
): void {
	getNodeParameterMock.mockImplementation(
		(paramName: string, _itemIndex: number, defaultValue?: unknown) => {
			if (params[paramName] !== undefined) {
				return params[paramName];
			}

			const rich = params.richMessage as Record<string, unknown> | undefined;
			if (rich) {
				if (ZOHO_CLIQ_PASSTHROUGH_KEYS.includes(paramName)) {
					if (paramName === 'richText') {
						return rich.richText ?? rich.text ?? defaultValue;
					}
					return rich[paramName] !== undefined ? rich[paramName] : defaultValue;
				}
			}

			return defaultValue;
		},
	);
}
