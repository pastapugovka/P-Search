import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { createApp } from './app.js';
import { config, ROOT } from './config.js';
import { SearchEngine } from './search/engine.js';
import { BotRegistry } from './search/bots.js';
import { Learner } from './search/learner.js';
import { Store } from './search/store.js';
import type { Doc } from './search/types.js';

const VERSION = '2.0.0';

function loadDocs(): Doc[] {
	const path = isAbsolute(config.dataPath) ? config.dataPath : join(ROOT, config.dataPath);
	const raw = readFileSync(path, 'utf8');
	const data = JSON.parse(raw) as Doc[] | { documents: Doc[] };
	return Array.isArray(data) ? data : data.documents;
}

function resolveDataPath(): string {
	return isAbsolute(config.dataPath) ? config.dataPath : join(ROOT, config.dataPath);
}

try {
	console.log(`[${config.appName}] Загрузка данных: ${config.dataPath}`);
	const docs = loadDocs();

	console.log(`[${config.appName}] Построение индекса…`);
	let engine = new SearchEngine(docs, config.engine);
	const stats = engine.context().stats;
	console.log(
		`[${config.appName}] Индекс готов: ${stats.docs} результатов поиска, ${stats.terms} терминов за ${stats.buildMs} мс`
	);

	// --- Обучение и база s-db ----------------------------------------------
	const store = new Store(config.sDbPath, config.backupDir, config.backupEnabled);
	const learner = new Learner(store.load());

	const engineHolder = {
		get(): SearchEngine {
			return engine;
		},
		set(next: SearchEngine): void {
			engine = next;
		}
	};

	// Отложенное сохранение: не дёргаем диск на каждый запрос.
	let saveTimer: ReturnType<typeof setTimeout> | null = null;
	const scheduleSave = () => {
		if (saveTimer) clearTimeout(saveTimer);
		saveTimer = setTimeout(() => {
			store.save(learner.snapshot());
		}, 1500);
	};

	const shutdown = () => {
		if (saveTimer) clearTimeout(saveTimer);
		const saved = store.save(learner.snapshot());
		console.log(`[${config.appName}] ${saved ? 'Обучение сохранено в' : 'Сохранение пропущено (SEARCH_BACKUP=false): данные не теряются, база'} s-db`);
		process.exit(0);
	};
	process.on('SIGINT', shutdown);
	process.on('SIGTERM', shutdown);

	const bots = new BotRegistry(config.botName ? [{ name: config.botName, platform: 'env', commands: ['/help'] }] : []);
	const app = createApp({
		engine: engineHolder,
		learner,
		store,
		learnMode: config.learn,
		scheduleSave,
		rebuild: (nextDocs: Doc[]) => {
			const next = new SearchEngine(nextDocs, config.engine);
			engineHolder.set(next);
			persistDataset(nextDocs, store);
			console.log(`[${config.appName}] Набор обновлён: ${nextDocs.length} результатов поиска`);
			return next;
		},
		bots,
		startedAt: Date.now(),
		version: VERSION
	});

	app.listen(config.port, config.host, () => {
		console.log(`[${config.appName}] Сервер запущен: http://${config.host}:${config.port}`);
		console.log(
			`[${config.appName}] API: /api/search  /api/suggest  /api/context  /api/documents  /api/dataset  /api/backup  /api/restore  /api/providers  /api/bots  /api/health`
		);
		if (!config.backupEnabled) {
			console.log(`[${config.appName}] Бэкапы отключены (SEARCH_BACKUP=false): данные не теряются, запись в базу приостановлена`);
		}
		if (config.learn === 'queries') {
			console.log(`[${config.appName}] Обучение на запросах (SEARCH_LEARN=queries): запомнено ${learner.count} запросов`);
		}
	});
} catch (error) {
	console.error(`[${config.appName}] Ошибка запуска:`, error);
	process.exit(1);
}

/** Сохраняет импортированный набор в файл SEARCH_DATA. */
function persistDataset(docs: Doc[], store: Store): void {
	try {
		const path = resolveDataPath();
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, JSON.stringify(docs, null, 2), 'utf8');
		if (existsSync(config.sDbPath)) {
			store.keepExternal(join(dirname(config.sDbPath), 's-db.previous.json'));
		}
	} catch (error) {
		console.error('[s-db] Не удалось сохранить набор:', (error as Error).message);
	}
}