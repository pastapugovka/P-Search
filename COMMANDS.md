# 🧭P-Search — справочник backend core

Полный справочник движка: REST API, операторы запроса, провайдеры, переменные окружения и скрипты запуска. Все возможности ядра доступны через API — палитра «/» и команды ботов лишь вызывают эндпоинты.

> 📄 Эндпоинты: [**`API.txt`**](./API.txt) · Модели: [**`MODELS.txt`**](./MODELS.txt) · Базы: [**`DATABASE.md`**](./DATABASE.md) · Обзор: [**`README.md`**](./README.md)

## 🎛️Команды палитры «/» = вызовы API

Каждая команда палитры реализована на уровне движка как REST-вызов. Клиенты отправляют запрос, ядро выполняет.

**Работа с поиском:**

- `/help` → `GET /` — справочник всех эндпоинтов

- `/clear` → `GET /api/search` — новый запрос очищает выдачу

- `/history` → `GET /api/context` — статистика запросов

**Данные и обучение:**

- `/export` → `GET /api/dataset` — экспорт набора в JSON

- `/import` → `POST /api/dataset` — импорт набора из JSON

- `/backup` → `POST /api/backup` — сохранить бэкап обучения

- `/restore` → `POST /api/restore` — откат к последнему бэкапу

- `/ai` → `POST /api/ai` — ответ модели по найденному (нужен `AI_PROVIDER`)

**Язык и настройки:**

- `/lang` → параметр `lang` (`auto`/`ru`/`en`)

- `/settings` → `GET /api/context` + переменные `.env`

- `/bot` → `GET/POST/DELETE /api/bots` — боты и их команды

Команды ботов появляются в палитре **автоматически** после привязки через `POST /api/bots` — см. раздел «Боты» в API-справочнике.

## 🔌Провайдеры «/P» — выбор модели через API

**Что делает:** команда `/P` подключает внешние модели и источники данных. Каталог провайдеров доступен через API: `GET /api/providers?group=…&query=…`.

**Формат команды:**

```bash
/P <провайдер> --source <ключ или путь> --model <модель> [--режим]
```

**Флаги:**

- `--source` — путь к источнику или API-ключ

- `--model` — нужная модель

- `--format` — формат данных: `json` / `csv` / `xml` / `api`

- `--sync` — подключить сразу

- `--async` — подключить в фоне

- `--disconnect` — отключить провайдера

**Примеры:**

```bash
/P anthropic --source sk-ant-xxx --model claude-3-5-sonnet --async
/P openai   --source sk-xxx     --model gpt-4o            --async
/P google   --source AIza-xxx   --model gemini-1-5-pro    --async
/P anthropic --disconnect
```

**Каталог провайдеров по группам — только полная поддержка:**

**AI-модели:**

- anthropic — Claude Opus 4, Sonnet 4, Haiku 4.5

- openai — GPT-5, GPT-5-nano, GPT-4o

- google — Gemini

- x-ai — Grok

- deepseek — V4 Pro, V3, R1

- mistral — Mistral Large, Medium, Mixtral 8x7B

- moonshot — Kimi K2, Moonshot V1

- minimax — M2.1

**Инфраструктура:**

- groq — Llama 3.1, Mixtral 8x7B

- cerebras — Qwen 3 Coder 480B

- fireworks — Kimi K2 Instruct

- together — Llama 3.1 405B, Qwen 2.5 72B

- baseten — Kimi K2 Instruct

- nvidia — Nemotron 3 Super 120B, Nemotron Mixture

- huggingface — Kimi-K2-Instruct, GLM-4.6

**Облака и шлюзы:**

- openrouter — 300+ моделей единым ключом

**Локальные:**

- ollama — Llama 3, Mistral, Qwen 2, GPT-OSS

- lmstudio — Gemma 3n E4B, любые скачанные модели

Каталог доступен через API: `GET /api/providers?group=AI-модели&query=claude`.

Полный список поддерживаемых моделей — в [**`MODELS.txt`**](./MODELS.txt).

## 🧭Операторы запроса — параметр `query`

