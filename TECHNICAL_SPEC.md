# Техническое задание: TW Auto Executor

## 1. Общее описание

**TW Auto Executor** - микросервис для автоматического исполнения торговых сигналов от TradingView на криптобиржах с минимальной задержкой.

### 1.1 Цели проекта

- ⚡ Минимальная задержка между получением сигнала и исполнением ордера (< 500ms)
- 🔒 Безопасное хранение API ключей
- 📊 Строгая типизация для предотвращения ошибок
- 💬 Мгновенные уведомления о результатах
- 🌍 Поддержка нескольких бирж

### 1.2 Область применения

- Автоматизация торговых стратегий из TradingView
- High-frequency trading на основе индикаторов
- Алгоритмический трейдинг для розничных трейдеров

## 2. Архитектура

### 2.1 Высокоуровневая архитектура

```
┌─────────────┐       ┌──────────────┐       ┌─────────────┐
│ TradingView │──────▶│ API Gateway  │──────▶│ AWS Lambda  │
│   Webhook   │ HTTPS │   (AWS)      │ Event │  (Node.js)  │
└─────────────┘       └──────────────┘       └──────┬──────┘
                                                     │
                       ┌─────────────────────────────┼─────────┐
                       │                             │         │
                       ▼                             ▼         ▼
              ┌────────────────┐          ┌──────────────┐   ┌──────────┐
              │ SSM Parameters │          │    CCXT      │   │ Telegram │
              │   (Secrets)    │          │  (Binance,   │   │   Bot    │
              └────────────────┘          │   Bybit)     │   └──────────┘
                                          └──────────────┘
```

### 2.2 Архитектура кода (Clean Architecture + FP)

```
src/
├── types/                    # Domain Models (строгие типы)
│   ├── trade-signal.types.ts # Branded types для сигналов
│   ├── order.types.ts        # Типы ордеров
│   ├── error.types.ts        # Union types ошибок
│   └── config.types.ts       # Конфигурация
│
├── domain/                   # Business Logic (чистые функции)
│   ├── exchange/
│   │   └── exchange.service.ts  # CCXT wrapper с TaskEither
│   └── validation/
│       └── signal-validator.ts  # Валидация с Either
│
├── infrastructure/           # External Services
│   ├── telegram/
│   │   └── telegram.service.ts  # Уведомления
│   └── config/
│       └── config.service.ts    # Загрузка конфигурации
│
├── application/              # Use Cases
│   └── trade-executor.use-case.ts  # Композиция операций
│
└── handler.ts                # Lambda Entry Point
```

### 2.3 Функциональное программирование

Все операции используют монады из `fp-ts`:

- `Either<E, A>` - синхронные операции с ошибками
- `TaskEither<E, A>` - асинхронные операции с ошибками
- `pipe()` - композиция функций

Пример:

```typescript
pipe(
  validateTradeSignal(rawSignal),         // Either<Error, Signal>
  TE.fromEither,
  TE.chain(exchangeService.createOrder),  // TaskEither<Error, Order>
  TE.map(sendNotification)                // TaskEither<Error, void>
)
```

## 3. Стек технологий

### 3.1 Runtime & Language

- **Runtime**: Node.js 20.x LTS
- **Язык**: TypeScript 5.9
- **Компилятор**: `tsc` с строгими правилами

### 3.2 Основные библиотеки

| Библиотека | Версия | Назначение |
|-----------|--------|-----------|
| `fp-ts` | 2.16.2 | Функциональное программирование |
| `ccxt` | 4.2.71 | Интеграция с биржами |
| `axios` | 1.6.5 | HTTP клиент для Telegram |
| `@types/aws-lambda` | 8.10.133 | Типы AWS Lambda |

### 3.3 Dev Dependencies

| Инструмент | Назначение |
|-----------|-----------|
| `eslint` | Статический анализ кода |
| `prettier` | Форматирование кода |
| `serverless` | Деплой на AWS |
| `jest` | Тестирование |

### 3.4 AWS Services

- **Lambda**: Выполнение кода (Node.js 20.x)
- **API Gateway (HTTP API)**: Прием webhook
- **SSM Parameter Store**: Хранение секретов
- **CloudWatch**: Логирование и мониторинг
- **IAM**: Управление доступом

