/** ИИ-режим: реальные вызовы моделей через подключённых провайдеров. */

export interface AiSettings {
	/** Провайдер: openai, anthropic, google, deepseek, groq, mistral, moonshot, minimax, x-ai, openrouter, together, fireworks, cerebras, ollama, lmstudio. */
	provider: string | null;
	model: string | null;
	apiKey: string | null;
	/** Кастомный base-url для OpenAI-совместимых провайдеров. */
	baseUrl: string | null;
}

export interface AiSource {
	id: string;
	title: string;
	link: string;
}

export interface AiResult {
	query: string;
	answer: string;
	sources: AiSource[];
	ms: number;
}

interface ProviderDefaults {
	baseUrl: string;
	model: string;
	kind: 'openai' | 'anthropic' | 'gemini';
}

const PROVIDER_DEFAULTS: Record<string, ProviderDefaults> = {
	openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o', kind: 'openai' },
	deepseek: { baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat', kind: 'openai' },
	groq: { baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.1-8b', kind: 'openai' },
	together: { baseUrl: 'https://api.together.xyz/v1', model: 'llama-3.1-405b', kind: 'openai' },
	fireworks: { baseUrl: 'https://api.fireworks.ai/inference/v1', model: 'kimi-k2-instruct', kind: 'openai' },
	cerebras: { baseUrl: 'https://api.cerebras.ai/v1', model: 'llama-3.1-8b', kind: 'openai' },
	mistral: { baseUrl: 'https://api.mistral.ai/v1', model: 'mistral-large', kind: 'openai' },
	moonshot: { baseUrl: 'https://api.moonshot.cn/v1', model: 'kimi-k2', kind: 'openai' },
	minimax: { baseUrl: 'https://api.minimax.chat/v1', model: 'minimax-m2.1', kind: 'openai' },
	'x-ai': { baseUrl: 'https://api.x.ai/v1', model: 'grok-2', kind: 'openai' },
	openrouter: { baseUrl: 'https://openrouter.ai/api/v1', model: 'anthropic/claude-sonnet-4', kind: 'openai' },
	ollama: { baseUrl: 'http://localhost:11434/v1', model: 'llama3', kind: 'openai' },
	lmstudio: { baseUrl: 'http://localhost:1234/v1', model: 'local-model', kind: 'openai' },
	anthropic: { baseUrl: 'https://api.anthropic.com/v1', model: 'claude-sonnet-4', kind: 'anthropic' },
	google: { baseUrl: 'https://generativelanguage.googleapis.com', model: 'gemini-2.5-flash', kind: 'gemini' },
	gemini: { baseUrl: 'https://generativelanguage.googleapis.com', model: 'gemini-2.5-flash', kind: 'gemini' }
};

/** OpenAI-совместимые провайдеры (chat/completions). */
export const OPENAI_COMPAT_PROVIDERS = Object.entries(PROVIDER_DEFAULTS)
	.filter(([, d]) => d.kind === 'openai')
	.map(([id]) => id);

/** Вызываем модель и возвращаем текст ответа. */
export async function runAi(settings: AiSettings, prompt: string, timeoutMs = 60000): Promise<string> {
	const provider = settings.provider?.toLowerCase() ?? '';
	const def = PROVIDER_DEFAULTS[provider];
	if (!def) {
		throw new Error(`Неизвестный провайдер «${provider}». Доступны: ${OPENAI_COMPAT_PROVIDERS.join(', ')}, anthropic, google`);
	}
	const baseUrl = (settings.baseUrl ?? def.baseUrl).replace(/\/+$/, '');
	const model = settings.model ?? def.model;
	const signal = AbortSignal.timeout(timeoutMs);

	if (def.kind === 'anthropic') {
		if (!settings.apiKey) throw new Error(`Для провайдера «${provider}» нужен AI_API_KEY`);
		const response = await fetch(`${baseUrl}/messages`, {
			method: 'POST',
			signal,
			headers: {
				'Content-Type': 'application/json',
				'x-api-key': settings.apiKey,
				'anthropic-version': '2023-06-01'
			},
			body: JSON.stringify({ model, max_tokens: 1024, messages: [{ role: 'user', content: prompt }] })
		});
		const data = await readJson(response, provider);
		const block = firstOf(data?.content);
		const text = (block as { text?: unknown } | undefined)?.text;
		if (typeof text !== 'string') throw new Error(`Пустой ответ провайдера «${provider}»`);
		return text;
	}

	if (def.kind === 'gemini') {
		const response = await fetch(
			`${baseUrl}/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(settings.apiKey ?? '')}`,
			{
				method: 'POST',
				signal,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] })
			}
		);
		const data = await readJson(response, provider);
		const candidate = firstOf(data?.candidates) as { content?: { parts?: unknown[] } } | undefined;
		const part = Array.isArray(candidate?.content?.parts) ? candidate.content.parts[0] : undefined;
		const text = (part as { text?: unknown } | undefined)?.text;
		if (typeof text !== 'string') throw new Error(`Пустой ответ провайдера «${provider}»`);
		return text;
	}

	// OpenAI-совместимые: openai, deepseek, groq, together, fireworks, cerebras,
	// mistral, moonshot, minimax, x-ai, openrouter, ollama, lmstudio.
	const headers: Record<string, string> = { 'Content-Type': 'application/json' };
	if (settings.apiKey) headers.Authorization = `Bearer ${settings.apiKey}`;
	const response = await fetch(`${baseUrl}/chat/completions`, {
		method: 'POST',
		signal,
		headers,
		body: JSON.stringify({
			model,
			messages: [{ role: 'user', content: prompt }],
			temperature: 0.3,
			max_tokens: 1024
		})
	});
	const data = await readJson(response, provider);
	const choice = firstOf(data?.choices) as { message?: { content?: unknown } } | undefined;
	const text = choice?.message?.content;
	if (typeof text !== 'string') throw new Error(`Пустой ответ провайдера «${provider}»`);
	return text;
}

/** Первый элемент массива (если это массив). */
function firstOf(value: unknown): unknown {
	return Array.isArray(value) ? value[0] : undefined;
}

async function readJson(response: Response, provider: string): Promise<Record<string, unknown> | null> {
	if (!response.ok) {
		const body = await response.text().catch(() => '');
		throw new Error(`Провайдер «${provider}»: ${response.status} ${body.slice(0, 300)}`);
	}
	try {
		return (await response.json()) as Record<string, unknown>;
	} catch {
		throw new Error(`Провайдер «${provider}»: ответ не JSON`);
	}
}

/** Собирает промпт для RAG «поиск + генерация». */
export function buildRagPrompt(query: string, documents: { title: string; link: string; excerpt: string }[]): string {
	const context = documents
		.map((d, i) => `${i + 1}. Заголовок: ${d.title}\n   Ссылка: ${d.link}\n   Содержимое: ${d.excerpt}`)
		.join('\n\n');
	return [
		'Ты — поисковый ассистент. Отвечай на языке вопроса (обычно русский).',
		'Отвечай ТОЛЬКО по приведённым ниже результатам поиска. Если в результатах нет ответа — честно скажи «В результатах поиска нет ответа», не выдумывай.',
		'В конце ответа укажи источники номерами [1], [2] и списком ссылок.',
		'',
		'Результаты поиска:',
		context || '— результатов нет —',
		'',
		`Вопрос: ${query}`
	].join('\n');
}