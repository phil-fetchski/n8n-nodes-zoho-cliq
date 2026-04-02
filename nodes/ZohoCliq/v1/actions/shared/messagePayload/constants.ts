export const blockedObjectKeys = new Set(['__proto__', 'constructor', 'prototype']);
export const allowedButtonActions = new Set([
	'invoke.function',
	'open.url',
	'system.api',
	'copy',
	'preview.url',
]);
export const allowedButtonTypes = new Set(['+', '-']);
export const allowedCardThemes = new Set(['modern-inline', 'basic', 'poll', 'prompt']);
export const allowedSlideTypeList = [
	'table',
	'list',
	'images',
	'text',
	'label',
	'percentage_chart',
	'graph',
];
export const allowedSlideTypes = new Set(allowedSlideTypeList);
export const dataRequiredSlideTypes = new Set(allowedSlideTypeList);
export const allowedSlideTypesText = allowedSlideTypeList.join(', ');
export const mentionTypes = new Set([
	'available',
	'all',
	'participants',
	'user',
	'silentUser',
	'team',
	'channel',
]);
export const mentionInsertModes = new Set(['append', 'prepend']);
export const mentionIdentifierPattern = /^[a-zA-Z0-9._-]+$/;
export const richTextMaxLength = 4096;
export const textSlideMaxLength = 1000;
export const richPayloadMaxLength = 10_000;
