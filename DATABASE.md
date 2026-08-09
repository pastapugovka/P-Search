# 🗄️База данных — полная пошаговая настройка

Подробные инструкции: локальные Redis и PostgreSQL, облачная база на примере AWS. После каждого варианта в `.env` указывается строка подключения и сервис перезапускается.

## Локальная база: Redis

**Шаг 1. Установите Redis:**

```bash
docker run -d --name p-search-redis -p 6379:6379 redis:7-alpine
```

Или через пакетный менеджер: `apt install redis-server`, `brew install redis`.

**Шаг 2. Запустите и проверьте:**

```bash
redis-cli ping
```

Ответ `PONG` — Redis работает.

**Шаг 3. Подключите поиск** — в `.env`:

```env
DATABASE_URL=redis://localhost:6379
```

**Шаг 4. Перезапустите сервис и проверьте бэкапы** (`/backup`, `GET /api/health`).

## Локальная база: PostgreSQL

**Шаг 1. Установите PostgreSQL 16** (инсталлятор с postgresql.org, `apt install postgresql`, `brew install postgresql@16` или Docker).

**Шаг 2. Запустите сервер** и убедитесь, что он слушает порт 5432.

**Шаг 3. Создайте пользователя и базу:**

```bash
psql -U postgres
```

```sql
CREATE USER psearch WITH PASSWORD 'psearch';
CREATE DATABASE psearch OWNER psearch;
```

**Шаг 4. Проверьте подключение:**

```bash
psql -U psearch -h localhost -d psearch
```

**Шаг 5. Укажите строку подключения в `.env`:**

```env
DATABASE_URL=postgres://psearch:psearch@localhost:5432/psearch
```

**Шаг 6. Перезапустите сервис и проверьте бэкапы** (`/backup`, `/restore`).

## PostgreSQL — единственная база без Redis

PostgreSQL полностью покрывает хранение бэкапов, отдельный Redis не нужен.

**Шаг 1. Установите PostgreSQL** тем же способом или из Docker:

```bash
docker run -d --name p-search-pg \
  -e POSTGRES_USER=psearch \
  -e POSTGRES_PASSWORD=psearch \
  -e POSTGRES_DB=psearch \
  -p 5432:5432 \
  postgres:16-alpine
```

**Шаг 2. Проверьте доступ** (`psql -U psearch -h localhost -d psearch`).

**Шаг 3. Впишите `DATABASE_URL` в `.env`** как в шаге 5 выше.

**Шаг 4. Перезапустите поиск** — бэкапы сохраняются в PostgreSQL, сброс и откат работают штатно.

## Облачная база: AWS — полная инструкция

**Шаг 1. Создайте аккаунт AWS** на aws.amazon.com (нужна карта, бесплатный уровень доступен год).

**Шаг 2. Откройте сервис Amazon RDS** и нажмите Create database.

**Шаг 3. Выберите стандартное создание:** движок PostgreSQL (или Amazon Aurora PostgreSQL), шаблон Free tier, экземпляр `db.t3.micro`, хранилище 20 ГБ gp2.

**Шаг 4. Задайте мастер-имя пользователя и пароль** — сохраните их в `.env`, никогда в код и в коммиты.

**Шаг 5. Настройте сеть:** разрешите публичный доступ (Public access) и создайте security group с входным правилом TCP 5432 **только с IP вашего сервера**. Открывать `0.0.0.0/0` не рекомендуется.

**Шаг 6. Нажмите Create database** и дождитесь статуса **Available** (обычно 5–10 минут).

**Шаг 7. Скопируйте endpoint** базы — строка вида `dbname.xxxxxxx.us-east-1.rds.amazonaws.com:5432`.

**Шаг 8. Соберите строку подключения и впишите в `.env`:**

```env
DATABASE_URL=postgres://masteruser:ВашПароль@dbname.xxxxxxx.us-east-1.rds.amazonaws.com:5432/postgres
```

**Шаг 9. Убедитесь, что security group пропускает порт 5432 с IP клиента.**

**Шаг 10. Проверьте подключение** (`psql` или любой клиент), перезапустите поиск и проверьте бэкапы: `POST /api/backup`, затем `POST /api/restore`.

**Шаг 11. Защита:** пароль и endpoint — только в `.env` или переменных окружения; доступ ограничен security group, а не открытым портом; IAM-политики — минимальные.

## Redis в облаке: AWS ElastiCache (кратко)

1. ElastiCache → Create cache cluster → Redis, `cache.t3.micro`
2. Скопируйте endpoint (`xxxxx.cache.amazonaws.com:6379`) и впишите в `.env`:

```env
DATABASE_URL=redis://xxxxx.cache.amazonaws.com:6379
```

3. Откройте порт 6379 только с IP вашего сервера; ключи — только в `.env`.