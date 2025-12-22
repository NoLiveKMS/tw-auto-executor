#!/bin/bash

# Тестирование функциональности volumeUSDT
# Этот скрипт проверяет вход в позицию по USDT

set -e

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# URL сервера (можно изменить для локального тестирования)
BASE_URL="${BASE_URL:-http://localhost:3000}"

echo -e "${YELLOW}╔════════════════════════════════════════════════╗${NC}"
echo -e "${YELLOW}║   Тестирование входа по позиции в USDT       ║${NC}"
echo -e "${YELLOW}╚════════════════════════════════════════════════╝${NC}"
echo ""

# Тест 1: Market order с volumeUSDT
echo -e "${YELLOW}Тест 1: Market order с volumeUSDT=100${NC}"
curl -X POST "$BASE_URL/webhook" \
  -H "Content-Type: application/json" \
  -d '{
    "exchange": "binance",
    "symbol": "BTC/USDT",
    "action": "buy",
    "volumeUSDT": 100,
    "orderType": "market",
    "passphrase": "test123"
  }'
echo -e "\n"

# Тест 2: Limit order с volumeUSDT
echo -e "${YELLOW}Тест 2: Limit order с volumeUSDT=50${NC}"
curl -X POST "$BASE_URL/webhook" \
  -H "Content-Type: application/json" \
  -d '{
    "exchange": "binance",
    "symbol": "ETH/USDT",
    "action": "sell",
    "volumeUSDT": 50,
    "orderType": "limit",
    "passphrase": "test123"
  }'
echo -e "\n"

# Тест 3: Futures с volumeUSDT
echo -e "${YELLOW}Тест 3: Futures LONG с volumeUSDT=200 и leverage 10x${NC}"
curl -X POST "$BASE_URL/webhook" \
  -H "Content-Type: application/json" \
  -d '{
    "exchange": "binance",
    "symbol": "BTC/USDT:USDT",
    "action": "buy",
    "volumeUSDT": 200,
    "orderType": "market",
    "leverage": 10,
    "direction": "long",
    "passphrase": "test123"
  }'
echo -e "\n"

# Тест 4: volumeUSDT имеет приоритет над volume
echo -e "${YELLOW}Тест 4: Если указаны оба параметра, volumeUSDT имеет приоритет${NC}"
curl -X POST "$BASE_URL/webhook" \
  -H "Content-Type: application/json" \
  -d '{
    "exchange": "binance",
    "symbol": "BTC/USDT",
    "action": "buy",
    "volume": 999,
    "volumeUSDT": 100,
    "orderType": "market",
    "passphrase": "test123"
  }'
echo -e "\n"

# Тест 5: Ошибка валидации - не указан ни volume, ни volumeUSDT
echo -e "${YELLOW}Тест 5: Ошибка валидации - не указан ни volume, ни volumeUSDT${NC}"
curl -X POST "$BASE_URL/webhook" \
  -H "Content-Type: application/json" \
  -d '{
    "exchange": "binance",
    "symbol": "BTC/USDT",
    "action": "buy",
    "orderType": "market",
    "passphrase": "test123"
  }'
echo -e "\n"

# Тест 6: Ошибка валидации - отрицательный volumeUSDT
echo -e "${YELLOW}Тест 6: Ошибка валидации - отрицательный volumeUSDT${NC}"
curl -X POST "$BASE_URL/webhook" \
  -H "Content-Type: application/json" \
  -d '{
    "exchange": "binance",
    "symbol": "BTC/USDT",
    "action": "buy",
    "volumeUSDT": -100,
    "orderType": "market",
    "passphrase": "test123"
  }'
echo -e "\n"

# Тест 7: Старый формат с volume всё ещё работает
echo -e "${YELLOW}Тест 7: Обратная совместимость - старый формат с volume${NC}"
curl -X POST "$BASE_URL/webhook" \
  -H "Content-Type: application/json" \
  -d '{
    "exchange": "binance",
    "symbol": "BTC/USDT",
    "action": "buy",
    "volume": 0.001,
    "orderType": "market",
    "passphrase": "test123"
  }'
echo -e "\n"

echo -e "${GREEN}╔════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║            Тестирование завершено             ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Примечание:${NC}"
echo -e "- Тесты 1-4, 7 должны вернуть 200 (успех) или ошибки биржи"
echo -e "- Тесты 5-6 должны вернуть 400 (ошибка валидации)"
echo -e "- volumeUSDT всегда имеет приоритет над volume"
echo -e "- Расчет объема использует цену лимитного ордера для limit orders"

