/** Ответ полнотекстового поиска. */
export interface SearchHit {
	id: string;
	title: string;
	link: string;
	category: string;
	tags: string[];
	keywords: string[];
	fragments: string[];
	score: number;
}

export interface SearchResponse {
	query: string;
	total: number;
	ms: number;
	hits: SearchHit[];
	didYouMean: string | null;
}

export interface SearchRequest {
	query: string;
	limit?: number;
	category?: string | null;
	tags?: string[];
	fuzzy?: boolean;
	lang?: 'auto' | 'ru' | 'en';
}

export interface SuggestResponse {
	query: string;
	suggestions: string[];
}

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

export interface DocumentItem {
	id: string;
	title: string;
	content: string;
	keywords?: string[];
	tags?: string[];
	category?: string;
	link?: string;
}

export interface DocumentsResponse {
	total: number;
	documents: DocumentItem[];
}

export interface HealthResponse {
	status: string;
	app: string;
	version: string;
	uptime: number;
	docs: number;
	terms: number;
	indexBuildMs: number;
	timestamp: string;
}

export interface BotInfo {
	name: string;
	platform: string;
	commands: string[];
}

export interface BotsResponse {
	total: number;
	bots: BotInfo[];
}

export interface ProviderInfo {
	id: string;
	name: string;
	group: string;
	models: string[];
}

export interface ProvidersResponse {
	total: number;
	providers: ProviderInfo[];
}

export interface DatasetResponse {
	total: number;
	documents: DocumentItem[];
	learning: Record<string, number>;
}

export interface DatasetImportResponse {
	total: number;
	documents: DocumentItem[];
}

export interface BackupResponse {
	backedUp: boolean;
	file: string;
	at: string;
}

export interface RestoreResponse {
	restored: boolean;
	snapshot?: string;
	queries: number;
}