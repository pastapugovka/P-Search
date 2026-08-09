/**
 * Расстояние Левенштейна с ранним выходом.
 * Возвращает -1, если расстояние превышает предел (быстрее, чем считать точно).
 */
export function levenshtein(a: string, b: string, limit = 2): number {
	if (a === b) return 0;
	if (Math.abs(a.length - b.length) > limit) return limit + 1;

	let prev = new Int32Array(b.length + 1);
	let curr = new Int32Array(b.length + 1);
	for (let j = 0; j <= b.length; j++) prev[j] = j;

	for (let i = 1; i <= a.length; i++) {
		curr[0] = i;
		let rowMin = curr[0];
		for (let j = 1; j <= b.length; j++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
			if (curr[j] < rowMin) rowMin = curr[j];
		}
		if (rowMin > limit) return limit + 1;
		const tmp = prev;
		prev = curr;
		curr = tmp;
	}
	return prev[b.length];
}

/** Ищет слова из словаря, близкие к запрошенному (расстояние ≤ limit). */
export function similarTerms(word: string, dictionary: Iterable<string>, limit = 2, max = 3): string[] {
	const low = word.toLowerCase();
	const found: { term: string; dist: number }[] = [];
	for (const term of dictionary) {
		const dist = levenshtein(low, term, limit);
		if (dist >= 0 && dist <= limit && dist > 0) {
			found.push({ term, dist });
			if (found.length >= max * 4) break;
		}
	}
	return found
		.sort((x, y) => x.dist - y.dist)
		.slice(0, max)
		.map((x) => x.term);
}