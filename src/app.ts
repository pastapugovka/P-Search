import express, { type NextFunction, type Request, type Response } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { config } from './config.js';
import { buildRagPrompt, runAi } from './ai.js';
import { buildOpenApi, swaggerUiHtml } from './openapi.js';
import type { SearchEngine } from './search/engine.js';
import type { BotRegistry } from './search/bots.js';
import type { Learner } from './search/learner.js';
import type { Store } from './search/store.js';
import type { Doc } from './search/types.js';
import { PROVIDERS } from './search/providers.js';

export interface Dependencies {
	engine: { get(): SearchEngine; set(next: SearchEngine): void };
	learner: Learner;
	store: Store;
	learnMode: 'dataset' | 'queries';
	/** Отложенное сохранение обучения в базу. */
	scheduleSave: () => void;
	/** Полная замена набора: пересобирает индекс и сохраняет файл данных. */
	rebuild: (docs: Doc[]) => SearchEngine;
	bots: BotRegistry;
	startedAt: number;
	version: string;
}

/** Создаёт Express-приложение с CORS и REST API. */
export function createApp(deps: Dependencies): express.Express {
	const app = express();
	app.disable('x-powered-by');
	app.use(express.json({ limit: '10mb' }));

	// --- CORS -------------------------------------------------------------
	app.use((req: Request, res: Response, next: NextFunction) => {
		const origin = config.corsOrigin === '*' ? req.headers.origin || '*' : config.corsOrigin;
		res.setHeader('Access-Control-Allow-Origin', origin);
		res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
		res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
		res.setHeader('Access-Control-Max-Age', '86400');
		if (req.method === 'OPTIONS') {
			res.status(204).end();
			return;
		}
		next();
	});

	// --- Авторизация по API-ключу --------------------------------------------
	// Если задан API_KEY, все /api/* требуют ключ (кроме health, openapi, docs).
	// Ключ передаётся заголовком Authorization: Bearer <ключ> или X-API-Key: <ключ>.
	if (config.apiKey) {
		const expected = Buffer.from(config.apiKey);
		app.use((req: Request, res: Response, next: NextFunction) => {
			const path = req.path;
			if (path === '/api/health' || path === '/api/openapi.json' || path === '/api/docs') {
				next();
				return;
			}
			if (path.startsWith('/api/')) {
				const header = req.headers.authorization;
				const raw = header?.startsWith('Bearer ') ? header.slice(7) : (req.headers['x-api-key'] as string | undefined);
				if (raw && Buffer.from(raw).length === expected.length && timingSafeEqual(Buffer.from(raw), expected)) {
					next();
					return;
				}
				res.status(401).json({ error: 'Требуется API-ключ: Authorization: Bearer <ключ> или X-API-Key: <ключ>' });
				return;
			}
			next();
		});
	}

	// --- Корень: справочник API --------------------------------------------
	app.get('/', (_req: Request, res: Response) => {
		res.json({
			app: config.appName,
			version: deps.version,
			backup: deps.store.isEnabled,
			endpoints: {
				search: 'GET /api/search?query=…',
				suggest: 'GET /api/suggest?query=…',
				context: 'GET /api/context',
				documents: 'GET /api/documents',
				dataset: 'GET /api/dataset — экспорт, POST — импорт',
				backup: 'POST /api/backup',
				restore: 'POST /api/restore',
				providers: 'GET /api/providers',
				bots: 'GET /api/bots',
				ai: 'POST /api/ai — ИИ-режим (нужен AI_PROVIDER)',
				openapi: 'GET /api/openapi.json',
				docs: 'GET /api/docs — Swagger UI',
				health: 'GET /api/health'
			}
		});
	});

	// --- Здоровье ----------------------------------------------------------
	app.get('/api/health', (_req: Request, res: Response) => {
		const stats = deps.engine.get().context().stats;
		res.json({
			status: 'ok',
			app: config.appName,
			version: deps.version,
			uptime: Math.round(process.uptime() * 10) / 10,
			docs: stats.docs,
			terms: stats.terms,
			indexBuildMs: stats.buildMs,
			learning: {
				mode: deps.learnMode,
				queries: deps.learner.count,
				backup: config.backupEnabled
			},
			timestamp: new Date().toISOString()
		});
	});

	// --- Поиск (GET и POST) ------------------------------------------------
	const searchHandler = (req: Request, res: Response) => {
		const query = (req.method === 'POST' ? (req.body?.query ?? req.body?.search) : req.query.query) as string | undefined;
		const limit = parseLimit(req, 'limit', config.engine.limit);
		const category = strParam(req, 'category');
		const tags = splitParam(req, 'tags');
		const fuzzy = boolParam(req, 'fuzzy', config.engine.fuzzy);
		const lang = langParam(req);

		if (!query) {
			res.status(400).json({ error: 'Параметр query обязателен' });
			return;
		}
		const result = deps.engine.get().search(query, { limit, category, tags, fuzzy, lang });
		if (deps.learnMode === 'queries' && result.query) {
			deps.learner.remember(result.query);
			deps.scheduleSave();
		}
		res.json(result);
	};
	app.get('/api/search', searchHandler);
	app.post('/api/search', searchHandler);

	// --- Автодополнение ----------------------------------------------------
	app.get('/api/suggest', (req: Request, res: Response) => {
		const query = (req.query.query as string | undefined) ?? req.body?.query;
		if (!query) {
			res.json({ query: '', suggestions: [] });
			return;
		}
		const limit = parseLimit(req, 'limit', 8);
		const definitions = deps.engine.get().suggest(query, limit);
		const popular: string[] = deps.learnMode === 'queries' ? deps.learner.top(query, limit) : [];
		const suggestions = [...popular, ...definitions.filter((s) => !popular.includes(s))].slice(0, limit);
		res.json({ query, suggestions });
	});

	// --- Контекст: категории, теги, статистика, обучение --------------------
	app.get('/api/context', (_req: Request, res: Response) => {
		res.json({
			...deps.engine.get().context(),
			learning: {
				mode: deps.learnMode,
				queries: deps.learner.count
			}
		});
	});

	// --- Результаты поиска (корпус) ----------------------------------------
	app.get('/api/documents', (req: Request, res: Response) => {
		const limit = parseLimit(req, 'limit', 50);
		const offset = parseLimit(req, 'offset', 0);
		const category = strParam(req, 'category');
		const tag = strParam(req, 'tag');
		res.json(deps.engine.get().listDocuments({ limit, offset, category, tag }));
	});

	// --- Набор данных: экспорт и импорт ------------------------------------
	app.get('/api/dataset', (_req: Request, res: Response) => {
		res.json({
			total: deps.engine.get().docs.length,
			documents: deps.engine.get().docs,
			learning: deps.learner.snapshot()
		});
	});

	app.post('/api/dataset', (req: Request, res: Response) => {
		const body = req.body ?? {};
		const raw: unknown = Array.isArray(body) ? body : body.documents;
		if (!Array.isArray(raw)) {
			res.status(400).json({ error: 'Ожидается массив документов или поле documents' });
			return;
		}
		const docs = raw
			.map((d) => d as Record<string, unknown>)
			.filter((d) => d && typeof d.id === 'string' && typeof d.title === 'string' && typeof d.content === 'string')
			.map((d) => ({
				id: d.id as string,
				title: d.title as string,
				content: d.content as string,
				keywords: Array.isArray(d.keywords) ? d.keywords : (d.keywords as string[] | undefined),
				tags: Array.isArray(d.tags) ? d.tags : (d.tags as string[] | undefined),
				category: typeof d.category === 'string' ? d.category : undefined,
				link: typeof d.link === 'string' ? d.link : undefined
			}));
		if (docs.length === 0) {
			res.status(400).json({ error: 'Нет валидных результатов поиска (нужны id, title, content)' });
			return;
		}
		const engine = deps.rebuild(docs);
		res.status(200).json({ total: engine.docs.length, documents: engine.docs });
	});

	// --- Бэкапы обучения ---------------------------------------------------
	app.post('/api/backup', (_req: Request, res: Response) => {
		const result = deps.store.backup(deps.learner.snapshot());
		if (!result.ok) {
			res.status(400).json({ error: 'Бэкапы отключены (SEARCH_BACKUP=false)' });
			return;
		}
		res.json({ backedUp: true, file: result.file, at: new Date().toISOString() });
	});

	app.post('/api/restore', (_req: Request, res: Response) => {
		const result = deps.store.restore();
		if (!result.restored) {
			res.status(404).json({ error: 'Нет бэкапов для отката' });
			return;
		}
		deps.learner.replace(result.queries);
		res.json({ restored: true, snapshot: result.snapshot, queries: deps.learner.count });
	});

	// --- Провайдеры ---------------------------------------------------------
	app.get('/api/providers', (req: Request, res: Response) => {
		const group = strParam(req, 'group');
		const query = (req.query.query as string | undefined)?.toLowerCase();
		let providers = PROVIDERS;
		if (group) providers = providers.filter((p) => p.group.toLowerCase() === group.toLowerCase());
		if (query) providers = providers.filter((p) => `${p.name} ${p.id} ${p.models.join(' ')}`.toLowerCase().includes(query));
		res.json({ total: providers.length, providers });
	});

	// --- Боты ---------------------------------------------------------------
	app.get('/api/bots', (_req: Request, res: Response) => {
		res.json({ total: deps.bots.list().length, bots: deps.bots.list() });
	});
	app.post('/api/bots', (req: Request, res: Response) => {
		const { name, platform, commands } = req.body ?? {};
		if (!name || !platform) {
			res.status(400).json({ error: 'Поля name и platform обязательны' });
			return;
		}
		const bot = deps.bots.register({
			name,
			platform,
			commands: Array.isArray(commands) ? commands : ['/help']
		});
		res.status(201).json(bot);
	});
	app.delete('/api/bots/:name', (req: Request, res: Response) => {
		const removed = deps.bots.remove(String(req.params.name));
		res.status(removed ? 200 : 404).json({ removed });
	});

	// --- ИИ-режим: RAG по результатам поиска ----------------------------------
	app.post('/api/ai', async (req: Request, res: Response) => {
		const settings = config.ai;
		if (!settings.provider) {
			res.status(400).json({ error: 'ИИ-режим не настроен: задайте AI_PROVIDER в .env (например AI_PROVIDER=openai)' });
			return;
		}
		const query = (req.body?.query ?? req.body?.question) as string | undefined;
		if (!query?.trim()) {
			res.status(400).json({ error: 'Параметр query обязателен' });
			return;
		}
		const limit = parseLimit(req, 'limit', 5);
		const category = strParam(req, 'category');
		const tags = splitParam(req, 'tags');
		const lang = langParam(req);

		const started = performance.now();
		try {
			// Движок ищет топ-результаты, из них собирается контекст для модели.
			const result = deps.engine.get().search(query, { limit, category, tags, fuzzy: true, lang });
			const engine = deps.engine.get();
			const documents = result.hits
				.map((hit) => engine.docs.find((d) => d.id === hit.id))
				.filter((d): d is Doc => Boolean(d))
				.map((d) => ({
					title: d.title,
					link: d.link ?? '',
					excerpt: d.content.slice(0, 1500)
				}));
			const answer = await runAi(settings, buildRagPrompt(query, documents));
			res.json({
				query,
				answer,
				sources: documents.map((d, i) => ({ id: String(i + 1), title: d.title, link: d.link })),
				ms: Math.round(performance.now() - started)
			});
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			console.error(`[ai-ошибка] ${message}`);
			res.status(502).json({ error: `Ошибка ИИ-провайдера: ${message}` });
		}
	});

	// --- OpenAPI ------------------------------------------------------------
	app.get('/api/openapi.json', (_req: Request, res: Response) => {
		res.json(buildOpenApi({ appName: config.appName, version: deps.version, auth: Boolean(config.apiKey) }));
	});

	app.get('/api/docs', (_req: Request, res: Response) => {
		res.type('html').send(swaggerUiHtml(config.appName));
	});

	// --- 404 и ошибки -------------------------------------------------------
	app.use((_req: Request, res: Response) => {
		res.status(404).json({ error: 'Маршрут не найден' });
	});
	app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
		console.error(`[ошибка] ${err.message}`);
		res.status(500).json({ error: 'Внутренняя ошибка сервера' });
	});

	return app;
}

function parseLimit(req: Request, key: string, fallback: number): number {
	const raw = (req.query[key] as string | undefined) ?? req.body?.[key];
	const n = Number(raw);
	return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

function strParam(req: Request, key: string): string | null {
	const value = (req.query[key] as string | undefined) ?? req.body?.[key];
	return value?.trim() || null;
}

function splitParam(req: Request, key: string): string[] {
	const raw = (req.query[key] as string | undefined) ?? req.body?.[key];
	if (!raw) return [];
	return String(raw)
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean);
}

function boolParam(req: Request, key: string, fallback: boolean): boolean {
	const raw = (req.query[key] as string | undefined) ?? req.body?.[key];
	if (raw === undefined || raw === '') return fallback;
	return ['1', 'true', 'yes', 'on'].includes(String(raw).toLowerCase());
}

function langParam(req: Request): 'auto' | 'ru' | 'en' {
	const raw = strParam(req, 'lang');
	return raw === 'ru' || raw === 'en' ? raw : 'auto';
}