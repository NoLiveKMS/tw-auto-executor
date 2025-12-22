# 🧪 Тестирование TW Auto Executor

## Локальное тестирование

### 1. Подготовка окружения

Создайте `.env` файл:

```bash
cp .env.example .env
nano .env
```

Минимальная конфигурация для тестирования:

```env
PORT=3000
HOST=0.0.0.0
NODE_ENV=development
WEBHOOK_PASSPHRASE=
BINANCE_API_KEY=your_test_api_key
BINANCE_SECRET=your_test_secret
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
```

⚠️ **Важно**: Используйте Binance Testnet для тестов:
- https://testnet.binance.vision/
- API Endpoint: `https://testnet.binance.vision`

### 2. Запуск в режиме разработки

```bash
npm run dev
```

Ожидаемый вывод:
```
🚀 TW Auto Executor started on 0.0.0.0:3000
Environment: development
Telegram notifications: DISABLED
Configured exchanges: binance
```

### 3. Тестирование Health Check

```bash
curl http://localhost:3000/health
```

Ожидаемый ответ:
```json
{
  "status": "ok",
  "timestamp": "2024-12-22T10:30:00.000Z",
  "uptime": 12.345
}
```

### 4. Тестирование Webhook

#### Тест 1: Валидный сигнал на покупку

```bash
curl -X POST http://localhost:3000/webhook \
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

Ожидаемый успешный ответ (200):
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

#### Тест 2: Неверный passphrase

```bash
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "exchange": "binance",
    "symbol": "BTC/USDT",
    "action": "buy",
    "volume": 0.001,
    "orderType": "market",
    "passphrase": "wrong"
  }'
```

Ожидаемая ошибка (401):
```json
{
  "success": false,
  "error": "Authentication Error: Invalid passphrase"
}
```

#### Тест 3: Невалидный символ

```bash
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "exchange": "binance",
    "symbol": "INVALID",
    "action": "buy",
    "volume": 0.001,
    "orderType": "market",
    "passphrase": "test123"
  }'
```

Ожидаемая ошибка (400):
```json
{
  "success": false,
  "error": "Validation Error: Invalid symbol format (expected BTC/USDT)"
}
```

#### Тест 4: Отрицательный объем

```bash
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "exchange": "binance",
    "symbol": "BTC/USDT",
    "action": "buy",
    "volume": -0.001,
    "orderType": "market",
    "passphrase": "test123"
  }'
```

Ожидаемая ошибка (400):
```json
{
  "success": false,
  "error": "Validation Error: Volume must be positive"
}
```

## Тестирование с TradingView

### Настройка Testnet на TradingView

TradingView не поддерживает напрямую testnet, поэтому:

1. **Опция 1**: Используйте минимальный объем на реальной бирже
2. **Опция 2**: Используйте Paper Trading аккаунт
3. **Опция 3**: Добавьте "dry-run" режим в код

### Пример Alert в TradingView

1. Создайте Alert на любой паре
2. Webhook URL: `http://YOUR_VPS_IP:3000/webhook`
3. Message:

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

Переменные TradingView:
- `{{ticker}}` - символ (например, BTCUSDT)
- `{{strategy.order.action}}` - buy или sell
- `{{close}}` - цена закрытия

## Нагрузочное тестирование

### Простой нагрузочный тест с Apache Bench

```bash
# Установка Apache Bench (если не установлен)
sudo apt-get install apache2-utils

# Тест: 100 запросов, 10 одновременных
ab -n 100 -c 10 -p payload.json -T application/json \
  http://localhost:3000/webhook
```

Создайте `payload.json`:
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

### Нагрузочный тест с k6

Установите k6:
```bash
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

Создайте `load-test.js`:
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 20 },
    { duration: '1m', target: 50 },
    { duration: '30s', target: 0 },
  ],
};

export default function () {
  const payload = JSON.stringify({
    exchange: 'binance',
    symbol: 'BTC/USDT',
    action: 'buy',
    volume: 0.001,
    orderType: 'market',
    passphrase: 'test123',
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const res = http.post('http://localhost:3000/webhook', payload, params);
  
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);
}
```

Запустите:
```bash
k6 run load-test.js
```

## Мониторинг логов

### PM2 логи

```bash
# Реальное время
pm2 logs tw-auto-executor

# Только ошибки
pm2 logs tw-auto-executor --err

# Последние 100 строк
pm2 logs tw-auto-executor --lines 100
```

### Логи через journalctl (systemd)

```bash
journalctl -u pm2-$USER -f
```

## Отладка

### Включение подробного логирования

В `.env`:
```env
NODE_ENV=development
```

### Проверка соединения с биржей

```bash
# Тест подключения к Binance API
curl https://api.binance.com/api/v3/time
```

Ожидаемый ответ:
```json
{
  "serverTime": 1703253000000
}
```

### Проверка Telegram бота

```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getMe"
```

## Контрольный чеклист перед продакшеном

- [ ] Тест health check работает
- [ ] Тест валидного webhook возвращает 200
- [ ] Тест неверного passphrase возвращает 401
- [ ] Тест невалидных данных возвращает 400
- [ ] API ключи бирж установлены правильно
- [ ] Проверен баланс на бирже для тестовых ордеров
- [ ] Telegram уведомления работают (если включены)
- [ ] Логи PM2 не показывают ошибок
- [ ] Сервер доступен извне (проверка firewall)
- [ ] HTTPS настроен (для production)
- [ ] Webhook passphrase достаточно сложный

## Частые проблемы

### Проблема: "ECONNREFUSED" при запуске

**Причина**: Порт уже занят

**Решение**:
```bash
# Найти процесс на порту 3000
sudo lsof -i :3000
# Убить процесс
kill -9 <PID>
```

### Проблема: API ключи не работают

**Причина**: Неверные ключи или IP не в whitelist

**Решение**:
1. Проверьте правильность ключей
2. Добавьте IP сервера в whitelist на бирже
3. Проверьте права API ключа (должен быть Trading)

### Проблема: Ордера не исполняются

**Причина**: Недостаточно средств или неверный символ

**Решение**:
1. Проверьте баланс на бирже
2. Убедитесь в правильности формата символа (BTC/USDT)
3. Проверьте минимальный объем для пары

## Автоматизированное тестирование (TODO)

В будущих версиях можно добавить:

- Unit тесты (Jest)
- Integration тесты
- E2E тесты с mock биржей
- CI/CD pipeline (GitHub Actions)

```bash
# Установка Jest (пример)
npm install --save-dev jest ts-jest @types/jest

# Запуск тестов
npm test
```

