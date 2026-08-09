import type { Doc, Hit, SearchOptions, SearchResponse, ContextResponse } from './types.js';
import { parseQuery, type ParsedQuery } from './query.js';
import { tokenize, type Token } from './tokenizer.js';
import { stemToken } from './stemmer.js';
import { isStopWord } from './stopwords.js';
import { levenshtein, similarTerms } from './levenshtein.js';
import { layoutVariants } from './tokenizer.js';
import { buildFragments } from './highlight.js';

/** Пост-листинг: сколько раз слово встретилось в каждом поле документа. */
interface Posting {
	title: number;
	keywords: number;
	body: number;
}

/** Терм индекса: посты + частота документов. */
interface Term {
	/** Множество слов, приведённых к этому терму (для подсветки). */
	forms: Set<string>;
	/** Посты: индекс документа → число вхождений по полям. */
	postings: Map<number, Posting>;
}

export interface EngineConfig {
	/** Веса полей при ранжировании. */
	titleWeight: number;
	keywordsWeight: number;
	bodyWeight: number;
	/** Параметры BM25. */
	k1: number;
	b: number;
	/** Нечёткий поиск включён. */
	fuzzy: boolean;
	/** Предел расстояния Левенштейна. */
	levenshteinLimit: number;
	/** Ширина фрагмента в символах. */
	snippetWidth: number;
	/** Максимум фрагментов на результат. */
	maxFragments: number;
	/** Тег выделения совпадений. */
	markTag: string;
	/** Лимит результатов по умолчанию. */
	limit: number;
	/** Язык стемминга. */
	lang: 'auto' | 'ru' | 'en';
}

const DEFAULT_CONFIG: EngineConfig = {
	titleWeight: 5.0,
	keywordsWeight: 2.5,
	bodyWeight: 1.0,
	k1: 1.2,
	b: 0.75,
	fuzzy: true,
	levenshteinLimit: 2,
	snippetWidth: 42,
	maxFragments: 2,
	markTag: 'mark',
	limit: 20,
	lang: 'auto'
};

/** Поисковый движок: инвертированный индекс в памяти и ранжирование BM25. */
export class SearchEngine {
	readonly docs: Doc[];
	private terms = new Map<string, Term>();
	private docLen: number[] = [];
	private avgDocLen = 0;
	private totalTerms = 0;
	readonly buildMs: number;

	constructor(docs: Doc[], config: Partial<EngineConfig> = {}) {
		const t0 = performance.now();
		this.docs = docs;
		const cfg = { ...DEFAULT_CONFIG, ...config };

		let totalLen = 0;
		for (let d = 0; d < docs.length; d++) {
			const doc = docs[d];
			const title = tokenize(doc.title, cfg.lang);
			const keywords = tokenize(Array.isArray(doc.keywords) ? doc.keywords.join(' ') : (doc.keywords ?? ''), cfg.lang);
			const body = tokenize(doc.content, cfg.lang);
			this.docLen[d] = body.length;
			totalLen += body.length;
			this.totalTerms += title.length + keywords.length + body.length;

			for (const token of title) this.add(token, d, 'title');
			for (const token of keywords) this.add(token, d, 'keywords');
			for (const token of body) this.add(token, d, 'body');
		}
		this.avgDocLen = docs.length ? totalLen / docs.length : 0;
		this.buildMs = performance.now() - t0;
	}

	private add(token: Token, doc: number, field: 'title' | 'keywords' | 'body') {
		let term = this.terms.get(token.stem);
		if (!term) {
			term = { forms: new Set(), postings: new Map() };
			this.terms.set(token.stem, term);
		}
		term.forms.add(token.word);
		let posting = term.postings.get(doc);
		if (!posting) {
			posting = { title: 0, keywords: 0, body: 0 };
			term.postings.set(doc, posting);
		}
		posting[field]++;
	}

	/** Известные основы слов (для подсказок). */
	get dictionary(): string[] {
		return [...this.terms.keys()];
	}

