export interface HighlightOptions {
	width: number;
	maxFragments: number;
	markTag: string;
	ellipsis?: string;
}

/**
 * Собирает фрагменты текста вокруг совпадений.
 * Совпадения оборачиваются в тег выделения (по умолчанию <mark>),
 * края обрезаются многоточием.
 */
export function buildFragments(text: string, terms: string[], opts: HighlightOptions): string[] {
	const ell = opts.ellipsis ?? '…';
	if (!text) return [];

	const nonEmpty = terms.filter((t) => t.length > 0);
	if (nonEmpty.length === 0) {
		const head = text.slice(0, opts.width);
		return [head.length < text.length ? `${head}${ell}` : head];
	}

	// Все позиции совпадений, без пересечений.
	const ranges: { start: number; end: number }[] = [];
	for (const term of nonEmpty) {
		const lower = term.toLowerCase();
		let idx = text.toLowerCase().indexOf(lower);
		while (idx !== -1) {
			const end = idx + lower.length;
			const prev = ranges[ranges.length - 1];
			if (prev && idx < prev.end) {
				// сливаем пересекающиеся совпадения
				if (end > prev.end) prev.end = end;
			} else {
				ranges.push({ start: idx, end });
			}
			idx = text.toLowerCase().indexOf(lower, idx + 1);
		}
	}

	// Центрируем каждое совпадение и обрезаем до окна.
	const window = Math.max(20, Math.floor(opts.width / 2));
	const fragments: string[] = [];
	for (const r of ranges.slice(0, opts.maxFragments)) {
		const start = Math.max(0, r.start - window);
		const end = Math.min(text.length, r.end + window);
		const prefix = start > 0 ? ell : '';
		let frag = text.slice(start, end);
		const regex = new RegExp(
			`(${nonEmpty.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`,
			'gi'
		);
		frag = frag.replace(regex, `<${opts.markTag}>$1</${opts.markTag}>`);
		fragments.push(prefix + frag + (end < text.length ? ell : ''));
	}
	return fragments.length > 0 ? fragments : [text.slice(0, opts.width)];
}