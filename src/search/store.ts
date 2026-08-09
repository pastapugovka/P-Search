import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * Файловая база s-db: хранение обучения, бэкапы и откат.
 * По умолчанию включена: состояние переживает остановку сервиса.
 * SEARCH_BACKUP=false — запись в базу приостанавливается, данные не теряются.
 */
export class Store {
	constructor(
		private readonly file: string,
		private readonly backupDir: string,
		private readonly enabled: boolean
	) {}

	/** Бэкапы включены. */
	get isEnabled(): boolean {
		return this.enabled;
	}

	/** Загружает сохранённое состояние (если файл есть). */
	load(): Record<string, number> {
		try {
			const raw = readFileSync(this.file, 'utf8');
			const data = JSON.parse(raw) as { queries?: Record<string, number> };
			return data.queries ?? {};
		} catch {
			return {};
		}
	}

	/** Сохраняет состояние атомарно (tmp + rename). При отключённых бэкапах не пишет. */
	save(state: Record<string, number>): boolean {
		if (!this.enabled) return false;
		try {
			mkdirSync(dirname(this.file), { recursive: true });
			const tmp = `${this.file}.tmp`;
			writeFileSync(tmp, JSON.stringify({ savedAt: new Date().toISOString(), queries: state }, null, 2), 'utf8');
			renameSync(tmp, this.file);
			return true;
		} catch (error) {
			console.error('[s-db] Ошибка сохранения:', (error as Error).message);
			return false;
		}
	}

	/** Делает бэкап текущего состояния в каталог бэкапов. */
	backup(state: Record<string, number>): { ok: boolean; file?: string } {
		if (!this.enabled) return { ok: false };
		try {
			mkdirSync(this.backupDir, { recursive: true });
			const stamp = new Date().toISOString().replace(/[:.]/g, '-');
			const file = join(this.backupDir, `s-backup-${stamp}.json`);
			writeFileSync(file, JSON.stringify({ savedAt: new Date().toISOString(), queries: state }, null, 2), 'utf8');
			return { ok: true, file };
		} catch (error) {
			console.error('[s-db] Ошибка бэкапа:', (error as Error).message);
			return { ok: false };
		}
	}

	/** Список бэкапов от новых к старым. */
	snapshots(): string[] {
		try {
			if (!existsSync(this.backupDir)) return [];
			return readdirSync(this.backupDir)
				.filter((f) => f.endsWith('.json'))
				.sort()
				.reverse();
		} catch {
			return [];
		}
	}

	/** Откатывает к последнему бэкапу: возвращает состояние и обновляет базу. */
	restore(): { restored: boolean; queries: Record<string, number>; snapshot?: string } {
		const latest = this.snapshots()[0];
		if (!latest) return { restored: false, queries: {} };
		try {
			const raw = readFileSync(join(this.backupDir, latest), 'utf8');
			const data = JSON.parse(raw) as { queries?: Record<string, number> };
			const queries = data.queries ?? {};
			if (this.enabled) this.save(queries);
			return { restored: true, queries, snapshot: latest };
		} catch (error) {
			console.error('[s-db] Ошибка отката:', (error as Error).message);
			return { restored: false, queries: {} };
		}
	}

	/** Копия базы в каталог бэкапов (для внешнего хранения). */
	keepExternal(target: string): void {
		try {
			mkdirSync(dirname(target), { recursive: true });
			if (existsSync(this.file)) copyFileSync(this.file, target);
		} catch {
			/* внешнее хранилище недоступно — не критично */
		}
	}
}