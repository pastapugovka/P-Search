import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { EngineConfig } from './search/engine.js';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

function bool(value: string | undefined, fallback: boolean): boolean {
	if (value === undefined || value === '') return fallback;
	return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function num(value: string | undefined, fallback: number): number {
	if (value === undefined || value === '') return fallback;
	const n = Number(value);
	return Number.isFinite(n) ? n : fallback;
}

function loadDotEnv(): void {
	try {
		const text = readFileSync(join(ROOT, '.env'), 'utf8');
		for (const line of text.split(/\r?\n/)) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith('#')) continue;
			const eq = trimmed.indexOf('=');
			if (eq === -1) continue;
			const key = trimmed.slice(0, eq).trim();
			const value = trimmed.slice(eq + 1).trim();
			if (process.env[key] === undefined) process.env[key] = value;
		}
	} catch {
		// .env отсутствует — используем переменные окружения.
	}
}

export interface AppConfig {
	port: number;
	host: string;
	origin: string;
	corsOrigin: string;
	dataPath: string;
	engine: EngineConfig;
	appName: string;
	botName: string | null;
	dataDir: string;
}

loadDotEnv();

export const config: AppConfig = {
	port: num(process.env.PORT, 3000),
	host: process.env.HOST ?? '0.0.0.0',
	origin: process.env.ORIGIN ?? '',
	corsOrigin: process.env.CORS_ORIGIN ?? '*',
	dataPath: process.env.SEARCH_DATA ?? './data/search-content.json',
	appName: process.env.APP_NAME ?? 'Поисковая система',
	botName: process.env.BOT_NAME?.trim() || null,
	dataDir: join(ROOT, 'data'),
	engine: {
		titleWeight: num(process.env.SEARCH_TITLE_WEIGHT, 5.0),
		keywordsWeight: num(process.env.SEARCH_KEYWORDS_WEIGHT, 2.5),
		bodyWeight: num(process.env.SEARCH_BODY_WEIGHT, 1.0),
		k1: num(process.env.SEARCH_K1, 1.2),
		b: num(process.env.SEARCH_B, 0.75),
		fuzzy: bool(process.env.SEARCH_FUZZY, true),
		levenshteinLimit: num(process.env.SEARCH_LEVENSHTEIN_LIMIT, 2),
		snippetWidth: num(process.env.SEARCH_SNIPPET_WIDTH, 42),
		maxFragments: num(process.env.SEARCH_MAX_FRAGMENTS, 2),
		markTag: process.env.SEARCH_MARK_TAG ?? 'mark',
		limit: num(process.env.SEARCH_LIMIT, 20),
		lang: (process.env.SEARCH_LANG as 'auto' | 'ru' | 'en') ?? 'auto'
	}
};

export { ROOT };