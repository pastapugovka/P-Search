import type {
	BackupResponse,
	BotsResponse,
	BotInfo,
	ContextResponse,
	DatasetImportResponse,
	DatasetResponse,
	DocumentItem,
	DocumentsResponse,
	HealthResponse,
	ProvidersResponse,
	RestoreResponse,
	SearchRequest,
	SearchResponse,
	SuggestResponse
} from './types.js';

export type {
	BackupResponse,
	BotsResponse,
	BotInfo,
	ContextResponse,
	DatasetImportResponse,
	DatasetResponse,
	DocumentItem,
	DocumentsResponse,
	HealthResponse,
	ProvidersResponse,
	RestoreResponse,
	SearchRequest,
	SearchResponse,
	SuggestResponse
} from './types.js';

export interface ClientOptions {
	baseUrl: string;
	/** Кастомный fetch (полезно в Node, Electron и браузерах). */
	fetch?: typeof fetch;
	/** Заголовки по умолчанию. */
	headers?: Record<string, string>;
}

/** Типизированный клиент для REST API поисковой системы. */
export class PSearchClient {
	private readonly baseUrl: string;
	private readonly fetchImpl: typeof fetch;
	private readonly headers: Record<string, string>;

	constructor(options: ClientOptions) {
		this.baseUrl = options.baseUrl.replace(/\/+$/, '');
		this.fetchImpl = options.fetch ?? globalThis.fetch;
		this.headers = { 'Content-Type': 'application/json', ...options.headers };
	}

	private async request<T>(path: string, init?: RequestInit): Promise<T> {
		const url = `${this.baseUrl}${path}`;
		const response = await this.fetchImpl(url, {
			...init,
			headers: { ...this.headers, ...(init?.headers ?? {}) }
		});
		if (!response.ok) {
			const body = await response.text().catch(() => '');
			throw new Error(`Поиск API ${url}: ${response.status} ${body}`);
		}
		return (await response.json()) as T;
	}

	/** Полнотекстовый поиск. */
	search(request: SearchRequest): Promise<SearchResponse> {
		if (!request.query) return Promise.resolve({ query: '', total: 0, ms: 0, hits: [], didYouMean: null });
		const params = new URLSearchParams({ query: request.query });
		if (request.limit !== undefined) params.set('limit', String(request.limit));
		if (request.category) params.set('category', request.category);
		if (request.tags?.length) params.set('tags', request.tags.join(','));
		if (request.fuzzy !== undefined) params.set('fuzzy', String(request.fuzzy));
		if (request.lang && request.lang !== 'auto') params.set('lang', request.lang);
		return this.request<SearchResponse>(`/api/search?${params}`);
	}

	/** Автодополнение по префиксу. */
	suggest(query: string, limit = 8): Promise<SuggestResponse> {
		return this.request<SuggestResponse>(`/api/suggest?query=${encodeURIComponent(query)}&limit=${limit}`);
	}

	/** Категории, теги и статистика индекса. */
	context(): Promise<ContextResponse> {
		return this.request<ContextResponse>('/api/context');
	}

	/** Список документов с фильтрами. */
	documents(params: { category?: string; tag?: string; limit?: number; offset?: number } = {}): Promise<DocumentsResponse> {
		const search = new URLSearchParams();
		if (params.category) search.set('category', params.category);
		if (params.tag) search.set('tag', params.tag);
		if (params.limit !== undefined) search.set('limit', String(params.limit));
		if (params.offset !== undefined) search.set('offset', String(params.offset));
		return this.request<DocumentsResponse>(`/api/documents${search.size ? `?${search}` : ''}`);
	}

	/** Каталог провайдеров. */
	providers(params: { group?: string; query?: string } = {}): Promise<ProvidersResponse> {
		const search = new URLSearchParams();
		if (params.group) search.set('group', params.group);
		if (params.query) search.set('query', params.query);
		return this.request<ProvidersResponse>(`/api/providers${search.size ? `?${search}` : ''}`);
	}

	/** Экспорт набора данных с обучением. */
	dataset(): Promise<DatasetResponse> {
		return this.request<DatasetResponse>('/api/dataset');
	}

	/** Импорт набора: полная замена корпуса и пересборка индекса. */
	importDataset(documents: DocumentItem[]): Promise<DatasetImportResponse> {
		return this.request<DatasetImportResponse>('/api/dataset', {
			method: 'POST',
			body: JSON.stringify({ documents })
		});
	}

	/** Сохранить бэкап обучения. */
	backup(): Promise<BackupResponse> {
		return this.request<BackupResponse>('/api/backup', { method: 'POST' });
	}

	/** Откат обучения к последнему бэкапу. */
	restore(): Promise<RestoreResponse> {
		return this.request<RestoreResponse>('/api/restore', { method: 'POST' });
	}

	/** Список ботов. */
	bots(): Promise<BotsResponse> {
		return this.request<BotsResponse>('/api/bots');
	}

	/** Регистрация бота. */
	registerBot(bot: BotInfo): Promise<BotInfo> {
		return this.request<BotInfo>('/api/bots', {
			method: 'POST',
			body: JSON.stringify(bot)
		});
	}

	/** Отключение бота. */
	unregisterBot(name: string): Promise<{ removed: boolean }> {
		return this.request<{ removed: boolean }>(`/api/bots/${encodeURIComponent(name)}`, { method: 'DELETE' });
	}

	/** Проверка здоровья сервиса. */
	health(): Promise<HealthResponse> {
		return this.request<HealthResponse>('/api/health');
	}
}

/** Создаёт клиента одной строкой: `createClient('http://localhost:3000')`. */
export function createClient(baseUrl: string, options: Partial<ClientOptions> = {}): PSearchClient {
	return new PSearchClient({ baseUrl, ...options });
}