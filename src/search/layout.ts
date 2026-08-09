/** Соответствие клавиш русской и английской раскладок. */
const RU_TO_EN: Record<string, string> = {
	й: 'q', ц: 'w', у: 'e', к: 'r', е: 't', н: 'y', г: 'u', ш: 'i', щ: 'o', з: 'p', х: '[', ъ: ']',
	ф: 'a', ы: 's', в: 'd', а: 'f', п: 'g', р: 'h', о: 'j', л: 'k', д: 'l', ж: ';', э: "'",
	я: 'z', ч: 'x', с: 'c', м: 'v', и: 'b', т: 'n', ь: 'm', б: ',', ю: '.'
};

const EN_TO_RU: Record<string, string> = {};
for (const [ru, en] of Object.entries(RU_TO_EN)) EN_TO_RU[en] = ru;

function mapWord(word: string, map: Record<string, string>, canMap: (c: string) => boolean): string | null {
	let out = '';
	for (const c of word) {
		if (!canMap(c)) return null;
		out += map[c] ?? c;
	}
	return out;
}

/** Переводит слово из русской раскладки в английскую (например, «yfgbcfk» → «написал»). */
export function fixLayout(word: string): { ru: string | null; en: string | null } {
	const lower = word.toLowerCase();
	return {
		ru: /[a-z]/i.test(lower) ? mapWord(lower, EN_TO_RU, (c) => /[a-z\p{Pi}\p{Pf},.;'`-]/u.test(c)) : null,
		en: /[а-яё]/i.test(lower) ? mapWord(lower, RU_TO_EN, (c) => /[а-яё]/i.test(c)) : null
	};
}

/** Проверяет наличие кириллицы в строке. */
export function hasCyrillic(s: string): boolean {
	return /[а-яё]/i.test(s);
}