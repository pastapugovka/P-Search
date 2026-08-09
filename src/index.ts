import { readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { createApp } from './app.js';
import { config, ROOT } from './config.js';
import { SearchEngine } from './search/engine.js';
import { BotRegistry } from './search/bots.js';
import type { Doc } from './search/types.js';

const VERSION = '2.0.0';

function loadDocs(): Doc[] {
	const path = isAbsolute(config.dataPath) ? config.dataPath : join(ROOT, config.dataPath);
	const raw = readFileSync(path, 'utf8');
	const data = JSON.parse(raw) as Doc[] | { documents: Doc[] };
	return Array.isArray(data) ? data : data.documents;
}

try {
	console.log(`[${config.appName}] Загрузка данных: ${config.dataPath}`);
	const docs = loadDocs();

	console.log(`[${config.appName}] Построение индекса…`);
	const engine = new SearchEngine(docs, config.engine);
	const stats = engine.context().stats;
	console.log(
		`[${config.appName}] Индекс готов: ${stats.docs} документов, ${stats.terms} терминов за ${stats.buildMs} мс`
	);

	const bots = new BotRegistry(config.botName ? [{ name: config.botName, platform: 'env', commands: ['/help'] }] : []);
	const app = createApp({ engine, bots, startedAt: Date.now(), version: VERSION });

	app.listen(config.port, config.host, () => {
		console.log(`[${config.appName}] Сервер запущен: http://${config.host}:${config.port}`);
		console.log(`[${config.appName}] API: /api/search  /api/suggest  /api/context  /api/documents  /api/health`);
	});
} catch (error) {
	console.error(`[${config.appName}] Ошибка запуска:`, error);
	process.exit(1);
}