# volumeUSDT - Быстрый Старт

## Что нового?

Теперь вы можете указывать объем сделки в **долларах США (USDT)** вместо количества монет!

## Быстрый пример

### ДО (старый способ)
```json
{
  "exchange": "binance",
  "symbol": "BTC/USDT",
  "action": "buy",
  "volume": 0.001,  ← Нужно вручную считать количество монет
  "orderType": "market",
  "passphrase": "your_secret"
}
```

### СЕЙЧАС (новый способ)
```json
{
  "exchange": "binance",
  "symbol": "BTC/USDT",
  "action": "buy",
  "volumeUSDT": 100,  ← Просто укажите сумму в долларах!
  "orderType": "market",
  "passphrase": "your_secret"
}
```

## Основные правила

✅ **Можно использовать** `volumeUSDT` (новый параметр)  
✅ **Можно использовать** `volume` (старый параметр, всё еще работает)  
✅ **Если указаны оба**, используется `volumeUSDT` (приоритет)  
❌ **Нельзя не указывать ни один** из параметров

## Примеры для TradingView

### Market Order на $100
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

### Futures с плечом 10x на $200
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

## Тестирование

```bash
# Запустите тестовый скрипт
./test-volumeusdt.sh

# Или вручную
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "exchange": "binance",
    "symbol": "BTC/USDT",
    "action": "buy",
    "volumeUSDT": 100,
    "orderType": "market",
    "passphrase": "test123"
  }'
```

## Подробная документация

Смотрите полную документацию: [VOLUMEUSDT_FEATURE.md](./VOLUMEUSDT_FEATURE.md)

---

**Совет**: Используйте `volumeUSDT` для лучшего контроля риска! Теперь размер позиции всегда фиксирован в долларах, независимо от цены актива.