## 4. Детальная спецификация модулей

### 4.1 Trade Signal Validator

**Модуль**: `src/domain/validation/signal-validator.ts`

**Ответственность**: Валидация входящих данных от TradingView

**Входные данные**:
```typescript
unknown  // Необработанный JSON от TradingView
```

**Выходные данные**:
```typescript
Either<ValidationError, ValidatedSignal>
```

**Правила валидации**:

1. `exchange`: Должен быть в списке ['binance', 'bybit', 'okx', 'bitget']
2. `symbol`: Формат BASE/QUOTE (например, BTC/USDT)
3. `action`: 'buy' или 'sell'
4. `orderType`: 'market' или 'limit'
5. `volume`: Положительное число, finite
6. `price`: Обязательна для limit, опциональна для market
7. `passphrase`: Опциональна, проверяется отдельно

**Типичные ошибки**:
- Missing required field
- Invalid exchange
- Invalid symbol format
- Negative volume

### 4.2 Exchange Service

**Модуль**: `src/domain/exchange/exchange.service.ts`

**Ответственность**: Создание ордеров на биржах через CCXT

**API**:

```typescript
interface IExchangeService {
  createMarketOrder: (signal: TradeSignal) => TaskEither<DomainError, Order>;
  getBalance: (currency: string) => TaskEither<DomainError, number>;
  fetchOrderStatus: (orderId: string, symbol: Symbol) => TaskEither<DomainError, Order>;
}
```

**Оптимизации**:
- `timeInForce: 'IOC'` для market ордеров
- Кэширование экземпляра Exchange между вызовами Lambda
- Таймаут: 30 секунд

**Обработка ошибок**:
- `AuthenticationError` → 401 (неправильные API ключи)
- `InsufficientFunds` → 400 (недостаточно средств)
- `NetworkError` → 500 (проблемы связи с биржей)
- `ExchangeError` → 500 (ошибка биржи)

### 4.3 Telegram Notification Service

**Модуль**: `src/infrastructure/telegram/telegram.service.ts`

**Ответственность**: Отправка уведомлений в Telegram

**Формат сообщений**:

**Успешный ордер**:
```
🟢 ORDER EXECUTED

Exchange: BINANCE
Symbol: BTC/USDT
Side: LONG
Amount: 0.001
Price: 50000.00
Status: CLOSED
Latency: 234ms
```

**Ошибка**:
```
❌ ORDER FAILED

Exchange: BINANCE
Symbol: BTC/USDT
Error: InsufficientFunds
Message: Not enough balance
```

**Паттерн**: Fire-and-forget (не блокирует основной поток)

### 4.4 Trade Executor Use Case

**Модуль**: `src/application/trade-executor.use-case.ts`

**Ответственность**: Оркестрация всех операций

**Флоу**:

```
1. validateTradeSignal(rawData)          ──▶ Either<Error, ValidatedSignal>
   ↓
2. validatePassphrase(signal)            ──▶ Either<Error, ValidatedSignal>
   ↓
3. exchangeService.createMarketOrder()   ──▶ TaskEither<Error, Order>
   ↓
4. telegramService.sendNotification()    ──▶ Fire-and-forget
   ↓
5. Return TradeExecutionResult           ──▶ TaskEither<Error, Result>
```

**Метрики**:
- Latency (мс): Время от получения webhook до ответа
- Success rate: % успешных ордеров
- Error types: Распределение типов ошибок

### 4.5 Lambda Handler

**Модуль**: `src/handler.ts`

**Ответственность**: AWS Lambda entry point

**Endpoints**:

1. **POST /webhook**
   - Принимает JSON от TradingView
   - Возвращает статус исполнения

2. **GET /health**
   - Проверка работоспособности
   - Возвращает `{ status: "healthy" }`

**Оптимизации Cold Start**:
- Глобальное кэширование конфигурации
- Lazy initialization сервисов
- Keep-alive connections

**HTTP Responses**:

| Код | Описание | Пример |
|-----|----------|--------|
| 200 | Успех | `{ success: true, orderId: "123" }` |
| 400 | Ошибка валидации | `{ success: false, error: "ValidationError" }` |
| 500 | Ошибка сервера | `{ success: false, error: "ExchangeError" }` |

