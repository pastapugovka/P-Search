/** Частоты поисковых запросов: ядро обучения в режиме SEARCH_LEARN=queries. */
export class Learner {
	private frequencies = new Map<string, number>();

	constructor(initial: Record<string, number> = {}) {
		this.replace(initial);
	}

	/** Запоминает запрос: частота растёт, частые всплывают первыми. */
	remember(query: string): void {
		const q = query.trim().toLowerCase();
		if (!q) return;
		this.frequencies.set(q, (this.frequencies.get(q) ?? 0) + 1);
	}

	/** Популярные запросы с префиксом — подсказки «по мере ввода». */
	top(prefix: string, limit = 8): string[] {
		const p = prefix.trim().toLowerCase();
		return [...this.frequencies.entries()]
			.filter(([q]) => q.startsWith(p))
			.sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
			.slice(0, limit)
			.map(([q]) => q);
	}

	/** Полное состояние для сохранения в базе. */
	snapshot(): Record<string, number> {
		return Object.fromEntries([...this.frequencies.entries()].sort((a, b) => b[1] - a[1]));
	}

	/** Заменяет состояние (загрузка из базы или откат). */
	replace(data: Record<string, number> = {}): void {
		this.frequencies = new Map(Object.entries(data).map(([q, n]) => [q, Math.max(1, Math.floor(n))]));
	}

	/** Сколько запросов запомнено. */
	get count(): number {
		return this.frequencies.size;
	}

	/** Сбрасывает обучение. */
	clear(): void {
		this.frequencies.clear();
	}
}