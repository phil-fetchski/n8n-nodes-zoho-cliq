const NEW_YORK_TIMEZONE = 'America/New_York';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;

function getTimeZoneDateParts(timestamp: number, timeZone: string) {
	const formatter = new Intl.DateTimeFormat('en-CA-u-hc-h23', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hour12: false,
	});

	const parts = formatter.formatToParts(new Date(timestamp));
	const valueOf = (type: Intl.DateTimeFormatPartTypes) =>
		Number(parts.find((part) => part.type === type)?.value ?? '0');

	return {
		year: valueOf('year'),
		month: valueOf('month'),
		day: valueOf('day'),
		hour: valueOf('hour'),
		minute: valueOf('minute'),
		second: valueOf('second'),
	};
}

function getTimeZoneOffsetMinutes(timestamp: number, timeZone: string): number {
	const parts = getTimeZoneDateParts(timestamp, timeZone);
	const utcFromLocalParts = Date.UTC(
		parts.year,
		parts.month - 1,
		parts.day,
		parts.hour,
		parts.minute,
		parts.second,
	);

	return Math.round((utcFromLocalParts - timestamp) / 60000);
}

function formatLocalIsoWithoutOffset(timestamp: number, timeZone: string): string {
	const parts = getTimeZoneDateParts(timestamp, timeZone);
	const pad = (value: number) => String(value).padStart(2, '0');

	return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}`;
}

function formatOffset(minutes: number): string {
	const sign = minutes >= 0 ? '+' : '-';
	const absoluteMinutes = Math.abs(minutes);
	const hours = String(Math.floor(absoluteMinutes / 60)).padStart(2, '0');
	const mins = String(absoluteMinutes % 60).padStart(2, '0');
	return `${sign}${hours}:${mins}`;
}

const roundedFutureStartMs = Math.floor((Date.now() + THIRTY_DAYS_MS) / 60000) * 60000;
const roundedFutureEndMs = roundedFutureStartMs + ONE_HOUR_MS;

export const newYorkOffsetStartMs = roundedFutureStartMs;
export const newYorkOffsetEndMs = roundedFutureEndMs;
export const newYorkLocalStartIso = formatLocalIsoWithoutOffset(
	newYorkOffsetStartMs,
	NEW_YORK_TIMEZONE,
);
export const newYorkLocalEndIso = formatLocalIsoWithoutOffset(
	newYorkOffsetEndMs,
	NEW_YORK_TIMEZONE,
);
export const newYorkOffsetStartIso = `${newYorkLocalStartIso}${formatOffset(
	getTimeZoneOffsetMinutes(newYorkOffsetStartMs, NEW_YORK_TIMEZONE),
)}`;
export const newYorkOffsetEndIso = `${newYorkLocalEndIso}${formatOffset(
	getTimeZoneOffsetMinutes(newYorkOffsetEndMs, NEW_YORK_TIMEZONE),
)}`;
