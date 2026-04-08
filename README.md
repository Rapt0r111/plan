# TaskFlow — Интранет-система управления задачами

> **Версия:** 2.0 · **Стек:** Bun + Next.js 16 + SQLite + Docker  
> **Платформа:** Локальная сеть / интранет · **Порт:** 38701 (HTTP), 8443 (HTTPS)

---

## Содержание

1. [О проекте](#1-о-проекте)
2. [Архитектура](#2-архитектура)
3. [Быстрый старт — разработка](#3-быстрый-старт--разработка)
4. [Деплой в Docker — Linux](#4-деплой-в-docker--linux)
5. [Деплой в Docker — Windows](#5-деплой-в-docker--windows)
6. [HTTPS через Caddy](#6-https-через-caddy)
7. [Установка TLS на клиентах](#7-установка-tls-на-клиентах)
8. [Обновление после деплоя](#8-обновление-после-деплоя)
9. [Управление базой данных](#9-управление-базой-данных)
10. [Переменные окружения](#10-переменные-окружения)
11. [Структура проекта](#11-структура-проекта)
12. [Горячие клавиши](#12-горячие-клавиши)
13. [Устранение неполадок](#13-устранение-неполадок)
14. [Проверка Docker-конфигурации](#14-проверка-docker-конфигурации)

---

## 1. О проекте

TaskFlow — офлайн-first система управления задачами для внутреннего использования. Работает в локальной сети без доступа в интернет.

### Ключевые возможности

| Функция | Описание |
|---|---|
| **Канбан-доска** | Drag-and-drop, Vim-навигация (J/K/E), фильтры по ролям/статусу/приоритету |
| **Эпики** | Группировка задач, Timeline (Gantt), прогресс-кольца |
| **Подзадачи** | Чекбоксы, прогресс-бар, добавление/удаление inline |
| **Zen Mode** | Фокус на одной задаче, растворение частицами при завершении |
| **Offline-first** | IndexedDB-очередь, автосинхронизация при восстановлении сети |
| **Real-time** | SSE-пуш обновлений от других пользователей без перезагрузки |
| **PWA** | Устанавливается как приложение на любое устройство |
| **Темы** | Тёмная / светлая + кастомный акцентный цвет + 20+ параметров UI |
| **Command Palette** | `Cmd+K` / `Ctrl+K` — быстрая навигация и поиск задач |
| **Timeline** | Хронолента с Gantt-визуализацией эпиков |

### Состав по умолчанию

Роли настраиваются в `Настройки → Роли`. По умолчанию загружаются из `состав.txt`:

| Аббр. | Роль | ФИО |
|---|---|---|
| КНР | Командир научной роты | Тарасенко С.Е. |
| КВ-1 | Командир первого взвода | Халупа А.И. |
| КВ-2 | Командир второго взвода | Трепалин П.В. |
| ЗКВ-1 | Заместитель командира взвода-1 | Антипов Е.В. |
| ЗКВ-2 | Заместитель командира взвода-2 | Ермаков В.А. |
| СР | Старшина роты | Долгополов А.А. |
| КО-2 | Командир второго отделения | Арсенов А.В. |

---

## 2. Архитектура

```
┌─────────────────────────────────────────────────────────┐
│                 Браузер / PWA-приложение                │
│          React 19 + Framer Motion + Zustand             │
└────────────────────────┬────────────────────────────────┘
                         │ HTTPS / SSE / WebSocket
┌────────────────────────▼────────────────────────────────┐
│            Caddy 2 (reverse proxy, TLS internal)        │
│            taskflow.local:8443 → taskflow:3000          │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP (Docker network)
┌────────────────────────▼────────────────────────────────┐
│         Next.js 16 App Router (Bun 1.3 runtime)         │
│   Server Components + Route Handlers + Server Actions   │
│   SSE /api/realtime · Health /api/health · порт 3000   │
└────────────────────────┬────────────────────────────────┘
                         │ Drizzle ORM (bun:sqlite)
┌────────────────────────▼────────────────────────────────┐
│       SQLite (WAL mode, busy_timeout=5s, 64MB cache)    │
│       Docker Volume: taskflow_data → /app/data/         │
└─────────────────────────────────────────────────────────┘
```

### Docker-контейнеры

| Сервис | Образ | Порт (хост) | Порт (контейнер) | Назначение |
|---|---|---|---|---|
| `taskflow_app` | `taskflow:latest` | — (внутренний) | 3000 | Next.js приложение |
| `taskflow_caddy` | `caddy:2` | **8443** | 443 | HTTPS прокси |
| — | — | **38701** | 3000 | HTTP прямой доступ |

### Этапы Docker-сборки (multi-stage)

```dockerfile
Stage 1: deps     → bun install --frozen-lockfile
Stage 2: builder  → bun run db:migrate + bun run build
Stage 3: runner   → production (non-root user taskflow:1001, tini PID1)
```

---

## 3. Быстрый старт — разработка

### Требования

- **Bun** ≥ 1.3.11 — установить с https://bun.sh
- Git
- Node.js **не требуется** (Bun его заменяет)

### Установка Bun

```bash
# Linux / macOS
curl -fsSL https://bun.sh/install | bash

# Windows (PowerShell)
powershell -c "irm bun.sh/install.ps1 | iex"
```

### Запуск проекта

```bash
# 1. Установить зависимости
bun install

# 2. Создать и применить миграции БД
bun run db:generate
bun run db:migrate

# 3. Заполнить тестовыми данными (5 эпиков, 26 задач, 55+ подзадач)
bun run db:seed

# 4. Запустить dev-сервер с Turbopack
bun run dev
```

**Приложение:** http://localhost:3000  
**Авторедирект:** http://localhost:3000 → /dashboard

### Команды разработки

```bash
bun run dev           # Dev-сервер (Turbopack, HMR)
bun run build         # Production-сборка
bun run start         # Запустить production-сборку
bun run typecheck     # Проверка TypeScript
bun run lint          # ESLint
bun run test:unit     # Unit-тесты (Vitest)
bun run test:e2e      # E2E-тесты (Playwright)
bun run db:generate   # Генерация миграций по схеме
bun run db:migrate    # Применить миграции
bun run db:seed       # Заполнить тестовыми данными
bun run db:studio     # Открыть Drizzle Studio (визуальная БД)
bun run db:reset      # Полный сброс БД (удалить + мигрировать + seed)
```

---

## 4. Деплой в Docker — Linux

### Требования

- Docker Engine ≥ 25.0
- Docker Compose Plugin ≥ 2.27 (входит в Docker Engine)
- ОС: Ubuntu 22.04+ / Debian 12+ / RHEL 9+
- RAM: ≥ 512 МБ свободной
- Диск: ≥ 2 ГБ свободного места

### Установка Docker на Ubuntu/Debian

```bash
# Удалить старые версии
sudo apt-get remove docker docker-engine docker.io containerd runc

# Установить Docker
curl -fsSL https://get.docker.com | sudo sh

# Добавить пользователя в группу docker
sudo usermod -aG docker $USER

# Применить без перезагрузки
newgrp docker

# Проверить
docker --version          # Docker version 25.x.x
docker compose version    # Docker Compose version v2.x.x
```

### Первый деплой (рекомендуется через deploy.sh)

```bash
# Перейти в директорию проекта
cd ~/taskflow

# Создать .env файл
cp env.example .env

# Запустить деплой (сборка + запуск + health check)
chmod +x deploy.sh
./deploy.sh deploy
```

Вывод после успешного деплоя:
```
╔══════════════════════════════════════════╗
║        TaskFlow Deploy Helper            ║
╚══════════════════════════════════════════╝
[INFO]  Full deployment: build → up
[INFO]  Building Docker image...
[OK]    Image built: taskflow:latest
[INFO]  Starting TaskFlow...
[INFO]  Waiting for health check (up to 90 seconds)...
.......
[OK]    TaskFlow is running!
  → Open: http://192.168.99.101:38701
  → Health: http://192.168.99.101:38701/api/health
```

### Ручной деплой (без deploy.sh)

```bash
# Сборка образа
docker compose build --no-cache

# Запуск в фоне
docker compose up -d

# Проверка статуса
docker compose ps

# Просмотр логов запуска
docker compose logs -f taskflow
```

### Команды deploy.sh

```bash
./deploy.sh help        # Справка по всем командам
./deploy.sh deploy      # Первый деплой (build + up)
./deploy.sh update      # Обновление (rebuild + restart, данные сохраняются)
./deploy.sh build       # Только сборка образа
./deploy.sh up          # Запустить (образ должен быть собран)
./deploy.sh down        # Остановить
./deploy.sh restart     # Перезапустить
./deploy.sh status      # Статус, ресурсы, URL
./deploy.sh logs        # Логи в реальном времени
./deploy.sh shell       # Открыть shell внутри контейнера
./deploy.sh db-backup   # Резервная копия БД
./deploy.sh db-seed     # Запустить seed
./deploy.sh reset-db    # ⚠️ Удалить все данные и пересоздать
./deploy.sh cleanup     # Удалить контейнер и образ (данные сохраняются)
```

### Автозапуск при перезагрузке сервера

Docker Compose использует `restart: unless-stopped` — контейнеры запускаются автоматически после перезагрузки ОС, если Docker daemon настроен на autostart:

```bash
# Включить autostart Docker daemon
sudo systemctl enable docker

# Проверить
sudo systemctl status docker
```

### Открыть порт в файрволе (если нужно)

```bash
# UFW (Ubuntu)
sudo ufw allow 38701/tcp comment "TaskFlow HTTP"
sudo ufw allow 8443/tcp comment "TaskFlow HTTPS"

# firewalld (RHEL/CentOS)
sudo firewall-cmd --permanent --add-port=38701/tcp
sudo firewall-cmd --permanent --add-port=8443/tcp
sudo firewall-cmd --reload
```

---

## 5. Деплой в Docker — Windows

### Вариант А: Docker Desktop (рекомендуется для тестирования)

**Требования:**
- Windows 10/11 Pro / Enterprise / Education (версия 21H2+)
- WSL2 (Windows Subsystem for Linux 2)
- Virtualization enabled in BIOS

**Установка:**
1. Скачать Docker Desktop: https://www.docker.com/products/docker-desktop/
2. Установить с включённым WSL2 backend
3. Перезагрузить компьютер

```powershell
# Проверить установку
docker --version
docker compose version
```

**Деплой:**
```powershell
# Перейти в директорию проекта
cd C:\taskflow

# Создать .env
Copy-Item env.example .env

# Первый деплой
docker compose build --no-cache
docker compose up -d

# Проверка
docker compose ps
```

**Приложение:** http://localhost:38701

### Вариант Б: Rootless Podman (для Windows Server)

```powershell
# Установить Podman
winget install RedHat.Podman

# Запустить машину Podman (WSL2)
podman machine init
podman machine start

# Деплой
podman compose up -d
```

### Важные особенности Windows

**1. Проблема CRLF (переносы строк)**

Файл `docker-entrypoint.sh` должен использовать Unix-окончания строк (LF, не CRLF). Если клонировали через git на Windows:

```powershell
# Исправить перед сборкой
$content = Get-Content -Path "docker-entrypoint.sh" -Raw
$content = $content -replace "`r`n", "`n"
[System.IO.File]::WriteAllText("docker-entrypoint.sh", $content)

# Или настроить git глобально
git config --global core.autocrlf false
```

**2. Постоянное хранилище данных**

SQLite-база в Docker-томе `taskflow_data` на Windows расположена по пути:
```
\\wsl$\docker-desktop-data\data\docker\volumes\taskflow_data\_data\
```

**3. Firewall — открыть порты**

```powershell
# Открыть порты (от Администратора)
New-NetFirewallRule -DisplayName "TaskFlow HTTP" `
  -Direction Inbound -Protocol TCP -LocalPort 38701 -Action Allow

New-NetFirewallRule -DisplayName "TaskFlow HTTPS" `
  -Direction Inbound -Protocol TCP -LocalPort 8443 -Action Allow
```

**4. Управление через PowerShell**

```powershell
# Запустить
docker compose up -d

# Статус
docker compose ps

# Логи
docker compose logs -f

# Остановить
docker compose down

# Обновить (без потери данных)
docker compose build --no-cache
docker compose up -d --force-recreate
```

---

## 6. HTTPS через Caddy

Caddy автоматически создаёт локальный центр сертификации (CA) и выпускает TLS-сертификаты для работы через HTTPS в локальной сети без доступа к интернет.

### Настройка

**Шаг 1.** Добавить запись в hosts-файл на **сервере**:

```bash
# Linux
echo "192.168.99.101 taskflow.local" | sudo tee -a /etc/hosts

# Windows (PowerShell от Администратора)
Add-Content "$env:WINDIR\System32\drivers\etc\hosts" "192.168.99.101`ttaskflow.local"
```

**Шаг 2.** Caddy запускается автоматически как часть `docker compose up -d`.

**Шаг 3.** Проверить работу Caddy:

```bash
docker compose ps caddy           # Статус контейнера
docker compose logs caddy         # Логи (включая выдачу сертификата)
```

**Шаг 4.** Подождать 5–15 секунд после первого запуска — Caddy инициализирует CA и выпустит сертификат.

### Доступ к приложению

| Протокол | URL | Примечание |
|---|---|---|
| HTTP | `http://192.168.99.101:38701` | Прямой доступ (без HTTPS) |
| HTTPS | `https://taskflow.local:8443` | Через Caddy (требует установки CA) |

### Конфигурация Caddyfile

```caddy
taskflow.local {
  tls internal

  # Раздача root CA для установки на клиентах
  handle /caddy-root.crt {
    root * /data/caddy/pki/authorities/local
    rewrite * /root.crt
    file_server
  }

  reverse_proxy taskflow:3000
}
```

### Изменить домен

Если нужен другой домен (например `plan.mil.local`):

1. Отредактировать `Caddyfile`:
   ```
   plan.mil.local {
     tls internal
     reverse_proxy taskflow:3000
   }
   ```
2. Перезапустить Caddy:
   ```bash
   docker compose restart caddy
   ```
3. Обновить hosts-файлы на всех клиентах.

---

## 7. Установка TLS на клиентах

Для работы HTTPS без предупреждений браузера нужно установить корневой сертификат Caddy (root CA) на **каждом клиентском устройстве**.

### Windows — автоматически (PowerShell от Администратора)

Скопировать файл `scripts/install-taskflow-client.ps1` на клиентский компьютер, затем:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\install-taskflow-client.ps1

# Если нестандартные IP/домен:
.\install-taskflow-client.ps1 -HostName "taskflow.local" -ServerIP "192.168.99.101" -RootCrtUrl "https://taskflow.local:8443/caddy-root.crt"
```

Скрипт выполнит:
1. Добавит `192.168.99.101 taskflow.local` в `C:\Windows\System32\drivers\etc\hosts`
2. Скачает `root.crt` с сервера (игнорируя TLS на этом этапе)
3. Установит сертификат в хранилище `Trusted Root Certification Authorities`

После — **перезапустить браузер**.

### Linux — автоматически

Скопировать `scripts/install-taskflow-client-linux.sh` на клиент:

```bash
sudo bash install-taskflow-client-linux.sh

# С параметрами:
sudo bash install-taskflow-client-linux.sh taskflow.local 192.168.99.101
```

### Ручная установка (любая ОС)

1. Открыть в браузере (принять риск): `https://taskflow.local:8443/caddy-root.crt`
2. Скачать файл `root.crt`

**Windows:** Двойной клик → «Установить сертификат» → «Локальный компьютер» → «Доверенные корневые ЦС»

**macOS:** Двойной клик → добавить в Keychain → открыть Keychain Access → найти сертификат → «Доверять всегда»

**Linux (Ubuntu/Debian):**
```bash
sudo cp root.crt /usr/local/share/ca-certificates/taskflow.crt
sudo update-ca-certificates
```

### Установка PWA

После настройки HTTPS приложение можно установить как нативное:

| Платформа | Способ |
|---|---|
| Chrome / Edge Desktop | Иконка установки в адресной строке |
| Android (Chrome) | Меню ⋮ → «Добавить на главный экран» |
| iOS (Safari) | Кнопка «Поделиться» → «На экран Домой» |

---

## 8. Обновление после деплоя

### Стандартное обновление (рекомендуется)

```bash
# На сервере
cd ~/taskflow

# Получить новый код (если используется git)
git pull origin main

# Пересобрать и перезапустить (данные сохраняются!)
./deploy.sh update
```

`./deploy.sh update` внутри выполняет:
```bash
docker compose build --no-cache
docker compose up -d --force-recreate
```

Данные **НЕ теряются** — SQLite хранится в Docker-томе `taskflow_data`, который не затрагивается при пересборке.

### Обновление без скрипта (ручное)

```bash
# Получить новый код
git pull origin main

# Пересобрать образ
docker compose build --no-cache

# Перезапустить с новым образом
docker compose up -d --force-recreate

# Проверить статус
docker compose ps
curl http://localhost:38701/api/health
```

### Миграции базы данных

Миграции применяются **автоматически** при каждом старте контейнера через `docker-entrypoint.sh`. Ничего делать дополнительно не нужно.

Если нужно применить миграцию вручную (например, для отладки):
```bash
docker exec taskflow_app bun run db:migrate
```

### Проверка успешного обновления

```bash
# 1. Статус контейнеров
docker compose ps
# Все контейнеры должны быть в состоянии "running"

# 2. Health check
curl http://localhost:38701/api/health
# Ответ: {"ok":true,"db":{"ok":true,"latencyMs":0},...}

# 3. Логи приложения (последние 50 строк)
docker compose logs --tail=50 taskflow
```

### Откат к предыдущей версии

```bash
# 1. Остановить
docker compose down

# 2. Откатить код
git log --oneline     # Найти нужный коммит
git checkout abc1234  # Откатить к нужному коммиту

# 3. Пересобрать и запустить
docker compose build --no-cache
docker compose up -d
```

---

## 9. Управление базой данных

### Где хранятся данные

| Путь | Описание |
|---|---|
| `/app/data/taskflow.db` | SQLite внутри контейнера (Docker volume) |
| `/app/local.db` | Symlink на `/app/data/taskflow.db` |
| Docker volume `taskflow_data` | Постоянное хранилище на хосте |

На хосте Linux: `/var/lib/docker/volumes/taskflow_data/_data/`  
На хосте Windows: `\\wsl$\docker-desktop-data\data\docker\volumes\taskflow_data\_data\`

### Резервное копирование

```bash
# Через deploy.sh (рекомендуется)
./deploy.sh db-backup
# Создаёт: taskflow_backup_20240115_030000.db

# Вручную
docker exec taskflow_app \
  sh -c "sqlite3 /app/data/taskflow.db '.backup /tmp/backup.db'"
docker cp taskflow_app:/tmp/backup.db \
  ./taskflow_backup_$(date +%Y%m%d_%H%M%S).db
```

### Автоматическое резервное копирование (Linux, cron)

```bash
crontab -e
```

Добавить строки:
```cron
# Резервная копия каждый день в 03:00
0 3 * * * /home/user/taskflow/deploy.sh db-backup >> /var/log/taskflow-backup.log 2>&1

# Удалять резервные копии старше 30 дней
0 4 * * * find /home/user/taskflow -name "taskflow_backup_*.db" -mtime +30 -delete
```

### Восстановление из резервной копии

```bash
# 1. Остановить приложение
docker compose stop taskflow

# 2. Скопировать резервную копию в контейнер
docker cp ./taskflow_backup_20240115_030000.db taskflow_app:/tmp/restore.db

# 3. Заменить текущую БД
docker exec taskflow_app \
  sh -c "cp /tmp/restore.db /app/data/taskflow.db"

# 4. Запустить приложение
docker compose start taskflow
```

### Seed — заполнение тестовыми данными

Seed содержит: 5 эпиков, 26 задач, 55+ подзадач, 9 пользователей, 8 ролей.

```bash
# Запустить seed (только если БД пустая или после reset)
./deploy.sh db-seed

# Полный сброс с подтверждением (⚠️ все данные удаляются!)
./deploy.sh reset-db
```

### Импорт годового плана из PDF

```bash
# Установить зависимость (только один раз)
pip install pdfplumber

# Предпросмотр без записи
python pdf_to_sqlite.py \
  --pdf ./Годовой_план.pdf \
  --db ./local.db \
  --dry-run

# Импортировать
python pdf_to_sqlite.py \
  --pdf ./Годовой_план.pdf \
  --db ./local.db

# Очистить БД и импортировать заново
python pdf_to_sqlite.py \
  --pdf ./Годовой_план.pdf \
  --db ./local.db \
  --clear
```

### Прямой доступ к SQLite (для отладки)

```bash
# Открыть SQLite CLI внутри контейнера
docker exec -it taskflow_app sh
sqlite3 /app/data/taskflow.db

# Полезные команды SQLite:
.tables              # Список таблиц
.schema tasks        # Схема таблицы tasks
SELECT COUNT(*) FROM tasks;
SELECT COUNT(*) FROM epics;
.quit
```

---

## 10. Переменные окружения

Создать `.env` файл из шаблона:
```bash
cp env.example .env
```

### Все переменные

| Переменная | По умолчанию | Описание |
|---|---|---|
| `NODE_ENV` | `production` | Режим запуска |
| `PORT` | `3000` | Порт приложения внутри контейнера |
| `DATABASE_URL` | `/app/data/taskflow.db` | Путь к SQLite (менять только если нужен другой путь) |
| `SEED_ON_FIRST_RUN` | `true` | Автосид при первом запуске если БД пустая |

### Пример `.env`

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=/app/data/taskflow.db
SEED_ON_FIRST_RUN=true
```

### Изменить порт хоста

В `docker-compose.yml` строка `ports`:
```yaml
ports:
  - "38701:3000"   # ← левая часть (38701) — порт на хосте
```

Изменить `38701` на любой свободный порт:
```yaml
  - "8080:3000"    # Пример: порт 8080
```

После изменения — пересобрать: `docker compose up -d --force-recreate`

---

## 11. Структура проекта

Проект организован по методологии **Feature-Sliced Design (FSD)**:

```
taskflow/
├── app/                    # Next.js App Router
│   ├── (main)/             # Основной layout с Sidebar
│   │   ├── board/          # Канбан-доска (/board)
│   │   ├── dashboard/      # Дашборд (/dashboard)
│   │   ├── epics/[id]/     # Детальная страница эпика
│   │   ├── settings/       # Настройки (роли, пользователи, эпики)
│   │   └── tasks/[id]/     # Редирект на эпик + slideover
│   ├── api/                # Route Handlers (REST API)
│   │   ├── epics/          # CRUD эпиков
│   │   ├── tasks/          # CRUD задач + assignees + subtasks
│   │   ├── users/          # CRUD пользователей
│   │   ├── roles/          # CRUD ролей
│   │   ├── subtasks/       # Управление подзадачами
│   │   ├── realtime/       # SSE endpoint
│   │   └── health/         # Health check
│   ├── globals.css         # CSS переменные + Tailwind
│   ├── layout.tsx          # Корневой layout (ThemeProvider, PWA)
│   └── manifest.json       # PWA manifest
│
├── entities/               # Бизнес-сущности (FSD)
│   ├── epic/               # epicRepository.ts, epicActions.ts
│   ├── role/               # roleRepository.ts
│   ├── task/               # taskRepository.ts, TaskCard.tsx
│   └── user/               # userRepository.ts
│
├── features/               # Фичи (FSD)
│   ├── board/              # DnD, keyboard nav
│   ├── command-palette/    # Cmd+K палитра
│   ├── create/             # FAB, CreateTaskModal, CreateEpicModal
│   ├── filters/            # SmartFilters
│   ├── sync/               # DynamicIsland, SyncNotificationBridge
│   ├── task-details/       # TaskSlideover, SubtaskList
│   ├── timeline/           # InfiniteTimeline (Gantt)
│   ├── workload/           # WorkloadBalancer
│   └── zen-mode/           # ZenMode
│
├── shared/                 # Переиспользуемое (FSD)
│   ├── config/             # task-meta.ts (статусы/приоритеты)
│   ├── db/                 # schema.ts, client.ts, migrate.ts, seed.ts
│   ├── lib/                # utils, hooks, localCache (IndexedDB)
│   ├── server/             # eventBus.ts (SSE)
│   ├── store/              # Zustand stores (task, role, prefs, theme)
│   ├── types/              # TypeScript типы
│   └── ui/                 # GlassPanel, MagneticCheckbox, etc.
│
├── widgets/                # Виджеты (FSD)
│   ├── board/              # EpicColumn, QuickAddTask, BoardTaskCard
│   ├── epic-card/          # EpicCard, EpicsGrid
│   ├── header/             # Header
│   ├── sidebar/            # Sidebar
│   └── task-list/          # DarkTaskCard
│
├── scripts/                # Скрипты установки TLS на клиентах
│   ├── install-taskflow-client.ps1          # Windows
│   └── install-taskflow-client-linux.sh     # Linux
│
├── drizzle/                # SQL-миграции (автогенерируются)
├── tests/
│   ├── e2e/                # Playwright тесты
│   └── unit/               # Vitest тесты
│
├── Dockerfile              # Multi-stage сборка (deps → builder → runner)
├── docker-compose.yml      # Оркестрация (taskflow + caddy)
├── Caddyfile               # Конфигурация Caddy (HTTPS)
├── docker-entrypoint.sh    # Entrypoint (migrate + seed + start)
├── deploy.sh               # Скрипт деплоя
├── drizzle.config.ts       # Конфигурация Drizzle
├── next.config.ts          # Конфигурация Next.js (PWA)
├── package.json
├── tsconfig.json
└── pdf_to_sqlite.py        # Импорт плана из PDF
```

### База данных — схема

```
roles         (id, key, label, short, hex, description, sort_order)
    │
users         (id, name, login, role_id FK→roles, initials)
    │
epics         (id, title, description, color, start_date, end_date)
    │
tasks         (id, epic_id FK→epics, title, description, status,
              priority, due_date, sort_order)
    │
subtasks      (id, task_id FK→tasks, title, is_completed, sort_order)
    │
task_assignees (id, task_id FK→tasks, user_id FK→users)
              UNIQUE(task_id, user_id)
```

---

## 12. Горячие клавиши

### Глобальные

| Клавиша | Действие |
|---|---|
| `Cmd+K` / `Ctrl+K` | Открыть Command Palette |
| `Esc` | Закрыть открытый элемент |

### На доске (/board)

| Клавиша | Действие |
|---|---|
| `J` или `↓` | Следующая задача |
| `K` или `↑` | Предыдущая задача |
| `Enter` | Открыть выбранную задачу |
| `E` | Сменить статус выбранной задачи |
| `Esc` | Сбросить выбор |

### В Zen Mode

| Клавиша | Действие |
|---|---|
| `Пробел` | Пропустить задачу |
| `Esc` | Выйти из Zen Mode |

### Command Palette

| Команда | Действие |
|---|---|
| `обзор` / `dashboard` | Перейти на дашборд |
| `доска` / `board` | Перейти на канбан |
| `zen` | Запустить Zen Mode (все задачи) |
| `zen критично` | Zen Mode (только критические) |
| Название задачи | Найти и открыть задачу |
| `обновить` / `sync` | Принудительная синхронизация |

---

## 13. Устранение неполадок

### Контейнер не запускается

```bash
# Посмотреть логи
docker compose logs taskflow

# Частые причины:
# 1. Порт 38701 занят
sudo lsof -i :38701  # Linux
netstat -ano | findstr :38701  # Windows

# 2. БД заблокирована (несколько экземпляров)
docker compose down
docker compose up -d

# 3. Ошибка миграции
docker exec taskflow_app bun run db:migrate
```

### Сайт не открывается в браузере

```bash
# Проверить что контейнер работает
docker compose ps

# Проверить health
curl http://localhost:38701/api/health

# Проверить доступность порта
curl -I http://192.168.99.101:38701
```

### HTTPS не работает (ERR_CERT_AUTHORITY_INVALID)

```
Причина: корневой сертификат Caddy не установлен на клиентском устройстве.
Решение: выполнить установку сертификата согласно разделу 7.
```

```bash
# Проверить что Caddy выдал сертификат
docker compose logs caddy | grep -i "certificate\|tls\|error"

# Перезапустить Caddy
docker compose restart caddy
```

### Изменения не отображаются у других пользователей

```bash
# Проверить SSE-соединение
curl -N http://localhost:38701/api/realtime

# Проверить количество подключённых клиентов
curl http://localhost:38701/api/health
# В ответе: "realtime":{"clients":N}
```

### Потеря данных при обновлении

Данные **не должны теряться** при правильном обновлении. Если это произошло:

```bash
# Проверить что volume существует
docker volume ls | grep taskflow_data

# Проверить что данные на месте
docker run --rm -v taskflow_data:/data alpine ls -la /data
```

Если volume случайно удалили (`docker compose down -v` или `docker volume rm`):
- Восстановить из резервной копии (раздел 9)
- В будущем: регулярное резервное копирование (cron)

### Высокое потребление памяти

По умолчанию лимиты в `docker-compose.yml`:
```yaml
deploy:
  resources:
    limits:
      cpus: "2.0"
      memory: 1G
    reservations:
      cpus: "0.25"
      memory: 256M
```

Уменьшить при необходимости:
```yaml
limits:
  memory: 512M
```

### Логи заполняют диск

Настройка ротации логов в `docker-compose.yml`:
```yaml
logging:
  driver: "json-file"
  options:
    max-size: "50m"   # Максимальный размер файла логов
    max-file: "5"     # Количество файлов ротации
```

### Медленная работа SQLite

SQLite настроен с оптимизациями:
- WAL mode (Write-Ahead Logging)
- `busy_timeout = 5000ms`
- `cache_size = 64MB`
- `mmap_size = 256MB`

Если всё равно медленно:
```bash
# Проверить задержку БД
curl http://localhost:38701/api/health
# В ответе: "db":{"ok":true,"latencyMs":N}
# Норма: < 5ms
```

---

## 14. Проверка Docker-конфигурации

### Результаты валидации

**Dockerfile** — все проверки пройдены:

| Проверка | Статус | Подробности |
|---|---|---|
| Базовый образ без `:latest` | ✅ | `oven/bun:1.3.11-alpine` — версия зафиксирована |
| Multi-stage сборка | ✅ | 3 стадии: deps → builder → runner |
| Не-root пользователь | ✅ | `taskflow` (UID 1001) |
| WORKDIR абсолютный | ✅ | `/app` |
| HEALTHCHECK настроен | ✅ | `wget -qO- http://localhost:3000/api/health` |
| Tini (PID 1) | ✅ | `/sbin/tini --` как ENTRYPOINT |
| Секреты не в образе | ✅ | `.env` файлы удаляются при сборке |
| COPY вместо ADD | ✅ | ADD нигде не используется |
| Labels добавлены | ✅ | `maintainer`, `version`, `description` |

**docker-compose.yml** — все проверки пройдены:

| Проверка | Статус | Подробности |
|---|---|---|
| Нет устаревшего поля `version:` | ✅ | Современный синтаксис Compose v2.27+ |
| Restart policy | ✅ | `restart: unless-stopped` |
| Health check | ✅ | `interval: 30s, timeout: 10s, retries: 3` |
| Named volumes | ✅ | `taskflow_data`, `caddy_data`, `caddy_config` |
| Кастомная сеть | ✅ | `taskflow_net` (bridge driver) |
| Resource limits | ✅ | CPU: 2.0, Memory: 1GB |
| Log rotation | ✅ | `max-size: 50m, max-file: 5` |
| Нет хардкоженных секретов | ✅ | Все через переменные окружения |

### Быстрая валидация конфигурации

```bash
# Проверить синтаксис docker-compose.yml
docker compose config --quiet && echo "✅ Compose OK"

# Проверить что образ собирается без ошибок
docker compose build 2>&1 | tail -5

# Запустить и проверить health
docker compose up -d
sleep 30
curl -s http://localhost:38701/api/health | python3 -m json.tool
```

Ожидаемый ответ health check:
```json
{
  "ok": true,
  "db": {
    "ok": true,
    "latencyMs": 0
  },
  "realtime": {
    "clients": 0
  },
  "timestamp": "2024-01-15T10:00:00.000Z",
  "version": "0.1.0"
}
```

---

## Быстрая справка — самые частые операции

```bash
# === РАЗРАБОТКА ===
bun run dev                          # Запустить dev-сервер
bun run db:reset                     # Сбросить и пересоздать БД

# === ПЕРВЫЙ ДЕПЛОЙ ===
./deploy.sh deploy                   # Собрать + запустить

# === ОБНОВЛЕНИЕ ===
git pull && ./deploy.sh update       # Обновить из git

# === МОНИТОРИНГ ===
./deploy.sh status                   # Статус и ресурсы
./deploy.sh logs                     # Логи в реальном времени
curl localhost:38701/api/health      # Health check

# === РЕЗЕРВНОЕ КОПИРОВАНИЕ ===
./deploy.sh db-backup                # Создать резервную копию

# === АВАРИЙНЫЕ СИТУАЦИИ ===
docker compose restart taskflow      # Перезапустить приложение
docker compose down && docker compose up -d  # Полный перезапуск
./deploy.sh reset-db                 # ⚠️ Сбросить все данные
```

---

*TaskFlow v2.0 · Документация актуальна для Bun 1.3.11, Next.js 16, Docker Compose v2.27+*