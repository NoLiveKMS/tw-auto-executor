# 🚀 Быстрый старт (Локальное тестирование)

## Сервер уже запущен! ✅

Проверьте статус:
```bash
curl http://127.0.0.1:3000/health
```

## 📋 Команды

### Тестирование
```bash
# Запустить все тесты
./test-webhook.sh

# Тест health check
curl http://127.0.0.1:3000/health

# Тест webhook (валидный сигнал)
curl -X POST http://127.0.0.1:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "exchange": "binance",
    "symbol": "BTC/USDT",
    "action": "buy",
    "volume": 0.001,
    "orderType": "market",
    "passphrase": "test123"
  }'
```

### Управление сервером
```bash
# Остановить
lsof -ti:3000 | xargs kill -9

# Запустить заново
npm run dev

# Посмотреть логи
tail -f ~/.cursor/projects/Users-maksim-my-project-TWAutoBotPy/terminals/*.txt
```

### Сборка
```bash
# Пересобрать проект
npm run build

# Проверить типы
npm run type-check

# Линтинг
npm run lint
```

## ⚙️ Настройка для реальной торговли

### 1. Получите API ключи

**Вариант 1: Binance Testnet (рекомендуется для тестов)**
- Перейдите: https://testnet.binance.vision/
- Создайте аккаунт
- API Management → Create API Key
- Права: Spot Trading

**Вариант 2: Binance Real (продакшен)**
- Перейдите: https://www.binance.com/
- API Management → Create API Key
- Права: Enable Spot Trading (БЕЗ Withdrawals!)
- IP Whitelist: добавьте ваш IP

### 2. Настройте .env

```bash
nano .env
```

Добавьте ключи:
```env
# Server Configuration
PORT=3000
HOST=127.0.0.1
NODE_ENV=development

# Security
WEBHOOK_PASSPHRASE=test123

# Binance API Keys
BINANCE_API_KEY=ваш_api_key
BINANCE_SECRET=ваш_secret

# Telegram (опционально)
# TELEGRAM_BOT_TOKEN=
# TELEGRAM_CHAT_ID=
```

### 3. Перезапустите сервер

```bash
# Остановите старый
lsof -ti:3000 | xargs kill -9

# Запустите новый
npm run dev
```

### 4. Протестируйте с реальной биржей

```bash
curl -X POST http://127.0.0.1:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "exchange": "binance",
    "symbol": "BTC/USDT",
    "action": "buy",
    "volume": 0.001,
    "orderType": "market",
    "passphrase": "test123"
  }'
```

Ожидаемый успешный ответ:
```json
{
  "success": true,
  "orderId": "123456789",
  "exchange": "binance",
  "symbol": "BTC/USDT",
  "action": "buy",
  "volume": 0.001,
  "orderType": "market",
  "price": 43250.5,
  "status": "filled",
  "executedAt": "2024-12-22T10:30:00.000Z"
}
```

## 🔗 Интеграция с TradingView

### Настройка Alert

1. Откройте график в TradingView
2. Создайте Alert (значок будильника)
3. **Webhook URL**: `http://ваш_публичный_ip:3000/webhook`
4. **Message**:
```json
{
  "exchange": "binance",
  "symbol": "{{ticker}}",
  "action": "{{strategy.order.action}}",
  "volume": 0.001,
  "orderType": "market",
  "passphrase": "test123"
}
```

⚠️ **Для локального тестирования**: используйте ngrok или localtunnel для получения публичного URL:

```bash
# Установите ngrok
brew install ngrok

# Запустите туннель
ngrok http 3000

# Используйте полученный URL в TradingView
# Например: https://xxxx-xxx-xxx-xxx.ngrok.io/webhook
```

## 📊 Примеры сигналов

### Market Buy
```json
{
  "exchange": "binance",
  "symbol": "BTC/USDT",
  "action": "buy",
  "volume": 0.001,
  "orderType": "market",
  "passphrase": "test123"
}
```

### Market Sell
```json
{
  "exchange": "binance",
  "symbol": "ETH/USDT",
  "action": "sell",
  "volume": 0.01,
  "orderType": "market",
  "passphrase": "test123"
}
```

### Limit Order
```json
{
  "exchange": "binance",
  "symbol": "BTC/USDT",
  "action": "buy",
  "volume": 0.001,
  "orderType": "limit",
  "passphrase": "test123"
}
```

## 🐛 Решение проблем

### Порт уже занят
```bash
lsof -ti:3000 | xargs kill -9
```

### Логи не показываются
```bash
# Dev режим с красивыми логами
npm run dev

# Посмотреть файл логов
cat ~/.cursor/projects/Users-maksim-my-project-TWAutoBotPy/terminals/*.txt
```

### API ключи не работают
- Проверьте права API ключа (должен быть Trading)
- Проверьте IP whitelist
- Для testnet используйте testnet ключи

### Ордера не исполняются
- Проверьте баланс на бирже
- Убедитесь в правильности формата символа (BTC/USDT, не BTCUSDT)
- Проверьте минимальный объем для пары

## 📚 Документация

- `README.md` - Полная документация
- `DEPLOYMENT.md` - Развертывание на VPS
- `TEST.md` - Подробное тестирование
- `PROJECT_SUMMARY.md` - Техническая документация

## 🎓 Следующие шаги

1. ✅ Запустили локально
2. ⏭️ Настройте Telegram уведомления
3. ⏭️ Протестируйте с TradingView через ngrok
4. ⏭️ Разверните на VPS (см. DEPLOYMENT.md)
5. ⏭️ Настройте HTTPS с Nginx

---

**Версия**: 1.0.0  
**Дата**: 22 декабря 2024
