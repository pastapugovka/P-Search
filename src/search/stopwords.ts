/** Стоп-слова русского языка: исключаются из индекса и запросов. */
export const STOP_RU = new Set([
	'а', 'без', 'более', 'больше', 'бы', 'был', 'была', 'были', 'было', 'быть', 'в', 'вам', 'вас', 'вдруг',
	'весь', 'во', 'вот', 'все', 'всего', 'всех', 'вы', 'где', 'да', 'даже', 'для', 'до', 'его', 'ее', 'ей',
	'ему', 'если', 'есть', 'еще', 'ещё', 'ж', 'же', 'за', 'зачем', 'здесь', 'и', 'из', 'или', 'им', 'их',
	'к', 'как', 'какая', 'какие', 'какой', 'когда', 'кого', 'ком', 'которая', 'которого', 'которой',
	'которые', 'который', 'которых', 'кто', 'куда', 'ли', 'либо', 'лучше', 'между', 'меня', 'мне', 'много',
	'может', 'можно', 'моя', 'мои', 'мой', 'мы', 'на', 'над', 'надо', 'нас', 'не', 'него', 'нее', 'ней',
	'нет', 'ни', 'нибудь', 'никогда', 'них', 'ничего', 'но', 'ну', 'о', 'об', 'один', 'одна', 'одно',
	'около', 'он', 'она', 'они', 'оно', 'от', 'отчего', 'очень', 'перед', 'по', 'под', 'после', 'потом',
	'почему', 'поэтому', 'при', 'про', 'разве', 'с', 'сам', 'сама', 'сами', 'самое', 'самый', 'свою',
	'своя', 'свои', 'свой', 'себе', 'себя', 'сейчас', 'со', 'совсем', 'так', 'такая', 'также', 'такие',
	'такой', 'там', 'те', 'тебе', 'тебя', 'тем', 'теперь', 'то', 'тогда', 'того', 'тоже', 'той', 'только',
	'том', 'тот', 'тут', 'ты', 'у', 'уж', 'уже', 'чего', 'чем', 'через', 'что', 'чтоб', 'чтобы', 'чья',
	'чье', 'чьи', 'чуть', 'эта', 'эти', 'этим', 'этих', 'это', 'этого', 'этой', 'этом', 'этот', 'эту', 'я'
]);

/** Стоп-слова английского языка. */
export const STOP_EN = new Set([
	'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'arent',
	'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'can',
	'cant', 'cannot', 'could', 'couldnt', 'did', 'didnt', 'do', 'does', 'doesnt', 'doing', 'dont', 'down',
	'during', 'each', 'few', 'for', 'from', 'further', 'had', 'hadnt', 'has', 'hasnt', 'have', 'havent',
	'having', 'he', 'hed', 'hell', 'hes', 'her', 'here', 'heres', 'hers', 'herself', 'him', 'himself', 'his',
	'how', 'hows', 'i', 'id', 'ill', 'im', 'ive', 'if', 'in', 'into', 'is', 'isnt', 'it', 'its', 'itself',
	'lets', 'me', 'more', 'most', 'mustnt', 'my', 'myself', 'no', 'nor', 'not', 'of', 'off', 'on', 'once',
	'only', 'or', 'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same', 'shant', 'she',
	'shed', 'shell', 'shes', 'should', 'shouldnt', 'so', 'some', 'such', 'than', 'that', 'thats', 'the',
	'their', 'theirs', 'them', 'themselves', 'then', 'there', 'theres', 'these', 'they', 'theyd', 'theyll',
	'theyre', 'theyve', 'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was',
	'wasnt', 'we', 'wed', 'well', 'were', 'weve', 'werent', 'what', 'whats', 'when', 'whens', 'where',
	'wheres', 'which', 'while', 'who', 'whos', 'whom', 'why', 'whys', 'with', 'wont', 'would', 'wouldnt',
	'you', 'youd', 'youll', 'youre', 'youve', 'your', 'yours', 'yourself', 'yourselves'
]);

/** Проверка: является ли слово стоп-словом (без учёта раскладки регистра). */
export function isStopWord(word: string): boolean {
	return STOP_RU.has(word) || STOP_EN.has(word);
}