## 5. Типы данных

### 5.1 TradeSignal (Input)

```typescript
interface TradeSignal {
  readonly exchange: ExchangeId;      // "binance" | "bybit"
  readonly symbol: Symbol;            // "BTC/USDT"
  readonly action: OrderSide;         // "buy" | "sell"
  readonly orderType: OrderType;      // "market" | "limit"
  readonly volume: number;            // 0.001
  readonly price?: number;            // 50000 (optional)
  readonly leverage?: number;         // 10 (optional)
  readonly passphrase?: Passphrase;   // "secret" (optional)
}
```

### 5.2 Order (Output)

```typescript
interface Order {
  readonly id: OrderId;              // "12345678"
  readonly symbol: Symbol;           // "BTC/USDT"
  readonly type: OrderType;          // "market"
  readonly side: OrderSide;          // "buy"
  readonly price?: number;           // 50000
  readonly amount: number;           // 0.001
  readonly filled: number;           // 0.001
  readonly remaining: number;        // 0
  readonly status: OrderStatus;      // "closed"
  readonly timestamp: number;        // 1234567890000
  readonly datetime: string;         // "2024-01-01T00:00:00.000Z"
  readonly fee?: OrderFee;
}
```

### 5.3 DomainError (Errors)

```typescript
type DomainError =
  | ValidationError          // Ошибка валидации входных данных
  | ExchangeError           // Ошибка биржи
  | AuthenticationError     // Ошибка аутентификации
  | NetworkError            // Сетевая ошибка
  | ConfigurationError      // Ошибка конфигурации
  | InsufficientFundsError; // Недостаточно средств
```

## 6. Конфигурация

### 6.1 Environment Variables

Все переменные загружаются из AWS SSM Parameter Store:

| Переменная | Тип | Обязательна | Описание |
|-----------|-----|------------|----------|
| `BINANCE_API_KEY` | SecureString | ❌ | API ключ Binance |
| `BINANCE_API_SECRET` | SecureString | ❌ | API секрет Binance |
| `BYBIT_API_KEY` | SecureString | ❌ | API ключ Bybit |
| `BYBIT_API_SECRET` | SecureString | ❌ | API секрет Bybit |
| `TELEGRAM_BOT_TOKEN` | SecureString | ❌ | Токен Telegram бота |
| `TELEGRAM_CHAT_ID` | SecureString | ❌ | ID чата Telegram |
| `WEBHOOK_PASSPHRASE` | SecureString | ❌ | Секретная фраза |
| `NODE_ENV` | String | ✅ | production/staging/development |
| `LOG_LEVEL` | String | ✅ | debug/info/warn/error |

### 6.2 Lambda Configuration

```yaml
Runtime: nodejs20.x
Memory: 512 MB
Timeout: 30 seconds
Region: ap-northeast-1 (Tokyo)
```

**Обоснование Memory**: 512MB - оптимальный баланс между скоростью выполнения и стоимостью.

**Обоснование Region**: Токио - минимальная задержка до серверов Binance/Bybit.

## 7. Безопасность

### 7.1 Хранение секретов

- ✅ **SSM Parameter Store** с типом SecureString
- ✅ Шифрование KMS по умолчанию
- ✅ Доступ только через IAM роль Lambda
- ❌ Никогда не логировать API ключи

### 7.2 Webhook Security

**Опция 1: Passphrase (рекомендуется)**
- Добавить секретную фразу в JSON
- Проверять при каждом запросе
- Генерировать через `openssl rand -base64 32`

**Опция 2: IP Whitelist (дополнительно)**
- Ограничить доступ к API Gateway по IP TradingView

### 7.3 IAM Политика

Минимальные права Lambda:

```json
{
  "Effect": "Allow",
  "Action": [
    "ssm:GetParameter",
    "logs:CreateLogStream",
    "logs:PutLogEvents"
  ],
  "Resource": [
    "arn:aws:ssm:*:*:parameter/tw-executor/*",
    "arn:aws:logs:*:*:log-group:/aws/lambda/tw-auto-executor-*"
  ]
}
```

## 8. Мониторинг и логирование

