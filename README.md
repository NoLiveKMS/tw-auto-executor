# TW Auto Executor - High-Performance TradingView Signal Executor

Высокопроизводительный сервис для исполнения торговых сигналов от TradingView на VPS с минимальной задержкой.

## 🚀 Особенности

- **Ultra-Fast**: Fastify для обработки webhook с минимальной латентностью
- **Functional**: fp-ts для надежной обработки ошибок через монады
- **Type-Safe**: Строгая типизация TypeScript 5.9
- **Production-Ready**: PM2 для 24/7 работы с автоперезапуском
- **One-Click Deploy**: Установка на Ubuntu VPS одной командой

## 📦 Стек технологий

- TypeScript 5.9 (strict mode)
- Fastify 4.x
- fp-ts 2.16
- CCXT 4.x
- Node.js 20.x
- PM2

## 🔧 Быстрая установка на VPS

```bash
curl -sSL https://raw.githubusercontent.com/YOUR_REPO/install.sh | bash
```

## 📝 Ручная установка

1. Клонируйте репозиторий:
```bash
git clone https://github.com/YOUR_REPO/tw-auto-executor.git
cd tw-auto-executor
```

2. Установите зависимости:
```bash
npm install
```

3. Настройте переменные окружения:
```bash
cp .env.example .env
nano .env
```

4. Соберите проект:
```bash
npm run build
```

5. Запустите сервис:
```bash
npm start
```

Или с PM2:
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## 🎯 Формат TradingView Webhook

```json
{
  "exchange": "binance",
  "symbol": "BTC/USDT",
  "action": "buy",
  "volume": 0.001,
  "orderType": "market",
  "passphrase": "your_secure_password"
}
```

**Endpoint**: `POST http://YOUR_VPS_IP:3000/webhook`

## 🏗️ Архитектура

```
src/
├── types/              # Domain types & branded types
├── domain/             # Business logic
├── infrastructure/     # CCXT, Telegram, Config
├── application/        # Orchestration layer
└── handler/            # Fastify handlers
```

## 📊 Мониторинг

```bash
pm2 monit           # Мониторинг процессов
pm2 logs            # Логи
pm2 status          # Статус
```

## 🔐 Безопасность

- Все API ключи в `.env` файле
- Проверка passphrase для каждого webhook
- HTTPS рекомендуется для production

## 📄 Лицензия

MIT
