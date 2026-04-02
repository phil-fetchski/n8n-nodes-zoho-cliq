import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';

export const createContext = (params: Record<string, unknown>): IExecuteFunctions => {
	return {
		getNodeParameter: jest.fn((name: string, _itemIndex: number, fallback?: unknown) => {
			if (params[name] !== undefined) {
				return params[name];
			}

			const rich = params.richMessage as IDataObject | undefined;
			if (rich && typeof rich === 'object') {
				if (name === 'richText') {
					return rich.richText !== undefined
						? rich.richText
						: rich.text !== undefined
							? rich.text
							: fallback;
				}
				if (
					name === 'cardInputMode' ||
					name === 'richPayloadJson' ||
					name === 'addCardIcon' ||
					name === 'addCardThumbnail' ||
					name === 'postAsBot' ||
					name === 'botDisplayName' ||
					name === 'botUniqueName' ||
					name === 'agentBotUniqueName' ||
					name === 'botImage' ||
					name === 'cardIcon' ||
					name === 'cardIconGroup' ||
					name === 'cardIconInputMode' ||
					name === 'cardKnownIconId' ||
					name === 'cardIconPicker' ||
					name === 'cardIconIconify' ||
					name === 'cardTheme' ||
					name === 'cardThumbnail' ||
					name === 'cardThumbnailGroup' ||
					name === 'cardThumbnailInputMode' ||
					name === 'cardThumbnailKnownIconId' ||
					name === 'cardThumbnailPicker' ||
					name === 'cardThumbnailIconify' ||
					name === 'cardTitle' ||
					name === 'slides' ||
					name === 'imagesButtons' ||
					name === 'labelButtons' ||
					name === 'listButtons' ||
					name === 'tableButtons' ||
					name === 'textButtons' ||
					name === 'buttons'
				) {
					return rich[name] !== undefined ? rich[name] : fallback;
				}
			}

			return fallback;
		}),
		getNode: jest.fn(() => ({ name: 'Test Node', type: 'n8n-nodes-base.zohoCliq' })),
	} as unknown as IExecuteFunctions;
};