### 8.1 CloudWatch Metrics

Автоматически собираются:
- Invocations (количество вызовов)
- Duration (длительность выполнения)
- Errors (количество ошибок)
- Throttles (ограничения)

### 8.2 Custom Logs

Формат логов:

```
[LEVEL] [TIMESTAMP] Message { context }
```

Примеры:

```
[INFO] [2024-01-01T00:00:00.000Z] 📥 Received webhook request { requestId: "abc123" }
[INFO] [2024-01-01T00:00:01.234Z] ✅ Order executed successfully { orderId: "12345", latency: 234 }
[ERROR] [2024-01-01T00:00:02.000Z] ❌ Order execution failed { error: "InsufficientFunds" }
```

### 8.3 Алерты (рекомендуется настроить)

- ⚠️ Error rate > 10% за 5 минут
- ⚠️ Latency > 3 секунды
- ⚠️ Function throttling

## 9. Performance Requirements

### 9.1 Latency Targets

| Метрика | Target | Max Acceptable |
|---------|--------|----------------|
| Cold Start | < 1s | < 3s |
| Warm Execution | < 200ms | < 500ms |
| E2E (TradingView → Exchange) | < 500ms | < 2s |

### 9.2 Throughput

- **Expected**: 10-100 requests/day
- **Max**: 1000 requests/day (с Provisioned Concurrency)

### 9.3 Availability

- **Target**: 99.5% uptime
- **Зависимости**: AWS Lambda (99.95%), CCXT exchanges

## 10. Стоимость

### 10.1 Расчёт (100 сделок/день)

| Сервис | Использование | Стоимость |
|--------|--------------|-----------|
| Lambda Invocations | 3,000/месяц | $0.00 (Free Tier) |
| Lambda Duration | 10 GB-сек | $0.17 |
| API Gateway | 3,000 requests | $0.00 |
| SSM Parameters | 7 параметров | $0.00 (Free) |
| CloudWatch Logs | 1 GB | $0.03 |
| **ИТОГО** | | **~$0.20-0.40/месяц** |

### 10.2 С Provisioned Concurrency

Для устранения холодного старта:

```yaml
provisionedConcurrency: 1
```

Дополнительная стоимость: **~$10/месяц**

## 11. Deployment

### 11.1 CI/CD (рекомендуется)

```yaml
# GitHub Actions пример
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - run: npm install
      - run: npm run build
      - run: serverless deploy
```

### 11.2 Rollback

```bash
# Откат к предыдущей версии
serverless deploy --stage prod --aws-s3-accelerate
```

## 12. Тестирование

### 12.1 Unit Tests (TODO)

```typescript
describe('validateTradeSignal', () => {
  it('should validate valid signal', () => {
    const signal = { exchange: 'binance', ... };
    const result = validateTradeSignal(signal);
    expect(E.isRight(result)).toBe(true);
  });
});
```

### 12.2 Integration Tests

Использовать testnet биржи:

```typescript
const testnetConfig: ExchangeConfig = {
  exchangeId: 'binance',
  apiKey: TEST_API_KEY,
  apiSecret: TEST_API_SECRET,
  testnet: true
};
```

## 13. Ограничения и известные проблемы

### 13.1 Ограничения

- Lambda timeout: 30 секунд
- Payload size: 6 MB
- Concurrent executions: 1000 (по умолчанию)

### 13.2 Known Issues

- Cold start может быть > 1s при первом запросе
- CCXT может иметь задержку при loadMarkets()
- Telegram API может быть недоступен (fire-and-forget решает)

## 14. Roadmap

### Фаза 1 (MVP) ✅
- [x] Базовая функциональность
- [x] Binance + Bybit поддержка
- [x] Telegram уведомления

### Фаза 2 (Enhancement)
- [ ] Добавить больше бирж (OKX, Bitget)
- [ ] Поддержка stop-loss / take-profit
- [ ] WebSocket для реального времени
- [ ] Dashboard для мониторинга

### Фаза 3 (Advanced)
- [ ] Machine Learning для оптимизации исполнения
- [ ] Multi-region deployment
- [ ] Advanced risk management

---

**Версия**: 1.0.0  
**Дата**: 2024-01-01  
**Автор**: Maksim

