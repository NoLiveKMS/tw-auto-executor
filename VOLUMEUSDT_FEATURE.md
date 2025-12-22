# Функциональность volumeUSDT - Вход в позицию в USDT

## Описание

Реализована возможность указывать объем сделки в долларах США (USDT) вместо количества монет. Система автоматически рассчитывает необходимый объем в базовой валюте на основе текущей цены актива.

## Как это работает

### Market Orders
1. Получает текущую цену актива через `fetchTicker()`
2. Рассчитывает объем: `volume = volumeUSDT / currentPrice`
3. Применяет правила округления биржи: `amountToPrecision()`
4. Создает ордер с рассчитанным объемом

### Limit Orders
1. Получает текущую цену актива через `fetchTicker()`
2. Рассчитывает цену лимитного ордера (buy: -0.1%, sell: +0.1%)
3. Рассчитывает объем: `volume = volumeUSDT / limitPrice`
4. Применяет правила округления биржи
5. Создает ордер с рассчитанным объемом и ценой

## Приоритет параметров

**ВАЖНО**: Если указаны оба параметра (`volume` и `volumeUSDT`), то **`volumeUSDT` имеет приоритет**.

## Примеры использования

### 1. Market Order с volumeUSDT

```json
{
  "exchange": "binance",
  "symbol": "BTC/USDT",
  "action": "buy",
  "volumeUSDT": 100,
  "orderType": "market",
  "passphrase": "your_secret"
}
```

Если BTC стоит $50,000, система купит `100 / 50000 = 0.002 BTC`.

### 2. Limit Order с volumeUSDT

```json
{
  "exchange": "binance",
  "symbol": "ETH/USDT",
  "action": "sell",
  "volumeUSDT": 50,
  "orderType": "limit",
  "passphrase": "your_secret"
}
```

Если ETH стоит $2,000, лимитная цена будет `$2,002` (+0.1%), система продаст `50 / 2002 ≈ 0.025 ETH`.

### 3. Futures с leverage

```json
{
  "exchange": "binance",
  "symbol": "BTC/USDT:USDT",
  "action": "buy",
  "volumeUSDT": 200,
  "orderType": "market",
  "leverage": 10,
  "direction": "long",
  "passphrase": "your_secret"
}
```

Откроет лонг позицию на $200 с плечом 10x.

### 4. Обратная совместимость (старый формат)

```json
{
  "exchange": "binance",
  "symbol": "BTC/USDT",
  "action": "buy",
  "volume": 0.001,
  "orderType": "market",
  "passphrase": "your_secret"
}
```

Старый формат с `volume` продолжает работать без изменений.

## Валидация

### Успешная валидация
- Указан хотя бы один из параметров: `volume` ИЛИ `volumeUSDT`
- `volumeUSDT > 0` (если указан)
- `volume > 0` (если указан)

### Ошибки валидации

**Ошибка 1**: Не указан ни один параметр объема
```json
{
  "exchange": "binance",
  "symbol": "BTC/USDT",
  "action": "buy",
  "orderType": "market",
  "passphrase": "your_secret"
}
```
❌ Ответ: `400 Bad Request - "Either volume or volumeUSDT must be specified"`

**Ошибка 2**: Отрицательный volumeUSDT
```json
{
  "volumeUSDT": -100,
  ...
}
```
❌ Ответ: `400 Bad Request - "volumeUSDT must be positive"`

## TradingView Alert Message

### Шаблон для volumeUSDT (новый)
```json
{
  "exchange": "binance",
  "symbol": "{{ticker}}",
  "action": "{{strategy.order.action}}",
  "volumeUSDT": 100,
  "orderType": "market",
  "passphrase": "your_secret"
}
```

### Шаблон для volume (старый, совместимый)
```json
{
  "exchange": "binance",
  "symbol": "{{ticker}}",
  "action": "{{strategy.order.action}}",
  "volume": 0.001,
  "orderType": "market",
  "passphrase": "your_secret"
}
```

## Тестирование

Запустите тестовый скрипт для проверки всех сценариев:

```bash
./test-volumeusdt.sh
```

Тестовый скрипт проверяет:
1. ✅ Market order с volumeUSDT
2. ✅ Limit order с volumeUSDT
3. ✅ Futures с volumeUSDT и leverage
4. ✅ Приоритет volumeUSDT над volume
5. ✅ Валидация: отсутствие обоих параметров
6. ✅ Валидация: отрицательный volumeUSDT
7. ✅ Обратная совместимость со старым форматом

## Технические детали

### Затронутые файлы
1. **`src/types/trade-signal.types.ts`**
   - Добавлен параметр `volumeUSDT?: number`
   - Создан валидатор `TradeSignalWithVolumeCodec`
   - `volume` теперь опциональный

2. **`src/handler/webhook.handler.ts`**
   - Обновлена JSON Schema для Fastify
   - Добавлена валидация `oneOf` для volume/volumeUSDT

3. **`src/domain/validation.service.ts`**
   - Использует `TradeSignalWithVolumeCodec`

4. **`src/infrastructure/exchange/exchange.service.ts`**
   - Добавлена функция `calculateVolume()`
   - Обновлены `executeMarketOrder()` и `executeLimitOrder()`
   - Автоматический расчет объема с применением биржевой прецизии

### Алгоритм расчета

```typescript
const calculateVolume = (
  exchange: ccxt.Exchange,
  signal: TradeSignal,
  priceForCalculation: number
): number => {
  // Приоритет у volumeUSDT
  if (signal.volumeUSDT !== undefined) {
    const calculatedVolume = signal.volumeUSDT / priceForCalculation;
    return parseFloat(exchange.amountToPrecision(signal.symbol, calculatedVolume));
  }
  
  // Используем volume, если volumeUSDT не указан
  if (signal.volume !== undefined) {
    return parseFloat(exchange.amountToPrecision(signal.symbol, signal.volume));
  }
  
  throw new Error('Neither volume nor volumeUSDT specified');
};
```

## Архитектура

```
TradingView Webhook
        ↓
webhook.handler.ts (JSON Schema validation)
        ↓
validation.service.ts (io-ts validation with TradeSignalWithVolumeCodec)
        ↓
trade-executor.service.ts (orchestration)
        ↓
exchange.service.ts
        ↓
  ┌─────────────────┐
  │  volumeUSDT?    │
  └────────┬────────┘
           ↓ YES
    fetchTicker() → currentPrice
    calculateVolume(volumeUSDT / price)
           ↓
    amountToPrecision()
           ↓
    createOrder(calculatedVolume)
```

## Преимущества

1. **Удобство**: Не нужно вручную рассчитывать количество монет
2. **Риск-менеджмент**: Легко контролировать размер позиции в долларах
3. **Универсальность**: Работает для любых торговых пар
4. **Точность**: Учитывает правила округления каждой биржи
5. **Обратная совместимость**: Старые сигналы продолжают работать

## Ограничения

- Для точного расчета требуется актуальная цена с биржи
- Market orders могут исполниться по цене, отличной от расчетной (slippage)
- Limit orders используют рассчитанную цену ордера (текущая цена ± 0.1%)

## Поддержка

Если у вас возникли вопросы или проблемы с функциональностью volumeUSDT, проверьте:

1. Указан ли хотя бы один из параметров (volume или volumeUSDT)
2. Положительное ли значение volumeUSDT
3. Доступна ли цена актива на бирже (используйте популярные пары)
4. Соблюдены ли минимальные требования биржи к объему сделки

---

**Дата реализации**: 22 декабря 2024  
**Версия**: 1.1.0

