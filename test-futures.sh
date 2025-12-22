#!/bin/bash

# Цвета
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Тест Futures Trading${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Тест 1: Futures long position с символом ICNTUSDT.P
echo -e "${YELLOW}Тест 1: Открытие LONG позиции (ICNT/USDT futures)${NC}"
curl -s -X POST http://127.0.0.1:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "exchange": "binance",
    "symbol": "ICNT/USDT:USDT",
    "action": "buy",
    "volume": 10,
    "orderType": "market",
    "marketType": "futures",
    "direction": "long",
    "leverage": 5,
    "passphrase": "test123"
  }' | python3 -m json.tool
echo ""

# Тест 2: С форматом .P (будет преобразован)
echo -e "${YELLOW}Тест 2: Формат с .P (ICNTUSDT.P)${NC}"
curl -s -X POST http://127.0.0.1:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "exchange": "binance",
    "symbol": "ICNTUSDT.P",
    "action": "buy",
    "volume": 10,
    "orderType": "market",
    "leverage": 5,
    "passphrase": "test123"
  }' | python3 -m json.tool
echo ""

# Тест 3: Short position
echo -e "${YELLOW}Тест 3: SHORT позиция${NC}"
curl -s -X POST http://127.0.0.1:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "exchange": "binance",
    "symbol": "BTC/USDT:USDT",
    "action": "sell",
    "volume": 0.001,
    "orderType": "market",
    "marketType": "futures",
    "direction": "short",
    "leverage": 10,
    "passphrase": "test123"
  }' | python3 -m json.tool
echo ""

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Тестирование futures завершено!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}Примечание:${NC} Для реальной торговли убедитесь что:"
echo -e "1. У вас открыт Futures аккаунт на бирже"
echo -e "2. API ключи имеют права на Futures торговлю"
echo -e "3. Есть достаточно средств на Futures балансе"

