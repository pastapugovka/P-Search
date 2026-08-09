export const RU_VOWELS = 'аеиоуыэюя';
const RV_RE = /^(.*?[аеиоуыэюя])(.*)$/;

const RU_PERFECTIVE_GERUND = /((ив|ивши|ившись|ыв|ывши|ывшись)|((?<=[ая])(в|вши|вшись)))$/;
const RU_ADJECTIVE = /(ее|ие|ые|ое|ими|ыми|ей|ий|ый|ой|ем|им|ым|ом|его|ого|ему|ому|их|ых|ую|юю|ая|яя|ою|ею)$/;
const RU_PARTICIPLE = /((ивш|ывш|ующ)|((?<=[ая])(ем|нн|вш|ющ|щ)))$/;
const RU_REFLEXIVE = /(с|ся)$/;
const RU_VERB =
	/((ила|ыла|ена|ейте|уйте|ите|или|ыли|ей|уй|ил|ыл|им|ым|ен|ило|ыло|ено|ять|ует|уют|ют|уйте|ите|ишь|ила|или|ыла|ыли|ый|ым|ому|ыми|ей|ое|ился|илась|ились|енось|итесь))|((?<=[ая])(ла|на|ете|йте|ли|й|л|ем|н|ло|но|ет|ют|ны|ть|ешь|нно))$/;
const RU_NOUN =
	/(а|ев|ов|ие|ье|е|иями|ями|ами|еи|ии|и|ией|ей|ой|ий|й|иям|ям|ием|ем|ам|ом|о|у|ах|иях|ях|ы|ь|ию|ью|ю|ия|ья|я)$/;
const RU_DERIVATIONAL = /[^аеиоуыэюя][аеиоуыэюя]+[^аеиоуыэюя]+[^аеиоуыэюя]/;
const RU_VOWEL_ENDING = /[^аеиоуыэюя][аеиоуыэюя]$/;
const RU_ENDING_Й = /(ей|ий|й)$/;

/** Русский стеммер: выделяет основу слова (адаптация классического алгоритма Портера). */
export function stemRussian(word: string): string {
	const w = word.toLowerCase().replace(/ё/g, 'е');
	const m = RV_RE.exec(w);
	if (!m) return w;
	const head = m[1];
	let rv = m[2];

	let next = rv.replace(RU_PERFECTIVE_GERUND, '');
	if (next !== rv) {
		rv = next;
	} else {
		next = rv.replace(RU_REFLEXIVE, '');
		if (next !== rv) rv = next;

		if (RU_ADJECTIVE.test(rv)) {
			rv = rv.replace(RU_ADJECTIVE, '');
			next = rv.replace(RU_PARTICIPLE, '');
			if (next !== rv) rv = next;
		} else {
			next = rv.replace(RU_VERB, '');
			if (next !== rv) rv = next;
		}
	}

	rv = rv.replace(/и$/, '');
	if (RU_DERIVATIONAL.test(rv)) {
		rv = rv.replace(/(ость|ост)$/, '');
	}
	next = rv.replace(RU_NOUN, '');
	if (next !== rv) rv = next;
	rv = rv.replace(/ь$/, '');
	if (!RU_VOWEL_ENDING.test(head + rv)) {
		rv = rv.replace(RU_ENDING_Й, '');
	}

	return head + rv;
}

const EN_VOWELS = 'aeiouy';

function isVowel(c: string): boolean {
	return EN_VOWELS.includes(c);
}

/** Мера m: число групп «гласная+согласная…» в хвосте слова. */
function measure(s: string): number {
	let n = 0;
	let i = 0;
	while (i < s.length) {
		while (i < s.length && !isVowel(s[i])) i++;
		if (i >= s.length) break;
		n++;
		while (i < s.length && isVowel(s[i])) i++;
	}
	return n;
}

function hasVowel(s: string): boolean {
	for (let i = 0; i < s.length; i++) if (isVowel(s[i])) return true;
	return false;
}

function endsDoubleConsonant(s: string): boolean {
	return s.length >= 2 && s[s.length - 1] === s[s.length - 2] && !isVowel(s[s.length - 1]);
}

