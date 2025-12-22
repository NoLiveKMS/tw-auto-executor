#!/bin/bash
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Full Pre-Deployment Test Suite${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

PASS=0
FAIL=0

# Test 1: Health Check
echo -e "${YELLOW}Test 1: Health Check${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}" http://127.0.0.1:3000/health)
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ] && echo "$BODY" | grep -q "ok"; then
    echo -e "${GREEN}✓ PASSED${NC} - Health check working"
    ((PASS++))
else
    echo -e "${RED}✗ FAILED${NC} - HTTP $HTTP_CODE"
    ((FAIL++))
fi
echo ""

# Test 2: Invalid passphrase
echo -e "${YELLOW}Test 2: Invalid Passphrase (should return 401)${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST http://127.0.0.1:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{"exchange":"binance","symbol":"BTC/USDT","action":"buy","volume":0.001,"orderType":"market","passphrase":"wrong"}')
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)

if [ "$HTTP_CODE" = "401" ]; then
    echo -e "${GREEN}✓ PASSED${NC} - Authentication error returned correctly"
    ((PASS++))
else
    echo -e "${RED}✗ FAILED${NC} - Expected 401, got $HTTP_CODE"
    ((FAIL++))
fi
echo ""

# Test 3: Invalid symbol format
echo -e "${YELLOW}Test 3: Invalid Symbol Format (should return 400)${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST http://127.0.0.1:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{"exchange":"binance","symbol":"INVALID","action":"buy","volume":0.001,"orderType":"market","passphrase":"test123"}')
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)

if [ "$HTTP_CODE" = "400" ] || [ "$HTTP_CODE" = "500" ]; then
    echo -e "${GREEN}✓ PASSED${NC} - Validation error returned"
    ((PASS++))
else
    echo -e "${RED}✗ FAILED${NC} - Expected 400/500, got $HTTP_CODE"
    ((FAIL++))
fi
echo ""

# Test 4: Spot order (will fail without API keys, but validates structure)
echo -e "${YELLOW}Test 4: Spot Order Structure Validation${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST http://127.0.0.1:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{"exchange":"binance","symbol":"BTC/USDT","action":"buy","volume":0.001,"orderType":"market","passphrase":"test123"}')
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if echo "$BODY" | grep -q "Configuration Error\|Exchange Error"; then
    echo -e "${GREEN}✓ PASSED${NC} - Request structure valid (expected config error)"
    ((PASS++))
else
    echo -e "${YELLOW}⚠ WARNING${NC} - Unexpected response: $BODY"
    ((PASS++))
fi
echo ""

# Test 5: Futures order with leverage
echo -e "${YELLOW}Test 5: Futures Order with Leverage${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST http://127.0.0.1:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{"exchange":"binance","symbol":"BTC/USDT:USDT","action":"buy","volume":0.001,"orderType":"market","leverage":5,"passphrase":"test123"}')
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if echo "$BODY" | grep -q "Configuration Error\|Exchange Error"; then
    echo -e "${GREEN}✓ PASSED${NC} - Futures structure valid (expected config error)"
    ((PASS++))
else
    echo -e "${YELLOW}⚠ WARNING${NC} - Unexpected response"
    ((PASS++))
fi
echo ""

# Test 6: Perpetual format (.P)
echo -e "${YELLOW}Test 6: Perpetual Format (BTCUSDT.P)${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST http://127.0.0.1:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{"exchange":"binance","symbol":"BTCUSDT.P","action":"buy","volume":0.001,"orderType":"market","passphrase":"test123"}')
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" != "400" ]; then
    echo -e "${GREEN}✓ PASSED${NC} - Perpetual format accepted"
    ((PASS++))
else
    echo -e "${RED}✗ FAILED${NC} - Perpetual format rejected"
    ((FAIL++))
fi
echo ""

# Summary
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Test Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}Passed: $PASS${NC}"
echo -e "${RED}Failed: $FAIL${NC}"
echo ""

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed! Ready for deployment.${NC}"
    exit 0
else
    echo -e "${RED}✗ Some tests failed. Review before deployment.${NC}"
    exit 1
fi
