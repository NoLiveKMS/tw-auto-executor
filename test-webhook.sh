#!/bin/bash

# Цвета для вывода
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  TW Auto Executor - Тестирование${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 1. Health Check
echo -e "${YELLOW}Тест 1: Health Check${NC}"
curl -s http://127.0.0.1:3000/health | python3 -m json.tool
echo ""

# 2. Тест с невалидным passphrase (должен вернуть 401)
echo -e "${YELLOW}Тест 2: Неверный passphrase (ожидается ошибка)${NC}"
curl -s -X POST http://127.0.0.1:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "exchange": "binance",
    "symbol": "BTC/USDT",
    "action": "buy",
    "volume": 0.001,
    "orderType": "market",
    "passphrase": "wrong_password"
  }' | python3 -m json.tool
echo ""

# 3. Тест с невалидным символом (должен вернуть 400)
echo -e "${YELLOW}Тест 3: Неверный формат символа (ожидается ошибка)${NC}"
curl -s -X POST http://127.0.0.1:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "exchange": "binance",
    "symbol": "INVALID",
    "action": "buy",
    "volume": 0.001,
    "orderType": "market",
    "passphrase": "test123"
  }' | python3 -m json.tool
echo ""

# 4. Тест с отрицательным объемом (должен вернуть 400)
echo -e "${YELLOW}Тест 4: Отрицательный объем (ожидается ошибка)${NC}"
curl -s -X POST http://127.0.0.1:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "exchange": "binance",
    "symbol": "BTC/USDT",
    "action": "buy",
    "volume": -0.001,
    "orderType": "market",
    "passphrase": "test123"
  }' | python3 -m json.tool
echo ""

# 5. Тест с правильными данными (будет ошибка т.к. нет API ключей)
echo -e "${YELLOW}Тест 5: Валидный сигнал (ожидается ошибка отсутствия API ключей)${NC}"
curl -s -X POST http://127.0.0.1:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "exchange": "binance",
    "symbol": "BTC/USDT",
    "action": "buy",
    "volume": 0.001,
    "orderType": "market",
    "passphrase": "test123"
  }' | python3 -m json.tool
echo ""

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Тестирование завершено!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}Примечание:${NC} Последний тест покажет ошибку отсутствия API ключей."
echo -e "Это нормально! Чтобы протестировать реальную торговлю:"
echo -e "1. Добавьте API ключи биржи в .env файл"
echo -e "2. Перезапустите сервер: npm run dev"