Операторы сужают поиск до категории и тегов, управляют обязательностью слов. Всё это — синтаксис параметра `query` API.

- `@категория` — искать только в категории

- `#тег` — искать только результаты поиска с тегом

- `+слово` — слово обязательно в каждом результате

- `-слово` — исключить результаты поиска со словом

- `"фраза"` — искать точную фразу

**Примеры:**

```text
@инфраструктура docker   → docker в категории «инфраструктура»
#поиск стемминг          → стемминг среди результатов с тегом «поиск»
+контейнер -docker       → контейнер, но без docker
"поисковый бэкенд"       → точная фраза
```

## 🔗REST API

Все запросы — на `http://localhost:3000/api/…`. Полный список с примерами — в [**`API.txt`**](./API.txt).

**`GET /`** — справочник всех эндпоинтов

**`GET /api/health`** — статус сервиса

```bash
curl "http://localhost:3000/api/health"
```

**`GET /api/search?query=…`** — полнотекстовый поиск

**`POST /api/search`** — то же с параметрами в теле

Параметры: `query` (обязателен), `limit`, `category`, `tags` (через запятую), `fuzzy` (`true`/`false`), `lang` (`auto`/`ru`/`en`)

```bash
curl "http://localhost:3000/api/search?query=docker&limit=5&lang=ru"
curl -X POST "http://localhost:3000/api/search" \
  -H "Content-Type: application/json" \
  -d '{"query":"стемминг","tags":["поиск"],"fuzzy":true}'
```

**`GET /api/suggest?query=…`** — предиктивные подсказки по префиксу

Параметры: `query`, `limit` (по умолчанию 8)

```bash
curl "http://localhost:3000/api/suggest?query=пои&limit=5"
```

**`GET /api/context`** — категории, теги и статистика индекса

**`GET /api/documents`** — результаты поиска (корпус)

Параметры: `limit` (по умолчанию 50), `offset`, `category`, `tag`

```bash
curl "http://localhost:3000/api/documents?category=инфраструктура&limit=10"
```

**`GET /api/dataset`** — экспорт набора данных в JSON

**`POST /api/dataset`** — импорт набора данных из JSON

```bash
curl "http://localhost:3000/api/dataset" -o dataset.json
curl -X POST "http://localhost:3000/api/dataset" \
  -H "Content-Type: application/json" \
  --data-binary "@dataset.json"
```

**`POST /api/backup`** — сохранить бэкап обучения в базу данных

**`POST /api/restore`** — откатить обучение к последнему бэкапу из базы

```bash
curl -X POST "http://localhost:3000/api/backup"
curl -X POST "http://localhost:3000/api/restore"
```

**`POST /api/ai`** — ИИ-режим: RAG-ответ модели по результатам поиска

Требует настройку `AI_PROVIDER` (+ `AI_API_KEY` для облачных). Параметры: `query` (обязателен), `limit` (сколько результатов в контекст, по умолчанию 5), `category`, `tags`, `lang`. Ответ — текст модели плюс источники. Ошибки провайдера — `502`.

```bash
curl -X POST "http://localhost:3000/api/ai" \
  -H "Content-Type: application/json" \
  -d '{"query":"как работает поиск","limit":5}'
```

**`GET /api/openapi.json`** — OpenAPI 3.1-спека всех эндпоинтов

**`GET /api/docs`** — Swagger UI (интерактивная документация)

**`GET /api/providers`** — каталог провайдеров

Параметры: `group`, `query`

**`GET /api/bots`** — список подключённых ботов

**`POST /api/bots`** — привязать бота

```bash
curl -X POST "http://localhost:3000/api/bots" \
  -H "Content-Type: application/json" \
  -d '{"name":"мой-бот","platform":"discord","commands":["/search","/stats"]}'
```

**`DELETE /api/bots/:name`** — отключить бота

```bash
curl -X DELETE "http://localhost:3000/api/bots/мой-бот"
```

Типизированный клиент для всех эндпоинтов — `createClient` из `src/lib/client` (модели ответов — в `src/lib/client/types.ts`).