	/**
	 * Полнотекстовый поиск: BM25 + фильтры, фрагменты и подсказка.
	 */
	search(rawQuery: string, options: SearchOptions = {}): SearchResponse {
		const t0 = performance.now();
		const query = (rawQuery ?? '').trim();
		if (!query) {
			return { query, total: 0, ms: performance.now() - t0, hits: [], didYouMean: null };
		}

		const cfg = { ...DEFAULT_CONFIG, ...(options.lang ? { lang: options.lang } : {}) };
		const parsed = parseQuery(query);
		const limit = options.limit ?? 20;

		// Подготовка терминов запроса с учётом раскладки и нечёткого поиска.
		const matchedTerms = new Set<string>();
		const fuzzyTerms = new Set<string>();
		const words = this.prepareWords(parsed, cfg, matchedTerms, fuzzyTerms);

		// Кандидаты: пересечение постов всех терминов.
		let candidates: Map<number, number> | null = null;
		for (const term of words) {
			const entry = this.terms.get(term);
			if (!entry) continue;
			const scores = new Map<number, number>();
			for (const [doc, posting] of entry.postings) {
				scores.set(doc, this.bm25(term, posting, this.docLen[doc], cfg));
			}
			candidates = candidates ? intersectScore(candidates, scores) : scores;
		}

		let docs: { doc: number; score: number }[];
		if (!candidates) {
			// Нет терминов: просто фильтры.
			docs = this.docs.map((_, i) => ({ doc: i, score: 0 }));
		} else {
			docs = [...candidates.entries()].map(([doc, score]) => ({ doc, score }));
		}

		// Исключённые слова.
		for (const term of this.prepareExcluded(parsed, cfg)) {
			const entry = this.terms.get(term);
			if (!entry) continue;
			docs = docs.filter(({ doc }) => !entry.postings.has(doc));
		}

		// Фильтры: категория, теги, фраза.
		const category = (options.category ?? parsed.category ?? '').toLowerCase();
		const tags = new Set((options.tags ?? parsed.tags).map((t) => t.toLowerCase()));
		const phrase = parsed.phrase;
		if (category || tags.size > 0 || phrase) {
			docs = docs.filter(({ doc }) => {
				const d = this.docs[doc];
				if (category && (d.category ?? '').toLowerCase() !== category) return false;
				if (tags.size > 0 && !(d.tags ?? []).some((t) => tags.has(t.toLowerCase()))) return false;
				if (phrase) {
					const hay = `${(d.title ?? '')} ${(d.content ?? '')}`.toLowerCase();
					if (!hay.includes(phrase.toLowerCase())) return false;
				}
				return true;
			});
		}

		docs.sort((a, b) => b.score - a.score || (a.doc < b.doc ? -1 : 1));

		const total = docs.length;
		const hits = docs.slice(0, limit).map(({ doc, score }) => this.toHit(doc, score, matchedTerms, fuzzyTerms, cfg));

		let didYouMean: string | null = null;
		if (hits.length === 0 && parsed.words.length > 0) {
			didYouMean = this.suggestDidYouMean(parsed, cfg, matchedTerms);
		}

		return {
			query,
			total,
			ms: performance.now() - t0,
			hits,
			didYouMean
		};
	}

	/** Готовит поисковые слова: стоп-слова, раскладка, нечёткое расширение. */
	private prepareWords(
		parsed: ParsedQuery,
		cfg: EngineConfig,
		matched: Set<string>,
		fuzzy: Set<string>
	): string[] {
		const result = new Set<string>();
		const candidates = [...parsed.required, ...parsed.words];
		for (const raw of candidates) {
			const word = raw.toLowerCase();
			if (isStopWord(word)) continue;
			const stem = stemToken(word, cfg.lang);
			if (this.terms.has(stem)) {
				result.add(stem);
				matched.add(stem);
				continue;
			}
			// Раскладка: слово могло быть набрано в другой раскладке.
			const layout = layoutVariants(word);
			for (const candidate of [layout.ru, layout.en]) {
				if (!candidate || isStopWord(candidate)) continue;
				const s = stemToken(candidate, cfg.lang);
				if (this.terms.has(s)) {
					result.add(s);
					matched.add(s);
					break;
				}
			}
			// Нечёткий поиск: близкие слова из словаря.
			if (cfg.fuzzy && !result.has(stem)) {
				for (const near of similarTerms(stem, this.terms.keys(), cfg.levenshteinLimit, 3)) {
					result.add(near);
					fuzzy.add(near);
				}
			}
		}
		return [...result];
	}

	private prepareExcluded(parsed: ParsedQuery, cfg: EngineConfig): string[] {
		return parsed.excluded
			.map((w) => w.toLowerCase())
			.filter((w) => !isStopWord(w))
			.map((w) => stemToken(w, cfg.lang))
			.filter((s) => this.terms.has(s));
	}

	/** Вес BM25 для поста. */
	private bm25(term: string, posting: Posting, docLen: number, cfg: EngineConfig): number {
		const df = this.terms.get(term)!.postings.size;
		const idf = Math.log(1 + (this.docs.length - df + 0.5) / (df + 0.5));
		const denom = cfg.k1 * (1 - cfg.b + (cfg.b * docLen) / this.avgDocLen);
		let score = 0;
		const fields: [number, number][] = [
			[posting.title, cfg.titleWeight],
			[posting.keywords, cfg.keywordsWeight],
			[posting.body, cfg.bodyWeight]
		];
		for (const [tf, weight] of fields) {
			if (tf > 0) score += weight * idf * ((tf * (cfg.k1 + 1)) / (tf + denom));
		}
		return score;
	}

