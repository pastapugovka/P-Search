# 🧭P-Search — полный список команд

Здесь собраны все команды и настройки: палитра «/», провайдеры «/P», контекст «@» и «#», REST API, переменные окружения и скрипты запуска.

## 🎨Палитра команд «/»

**Что делает:** символ `/` в строке поиска открывает палитру быстрых команд. Навигация — стрелки `↑` `↓`, выполнение — `Enter`, закрытие — `Esc`.

**Работа с поиском:**

- **`/help`** — справка по всем командам

- **`/clear`** — очищает запрос и результаты

- **`/history`** — история поисковых запросов

**Данные и обучение:**

- **`/export`** — экспорт набора данных в JSON

- **`/import`** — импорт набора данных из JSON

- **`/backup`** — сохранить бэкап обучения

- **`/restore`** — откатить обучение к последнему бэкапу

**Интерфейс:**

- **`/settings`** — настройки поиска и отображения

- **`/lang`** — язык интерфейса

- **`/theme`** — светлая, тёмная и авто-тема

- **`/bot`** — подключённые боты и их команды

**Как использовать:**

1. Начните печатать `/` — палитра откроется сама
2. Выберите команду стрелками и нажмите `Enter`
3. Команды ботов появляются в палитре **автоматически** после привязки — см. «🤖Боты»

## 🔌Провайдеры «/P» — выбор модели

**Что делает:** команда `/P` подключает внешние модели и источники данных — более 75 провайдеров: Claude, GPT, Gemini и другие. После подключения модель доступна в любом клиенте.

**Формат команды:**

```bash
/P <провайдер> --источник <ключ или путь> --модель <модель> [--режим]
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

Каталог доступен и через API: `GET /api/providers?group=AI-модели&query=claude`

Полный список поддерживаемых моделей — в [**`MODELS.txt`**](./MODELS.txt).

## 🧭Контекст «@» и «#» — операторы запроса

**Что делает:** символы сужают поиск до категории и тегов. Подсказки выпадают сразу после ввода, выбранные значения становятся чипами.

**Операторы:**

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

Все запросы — на `http://localhost:3000/api/…`:

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

## ⚙️Переменные окружения (.env)

**Сервер:**

- `PORT` — порт сервера (3000)
- `HOST` — адрес прослушивания (0.0.0.0)
- `ORIGIN` — адрес приложения (http://localhost:3000)
- `CORS_ORIGIN` — разрешённые источники (*)

**Данные и приложение:**

- `SEARCH_DATA` — путь к файлу с корпусом результатов поиска (./data/search-content.json)
- `DATABASE_URL` — строка подключения к базе бэкапов (PostgreSQL через Prisma)
- `SEARCH_LEARN` — режим обучения: `dataset` (только данные набора) или `queries` (данные + поисковые запросы)
- `SEARCH_BACKUP` — бэкапы обучения в базе данных: `true` по умолчанию; `false` — данные не теряются, просто не пишутся в базу
- `APP_NAME` — имя приложения («Поисковая система»)
- `BOT_NAME` — имя бота для авто-привязки (пусто)

Бэкапы хранятся в локальной базе `DATABASE_URL` или в облачной: VK Cloud, Яндекс Облако, Cloud.ru, Google Cloud, AWS, MongoDB Atlas, Neon, Supabase, Redis, Turso Cloud, Upstash, MotherDuck, Convex.

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