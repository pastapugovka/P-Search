/** Разобранный поисковый запрос. */
export interface ParsedQuery {
	/** Обязательные слова (+слово) — документ должен содержать каждое из них. */
	required: string[];
	/** Исключённые слова (-слово) — документ не должен их содержать. */
	excluded: string[];
	/** Обычные слова — любое из них ранжируется. */
	words: string[];
	/** Точная фраза в кавычках: «"точное сочетание"». */
	phrase: string | null;
	/** Фильтр по категории (@категория). */
	category: string | null;
	/** Фильтры по тегам (#тег). */
	tags: string[];
}

const TOKEN_RE = /"(?:[^"]*)"|\S+/g;

/** Разбирает строку запроса: +слово -слово @категория #тег "фраза" обычные слова. */
export function parseQuery(raw: string): ParsedQuery {
	const result: ParsedQuery = {
		required: [],
		excluded: [],
		words: [],
		phrase: null,
		category: null,
		tags: []
	};

	for (const match of raw.normalize('NFKC').match(TOKEN_RE) ?? []) {
		if (match.startsWith('"') && match.endsWith('"') && match.length > 2) {
			result.phrase = match.slice(1, -1).trim();
			continue;
		}
		if (match.startsWith('+') && match.length > 1) {
			result.required.push(match.slice(1));
			continue;
		}
		if (match.startsWith('-') && match.length > 1) {
			result.excluded.push(match.slice(1));
			continue;
		}
		if (match.startsWith('@') && match.length > 1) {
			result.category = match.slice(1).toLowerCase();
			continue;
		}
		if (match.startsWith('#') && match.length > 1) {
			result.tags.push(match.slice(1).toLowerCase());
			continue;
		}
		result.words.push(match);
	}

	return result;
}