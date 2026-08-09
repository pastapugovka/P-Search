import express, { type NextFunction, type Request, type Response } from 'express';
import { config } from './config.js';
import type { SearchEngine } from './search/engine.js';
import type { BotRegistry } from './search/bots.js';
import { PROVIDERS } from './search/providers.js';

export interface Dependencies {
	engine: SearchEngine;
	bots: BotRegistry;
	startedAt: number;
	version: string;
}

/** Создаёт Express-приложение с CORS и REST API. */
export function createApp(deps: Dependencies): express.Express {
	const app = express();
	app.disable('x-powered-by');
	app.use(express.json({ limit: '2mb' }));

	// --- CORS -------------------------------------------------------------
	app.use((req: Request, res: Response, next: NextFunction) => {
		const origin = config.corsOrigin === '*' ? req.headers.origin || '*' : config.corsOrigin;
		res.setHeader('Access-Control-Allow-Origin', origin);
		res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
		res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
		res.setHeader('Access-Control-Max-Age', '86400');
		if (req.method === 'OPTIONS') {
			res.status(204).end();
			return;
		}
		next();
	});

	// --- Корень: справочник API --------------------------------------------
	app.get('/', (_req: Request, res: Response) => {
		res.json({
			app: config.appName,
			version: deps.version,
			endpoints: {
				search: 'GET /api/search?query=…',
				suggest: 'GET /api/suggest?query=…',
				context: 'GET /api/context',
				documents: 'GET /api/documents',
				providers: 'GET /api/providers',
				bots: 'GET /api/bots',
				health: 'GET /api/health'
			}
		});
	});

	// --- Здоровье ----------------------------------------------------------
	app.get('/api/health', (_req: Request, res: Response) => {
		const stats = deps.engine.context().stats;
		res.json({
			status: 'ok',
			app: config.appName,
			version: deps.version,
			uptime: Math.round(process.uptime() * 10) / 10,
			docs: stats.docs,
			terms: stats.terms,
			indexBuildMs: stats.buildMs,
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
		const result = deps.engine.search(query, { limit, category, tags, fuzzy, lang });
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
		res.json({ query, suggestions: deps.engine.suggest(query, limit) });
	});

	// --- Контекст: категории, теги, статистика ------------------------------
	app.get('/api/context', (_req: Request, res: Response) => {
		res.json(deps.engine.context());
	});

	// --- Документы ----------------------------------------------------------
	app.get('/api/documents', (req: Request, res: Response) => {
		const limit = parseLimit(req, 'limit', 50);
		const offset = parseLimit(req, 'offset', 0);
		const category = strParam(req, 'category');
		const tag = strParam(req, 'tag');
		res.json(deps.engine.listDocuments({ limit, offset, category, tag }));
	});

	// --- Провайдеры ---------------------------------------------------------
	app.get('/api/providers', (req: Request, res: Response) => {
		const group = strParam(req, 'group');
		const query = (req.query.query as string | undefined)?.toLowerCase();
		let providers = PROVIDERS;
		if (group) providers = providers.filter((p) => p.group.toLowerCase() === group.toLowerCase());
		if (query) providers = providers.filter((p) => `${p.name} ${p.id}`.toLowerCase().includes(query));
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