	/** Формирует результат поиска с фрагментами. */
	private toHit(
		docIndex: number,
		score: number,
		matched: Set<string>,
		fuzzy: Set<string>,
		cfg: EngineConfig
	): Hit {
		const doc = this.docs[docIndex];
		// Формы для подсветки: исходные слова, приведённые к найденным термам.
		const forms = new Set<string>();
		for (const term of matched) {
			const entry = this.terms.get(term);
			if (!entry) continue;
			for (const f of entry.forms) forms.add(f);
		}
		for (const term of fuzzy) {
			const entry = this.terms.get(term);
			if (!entry) continue;
			for (const f of entry.forms) forms.add(f);
		}
		const fragments = buildFragments(doc.content, [...forms], {
			width: cfg.snippetWidth,
			maxFragments: cfg.maxFragments,
			markTag: cfg.markTag
		});
		return {
			id: doc.id,
			title: doc.title,
			link: doc.link ?? '',
			category: doc.category ?? '',
			tags: doc.tags ?? [],
			keywords: Array.isArray(doc.keywords) ? doc.keywords : (doc.keywords ?? '').split(/[,\s]+/).filter(Boolean),
			fragments,
			score: Math.round(score * 1000) / 1000
		};
	}

	/** Подсказка «Возможно, вы имели в виду…». */
	private suggestDidYouMean(parsed: ParsedQuery, cfg: EngineConfig, matched: Set<string>): string | null {
		for (const raw of [...parsed.required, ...parsed.words]) {
			const word = raw.toLowerCase();
			if (isStopWord(word) || matched.size > 0) continue;
			const stem = stemToken(word, cfg.lang);
			const near = similarTerms(stem, this.terms.keys(), cfg.levenshteinLimit, 1)[0];
			if (!near) continue;
			return parsed.phrase
				? `Возможно, вы имели в виду: «${parsed.phrase.replace(word, near)}»`
				: `Возможно, вы имели в виду: «${queryReplace(parsed, raw, near)}»`;
		}
		return null;
	}

	/** Автодополнение по префиксу и нечёткому поиску. */
	suggest(query: string, limit = 8): string[] {
		const q = query.toLowerCase().trim();
		if (!q) return [];
		const word = q.split(/\s+/).pop() ?? '';
		const prefixMatches = [...this.terms.entries()]
			.filter(([stem]) => stem.startsWith(word) && stem !== word)
			.slice(0, limit);
		const result: string[] = [];
		for (const entry of prefixMatches) {
			for (const form of entry[1].forms) {
				if (result.length >= limit) break;
				result.push(form);
			}
			if (result.length >= limit) break;
		}
		if (result.length < limit && this.terms.has(word)) {
			// уже точно есть — не добавляем
		}
		return result.slice(0, limit);
	}

	/** Категории, теги и статистика индекса. */
	context(): ContextResponse {
		const categories: Record<string, number> = {};
		const tags: Record<string, number> = {};
		for (const doc of this.docs) {
			const cat = (doc.category ?? '').toLowerCase();
			if (cat) categories[cat] = (categories[cat] ?? 0) + 1;
			for (const tag of doc.tags ?? []) {
				const t = tag.toLowerCase();
				tags[t] = (tags[t] ?? 0) + 1;
			}
		}
		return {
			categories,
			tags,
			stats: {
				docs: this.docs.length,
				terms: this.terms.size,
				buildMs: Math.round(this.buildMs * 100) / 100,
				avgFieldLength: Math.round(this.avgDocLen * 100) / 100
			}
		};
	}

	/** Список документов с фильтрами и пагинацией. */
	listDocuments(options: { category?: string | null; tag?: string | null; limit?: number; offset?: number } = {}): {
		total: number;
		documents: Doc[];
	} {
		const category = (options.category ?? '').toLowerCase();
		const tag = (options.tag ?? '').toLowerCase();
		const docs = this.docs.filter((doc) => {
			if (category && (doc.category ?? '').toLowerCase() !== category) return false;
			if (tag && !(doc.tags ?? []).some((t) => t.toLowerCase() === tag)) return false;
			return true;
		});
		const limit = options.limit ?? this.docs.length;
		const offset = options.offset ?? 0;
		return { total: docs.length, documents: docs.slice(offset, offset + limit) };
	}
}

/** Пересекает два списка оценок: сумма оценок общих документов. */
function intersectScore(a: Map<number, number>, b: Map<number, number>): Map<number, number> {
	const result = new Map<number, number>();
	if (a.size <= b.size) {
		for (const [doc, score] of a) {
			if (b.has(doc)) result.set(doc, score + b.get(doc)!);
		}
	} else {
		for (const [doc, score] of b) {
			if (a.has(doc)) result.set(doc, score + a.get(doc)!);
		}
	}
	return result;
}

/** Заменяет слово в исходном запросе на ближайшее из словаря. */
function queryReplace(parsed: ParsedQuery, raw: string, replacement: string): string {
	const parts: string[] = [];
	for (const word of parsed.words) {
		parts.push(word === raw ? replacement : word);
	}
	return [...parts, ...parsed.required.map((w) => `+${w === raw ? replacement : w}`)].join(' ');
}

/** Проверка расстояния Левенштейна (экспорт для тестов). */
export function distance(a: string, b: string): number {
	return levenshtein(a, b, 99);
}