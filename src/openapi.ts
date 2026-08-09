/** OpenAPI 3.1-спека API, отдаётся по GET /api/openapi.json. */

export interface OpenApiOptions {
	appName: string;
	version: string;
	auth: boolean;
}

export function buildOpenApi({ appName, version, auth }: OpenApiOptions): Record<string, unknown> {
	return {
		openapi: '3.1.0',
		info: {
			title: `${appName} — REST API`,
			description:
				'Backend поискового движка: полнотекстовый поиск BM25, обучение, файловая база s-db, бэкапы, ИИ-режим (RAG через провайдеров), каталог моделей, интеграция ботов.',
			version
		},
		servers: [{ url: '/', description: 'Текущий сервер' }],
		components: {
			securitySchemes: {
				BearerAuth: { type: 'http', scheme: 'bearer', description: 'API_KEY из .env' },
				ApiKeyHeader: { type: 'apiKey', in: 'header', name: 'X-API-Key', description: 'API_KEY из .env' }
			},
			schemas: {
				Doc: {
					type: 'object',
					properties: {
						id: { type: 'string' },
						title: { type: 'string' },
						content: { type: 'string' },
						keywords: { type: 'array', items: { type: 'string' } },
						tags: { type: 'array', items: { type: 'string' } },
						category: { type: 'string' },
						link: { type: 'string' }
					}
				},
				SearchResponse: {
					type: 'object',
					properties: {
						query: { type: 'string' },
						suggestion: { type: 'string' },
						total: { type: 'integer' },
						ms: { type: 'number' },
						results: { type: 'array', items: { $ref: '#/components/schemas/Hit' } }
					}
				},
				Hit: {
					type: 'object',
					properties: {
						id: { type: 'string' },
						title: { type: 'string' },
						link: { type: 'string' },
						category: { type: 'string' },
						score: { type: 'number' },
						snippet: { type: 'string' }
					}
				},
				Error: {
					type: 'object',
					properties: { error: { type: 'string' } }
				},
				AiSource: {
					type: 'object',
					properties: {
						id: { type: 'string' },
						title: { type: 'string' },
						link: { type: 'string' }
					}
				},
				AiChatResponse: {
					type: 'object',
					properties: {
						query: { type: 'string' },
						answer: { type: 'string' },
						sources: { type: 'array', items: { $ref: '#/components/schemas/AiSource' } },
						ms: { type: 'number' }
					}
				}
			}
		},
		security: auth ? [{ BearerAuth: [] }, { ApiKeyHeader: [] }] : [],
		paths: {
			'/api/health': {
				get: {
					summary: 'Состояние сервиса',
					security: [],
					responses: { 200: { description: 'OK: статус, статистика индекса, обучение' } }
				}
			},
			'/api/search': {
				get: {
					summary: 'Полнотекстовый поиск (BM25)',
					parameters: [
						queryParam('query', true, 'Поисковый запрос'),
						queryParam('limit', false, 'Лимит результатов (по умолчанию SEARCH_LIMIT)'),
						queryParam('category', false, 'Фильтр по категории'),
						queryParam('tags', false, 'Фильтр по тегам через запятую'),
						queryParam('fuzzy', false, 'Нечёткий поиск: 1/0'),
						queryParam('lang', false, 'Язык стемминга: auto|ru|en')
					],
					responses: {
						200: { description: 'Результаты поиска', content: jsonRef('SearchResponse') },
						400: { description: 'Нет query', content: jsonRef('Error') }
					}
				},
				post: {
					summary: 'Поиск (тело запроса)',
					requestBody: jsonBody({
						query: { type: 'string' },
						limit: { type: 'integer' },
						category: { type: 'string' },
						tags: { type: 'array', items: { type: 'string' } },
						fuzzy: { type: 'boolean' },
						lang: { type: 'string', enum: ['auto', 'ru', 'en'] }
					}),
					responses: {
						200: { description: 'Результаты поиска', content: jsonRef('SearchResponse') },
						400: { description: 'Нет query', content: jsonRef('Error') }
					}
				}
			},
			'/api/suggest': {
				get: {
					summary: 'Автодополнение: словарь + частые запросы (SEARCH_LEARN=queries)',
					parameters: [queryParam('query', true, 'Начало запроса'), queryParam('limit', false, 'Лимит (по умолчанию 8)')],
					responses: {
						200: { description: 'Подсказки', content: jsonBody({ query: { type: 'string' }, suggestions: { type: 'array', items: { type: 'string' } } }) }
					}
				}
			},
			'/api/context': {
				get: {
					summary: 'Контекст: категории, теги, статистика, обучение',
					responses: { 200: { description: 'Контекст набора' } }
				}
			},
			'/api/documents': {
				get: {
					summary: 'Список результатов поиска (корпус)',
					parameters: [
						queryParam('limit', false, 'Лимит (по умолчанию 50)'),
						queryParam('offset', false, 'Смещение'),
						queryParam('category', false, 'Фильтр по категории'),
						queryParam('tag', false, 'Фильтр по тегу')
					],
					responses: { 200: { description: 'Список + total', content: jsonBody({ total: { type: 'integer' }, documents: { type: 'array', items: { $ref: '#/components/schemas/Doc' } } }) } }
				}
			},
			'/api/dataset': {
				get: {
					summary: 'Экспорт набора данных: результаты, обучение',
					responses: { 200: { description: 'Полный набор' } }
				},
				post: {
					summary: 'Импорт набора: пересобирает индекс и сохраняет файл',
					requestBody: jsonBody({
						documents: { type: 'array', items: { $ref: '#/components/schemas/Doc' } }
					}),
					responses: {
						200: { description: 'Новый индекс', content: jsonBody({ total: { type: 'integer' }, documents: { type: 'array', items: { $ref: '#/components/schemas/Doc' } } }) },
						400: { description: 'Нет валидных результатов', content: jsonRef('Error') }
					}
				}
			},
			'/api/backup': {
				post: {
					summary: 'Создать бэкап s-db в data/backups/',
					responses: {
						200: { description: 'Бэкап создан', content: jsonBody({ backedUp: { type: 'boolean' }, file: { type: 'string' }, at: { type: 'string' } }) },
						400: { description: 'Бэкапы отключены (SEARCH_BACKUP=false)', content: jsonRef('Error') }
					}
				}
			},
			'/api/restore': {
				post: {
					summary: 'Откатить обучение из последнего бэкапа',
					responses: {
						200: { description: 'Откат выполнен' },
						404: { description: 'Нет бэкапов', content: jsonRef('Error') }
					}
				}
			},
			'/api/providers': {
				get: {
					summary: 'Каталог моделей (67 провайдеров из MODELS.txt)',
					parameters: [
						queryParam('group', false, 'Группа: AI-модели|Инфраструктура|Облака и шлюзы|Локальные'),
						queryParam('query', false, 'Фильтр по имени, id или моделям')
					],
					responses: { 200: { description: 'Каталог провайдеров' } }
				}
			},
			'/api/ai': {
				post: {
					summary: 'ИИ-режим: RAG по результатам поиска. Отвечает модель подключённого провайдера',
					description:
						'Требует настройку AI_PROVIDER (+ AI_API_KEY для облачных). Движок ищет топ-результаты, собирает промпт, вызывает модель и возвращает ответ с источниками.',
					requestBody: jsonBody({
						query: { type: 'string', description: 'Вопрос' },
						limit: { type: 'integer', description: 'Сколько результатов отдавать в контекст (по умолчанию 5)' },
						category: { type: 'string' },
						tags: { type: 'array', items: { type: 'string' } },
						lang: { type: 'string', enum: ['auto', 'ru', 'en'] }
					}),
					responses: {
						200: { description: 'Ответ модели с источниками', content: jsonRef('AiChatResponse') },
						400: { description: 'Нет query или ИИ не настроен', content: jsonRef('Error') },
						502: { description: 'Ошибка ИИ-провайдера', content: jsonRef('Error') }
					}
				}
			},
			'/api/bots': {
				get: {
					summary: 'Список зарегистрированных ботов',
					responses: { 200: { description: 'Боты' } }
				},
				post: {
					summary: 'Зарегистрировать бота',
					requestBody: jsonBody({
						name: { type: 'string' },
						platform: { type: 'string' },
						commands: { type: 'array', items: { type: 'string' } }
					}),
					responses: {
						201: { description: 'Бот создан' },
						400: { description: 'Нет name/platform', content: jsonRef('Error') }
					}
				}
			},
			'/api/bots/{name}': {
				delete: {
					summary: 'Убрать бота',
					parameters: [
						{
							name: 'name',
							in: 'path',
							required: true,
							schema: { type: 'string' },
							description: 'Имя бота'
						}
					],
					responses: {
						200: { description: 'Удалён' },
						404: { description: 'Не найден', content: jsonRef('Error') }
					}
				}
			},
			'/api/openapi.json': {
				get: {
					summary: 'Эта спецификация',
					security: [],
					responses: { 200: { description: 'OpenAPI 3.1' } }
				}
			},
			'/api/docs': {
				get: {
					summary: 'Swagger UI — интерактивная документация',
					security: [],
					responses: { 200: { description: 'HTML-страница' } }
				}
			}
		}
	};
}

function queryParam(name: string, required: boolean, description: string): Record<string, unknown> {
	return { name, in: 'query', required, schema: { type: 'string' }, description };
}

function jsonBody(schema: Record<string, unknown>): Record<string, unknown> {
	return {
		required: true,
		content: { 'application/json': { schema: { type: 'object', properties: schema } } }
	};
}

function jsonRef(ref: string): Record<string, unknown> {
	return { 'application/json': { schema: { $ref: `#/components/schemas/${ref}` } } };
}

/** HTML-страница Swagger UI (внешний CDN, без npm-зависимостей). */
export function swaggerUiHtml(title: string): string {
	return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} — API</title>
<link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
<style>html{background:#f7f7f9}body{margin:0}</style>
</head>
<body>
<div id="swagger-ui"></div>
<script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
<script>
SwaggerUIBundle({ url: '/api/openapi.json', dom_id: '#swagger-ui', deepLinking: true });
</script>
</body>
</html>`;
}