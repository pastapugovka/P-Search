import type { BotInfo } from '../search/types.js';

/** Реестр подключённых ботов: команды появляются в палитре «/». */
export class BotRegistry {
	private bots = new Map<string, BotInfo>();

	constructor(initial?: BotInfo[]) {
		for (const bot of initial ?? []) this.register(bot);
	}

	/** Регистрирует или обновляет бота по имени. */
	register(bot: BotInfo): BotInfo {
		const name = bot.name.trim();
		if (!name) throw new Error('Имя бота не может быть пустым');
		const info: BotInfo = {
			name,
			platform: bot.platform,
			commands: [...new Set(bot.commands.map((c) => c.trim()).filter(Boolean))]
		};
		this.bots.set(name, info);
		return info;
	}

	/** Возвращает список всех ботов. */
	list(): BotInfo[] {
		return [...this.bots.values()];
	}

	/** Возвращает бота по имени. */
	get(name: string): BotInfo | undefined {
		return this.bots.get(name);
	}

	/** Отключает бота. */
	remove(name: string): boolean {
		return this.bots.delete(name);
	}
}