## ⚙️Переменные окружения (.env)

**Сервер:**

- `PORT` — порт сервера (3000)

- `HOST` — адрес прослушивания (0.0.0.0)

- `ORIGIN` — адрес приложения (http://localhost:3000)

- `CORS_ORIGIN` — разрешённые источники (*)

- `API_KEY` — ключ авторизации (пусто — доступ открыт). Если задан — все `/api/*` требуют `Authorization: Bearer <ключ>` или `X-API-Key: <ключ>`; открыты всегда: `/api/health`, `/api/openapi.json`, `/api/docs`

**Данные и приложение:**

- `SEARCH_DATA` — путь к файлу с корпусом результатов поиска (./data/search-content.json)

- `SEARCH_DB` — путь к файловой базе s-db (./data/s-db.json)

- `SEARCH_BACKUP` — бэкапы обучения в базу: `true` по умолчанию; `false` — данные не теряются, просто не пишутся в базу

- `SEARCH_LEARN` — режим обучения: `dataset` (только данные набора) или `queries` (данные + поисковые запросы; частые запросы всплывают в подсказках)

- `APP_NAME` — имя приложения («Поисковая система»)

- `BOT_NAME` — имя бота для авто-привязки (пусто)

Бэкапы хранятся в файловой базе s-db (`data/s-db.json`), снапшоты — в `data/backups/`. Подробная настройка — в [**`DATABASE.md`**](./DATABASE.md).

**ИИ-режим (реальные вызовы моделей):**

- `AI_PROVIDER` — провайдер: `openai`, `deepseek`, `groq`, `mistral`, `moonshot`, `minimax`, `x-ai`, `openrouter`, `together`, `fireworks`, `cerebras`, `ollama`, `lmstudio`, `anthropic`, `google` (пусто — ИИ-режим выключен)

- `AI_MODEL` — модель (по умолчанию своя у каждого провайдера, например `gpt-4o`, `claude-sonnet-4`, `gemini-2.5-flash`)

- `AI_API_KEY` — ключ провайдера (локальным `ollama` и `lmstudio` не нужен)

- `AI_BASE_URL` — кастомный base-url для OpenAI-совместимых провайдеров

**Поиск:**

- `SEARCH_LIMIT` — лимит результатов (20)

- `SEARCH_FUZZY` — нечёткий поиск (true)

- `SEARCH_LANG` — язык стемминга: `auto` / `ru` / `en`

- `SEARCH_TITLE_WEIGHT` — вес заголовка (5.0)

- `SEARCH_KEYWORDS_WEIGHT` — вес ключевых слов (2.5)

- `SEARCH_BODY_WEIGHT` — вес тела (1.0)

- `SEARCH_K1` — параметр k1 алгоритма BM25 (1.2)

- `SEARCH_B` — параметр b алгоритма BM25 (0.75)

**Отображение:**

- `SEARCH_SNIPPET_WIDTH` — ширина фрагмента (42)

- `SEARCH_MAX_FRAGMENTS` — максимум фрагментов (2)

- `SEARCH_MARK_TAG` — тег выделения совпадений (mark)

- `SEARCH_LEVENSHTEIN_LIMIT` — порог опечаток (2)

Каждая переменная меняется на лету — без правки кода.

## 🎯Примеры команд

**Поиск:**

```bash
curl "http://localhost:3000/api/search?query=docker"
curl "http://localhost:3000/api/search?query=+контейнер+-docker&limit=5"
curl "http://localhost:3000/api/search?query=@инфраструктура%20docker&fuzzy=true&lang=ru"
```

**Подсказки и контекст:**

```bash
curl "http://localhost:3000/api/suggest?query=пои"
curl "http://localhost:3000/api/context"
```

## 🛠️Скрипты запуска

**Установка:**

```bash
bun install
npm install
```

**Разработка:**

```bash
bun run dev
npm run dev:node
```

**Сборка и запуск:**

```bash
bun run build
npm start
bun run start:bun
```

**Проверка типов:**

```bash
bun run check
```