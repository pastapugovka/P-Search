import { hasCyrillic, fixLayout } from './layout.js';
import { stemToken } from './stemmer.js';
import { isStopWord } from './stopwords.js';

/** Границы слова: буквы и цифры, включая дефис внутри слова. */
const TOKEN_RE = /[\p{L}\p{N}]+(?:[-_][\p{L}\p{N}]+)*/gu;

/** Нормализованный токен: исходное слово и его основа. */
export interface Token {
	word: string;
	stem: string;
}

/** Разбивает текст на токены с проверкой стоп-слов. */
export function tokenize(text: string, lang: 'auto' | 'ru' | 'en' = 'auto'): Token[] {
	const tokens: Token[] = [];
	for (const match of text.normalize('NFKC').match(TOKEN_RE) ?? []) {
		const word = match.toLowerCase();
		if (isStopWord(word)) continue;
		const stem = stemToken(word, lang);
		if (!stem) continue;
		tokens.push({ word, stem });
	}
	return tokens;
}

/** Разбивает текст на токены без проверки стоп-слов (для фраз и подсветки). */
export function tokenizeRaw(text: string): string[] {
	return (text.normalize('NFKC').toLowerCase().match(TOKEN_RE) ?? []).map((w) => w.toLowerCase());
}

/** Автоопределение языка текста по соотношению букв. */
export function detectLang(text: string): 'ru' | 'en' {
	let ru = 0;
	let en = 0;
	for (const c of text) {
		if (/[а-яё]/i.test(c)) ru++;
		else if (/[a-z]/i.test(c)) en++;
	}
	return ru >= en && ru > 0 ? 'ru' : 'en';
}

const FIX_CACHE = new Map<string, { ru: string | null; en: string | null }>();

/**
 * Возвращает варианты слова в «исправленной» раскладке.
 * Если слово набрано в неправильной раскладке, возвращает корректную форму.
 */
export function layoutVariants(word: string): { ru: string | null; en: string | null } {
	let cached = FIX_CACHE.get(word);
	if (!cached) {
		cached = fixLayout(word);
		FIX_CACHE.set(word, cached);
	}
	return cached;
}

/** Проверяет, набрано ли слово в правильной раскладке относительно индекса. */
export function isCyrillicWord(word: string): boolean {
	return hasCyrillic(word);
}