/** Документ из файла данных. */
export interface Doc {
	id: string;
	title: string;
	content: string;
	keywords?: string[] | string;
	tags?: string[];
	category?: string;
	link?: string;
}

/** Результат поиска. */
export interface Hit {
	id: string;
	title: string;
	link: string;
	category: string;
	tags: string[];
	keywords: string[];
	fragments: string[];
	score: number;
}

/** Опции поискового запроса. */
export interface SearchOptions {
	limit?: number;
	category?: string | null;
	tags?: string[];
	fuzzy?: boolean;
	lang?: 'auto' | 'ru' | 'en';
}

/** Ответ на поисковый запрос. */
export interface SearchResponse {
	query: string;
	total: number;
	ms: number;
	hits: Hit[];
	didYouMean: string | null;
}

/** Статистика индекса и контекст. */
export interface ContextResponse {
	categories: Record<string, number>;
	tags: Record<string, number>;
	stats: {
		docs: number;
		terms: number;
		buildMs: number;
		avgFieldLength: number;
	};
}

/** Запись о подключённом боте. */
export interface BotInfo {
	name: string;
	platform: 'bun' | 'python' | 'node' | 'discord' | string;
	commands: string[];
}

/** Каталог внешнего провайдера. */
export interface ProviderInfo {
	id: string;
	name: string;
	group: string;
	models: string[];
}