function endsCvc(s: string): boolean {
	const n = s.length;
	if (n < 3) return false;
	const last = s[n - 1];
	return !isVowel(last) && isVowel(s[n - 2]) && !isVowel(s[n - 3]) && last !== 'w' && last !== 'x' && last !== 'y';
}

/** Английский стеммер Портера. */
export function stemEnglish(word: string): string {
	let w = word.toLowerCase();
	if (w.length < 3) return w;

	const tryStep = (suffixes: [string, string][], minM = 0): boolean => {
		for (const [suffix, replacement] of suffixes) {
			if (!w.endsWith(suffix)) continue;
			const stem = w.slice(0, -suffix.length);
			if (measure(stem) > minM) {
				w = stem + replacement;
				return true;
			}
		}
		return false;
	};

	// Шаг 1a
	if (w.endsWith('sses')) w = w.slice(0, -2);
	else if (w.endsWith('ies')) w = w.slice(0, -2);
	else if (w.endsWith('ss')) {
		/* без изменений */
	} else if (w.endsWith('s')) w = w.slice(0, -1);

	// Шаг 1b
	if (w.endsWith('eed')) {
		const stem = w.slice(0, -3);
		if (measure(stem) > 0) w = stem + 'ee';
	} else {
		let removed = false;
		let stem = '';
		if (w.endsWith('ed')) {
			stem = w.slice(0, -2);
			removed = true;
		} else if (w.endsWith('ing')) {
			stem = w.slice(0, -3);
			removed = true;
		}
		if (removed && hasVowel(stem)) {
			w = stem;
		}
		if (removed) {
			if (/(at|bl|iz)$/.test(w)) w += 'e';
			else if (endsDoubleConsonant(w) && !/(l|s|z)$/.test(w)) w = w.slice(0, -1);
			else if (measure(w) === 1 && endsCvc(w)) w += 'e';
		}
	}

	// Шаг 1c
	if (w.endsWith('y') && hasVowel(w.slice(0, -1))) w = w.slice(0, -1) + 'i';

	// Шаг 2
	tryStep([
		['ational', 'ate'],
		['tional', 'tion'],
		['enci', 'ence'],
		['anci', 'ance'],
		['izer', 'ize'],
		['abli', 'able'],
		['alli', 'al'],
		['entli', 'ent'],
		['eli', 'e'],
		['ousli', 'ous'],
		['ization', 'ize'],
		['ation', 'ate'],
		['ator', 'ate'],
		['alism', 'al'],
		['iveness', 'ive'],
		['fulness', 'ful'],
		['ousness', 'ous'],
		['aliti', 'al'],
		['iviti', 'ive'],
		['biliti', 'ble'],
		['logi', 'log']
	]);

	// Шаг 3
	tryStep([
		['icate', 'ic'],
		['ative', ''],
		['alize', 'al'],
		['iciti', 'ic'],
		['ical', 'ic'],
		['ful', ''],
		['ness', '']
	]);

	// Шаг 4
	tryStep(
		[
			['al', ''],
			['ance', ''],
			['ence', ''],
			['er', ''],
			['ic', ''],
			['able', ''],
			['ible', ''],
			['ant', ''],
			['ement', ''],
			['ment', ''],
			['ent', ''],
			['ism', ''],
			['ate', ''],
			['iti', ''],
			['ous', ''],
			['ive', ''],
			['ize', '']
		],
		1
	);

	// Шаг 5a
	if (w.endsWith('e')) {
		const stem = w.slice(0, -1);
		if (measure(stem) > 1 || (measure(stem) === 1 && !endsCvc(stem))) w = stem;
	}

	// Шаг 5b
	if (measure(w) > 1 && endsDoubleConsonant(w) && /(l|s|z)$/.test(w)) w = w.slice(0, -1);

	return w;
}

/** Определяет язык токена и возвращает основу слова. */
export function stemToken(token: string, lang: 'auto' | 'ru' | 'en' = 'auto'): string {
	if (/[а-яё]/i.test(token)) {
		return lang === 'en' ? token.toLowerCase() : stemRussian(token);
	}
	if (/[a-z]/i.test(token)) {
		return lang === 'ru' ? token.toLowerCase() : stemEnglish(token);
	}
	return token.toLowerCase();
}