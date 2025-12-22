#!/bin/bash

# Test webhook endpoint
# Usage: ./scripts/test-webhook.sh <WEBHOOK_URL>

set -e

WEBHOOK_URL="${1}"
STAGE="${2:-prod}"
REGION="${3:-ap-northeast-1}"

if [ -z "$WEBHOOK_URL" ]; then
  echo "❌ Error: Webhook URL is required"
  echo "Usage: ./scripts/test-webhook.sh <WEBHOOK_URL> [stage] [region]"
  echo "Example: ./scripts/test-webhook.sh https://xxx.execute-api.ap-northeast-1.amazonaws.com/webhook"
  exit 1
fi

echo "🧪 Testing TW Auto Executor webhook..."
echo "URL: ${WEBHOOK_URL}"
echo ""

# Get passphrase from SSM
echo "🔑 Fetching passphrase from SSM..."
PASSPHRASE=$(aws ssm get-parameter \
  --name "/tw-executor/${STAGE}/webhook-passphrase" \
  --with-decryption \
  --query "Parameter.Value" \
  --output text \
  --region ${REGION} 2>/dev/null)

if [ -z "$PASSPHRASE" ]; then
  echo "⚠️  Warning: Could not fetch passphrase from SSM"
  echo "Enter passphrase manually:"
  read -s PASSPHRASE
  echo ""
fi

# Test payload
TEST_PAYLOAD=$(cat <<EOF
{
  "exchange": "binance",
  "symbol": "BTC/USDT",
  "action": "buy",
  "orderType": "market",
  "volume": 0.001,
  "passphrase": "${PASSPHRASE}"
}
EOF
)

echo "📤 Sending test request..."
echo ""

RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "${WEBHOOK_URL}" \
  -H "Content-Type: application/json" \
  -d "${TEST_PAYLOAD}")

HTTP_BODY=$(echo "$RESPONSE" | sed -e 's/HTTP_STATUS\:.*//g')
HTTP_STATUS=$(echo "$RESPONSE" | tr -d '\n' | sed -e 's/.*HTTP_STATUS://')

echo "📥 Response:"
echo "${HTTP_BODY}" | jq '.' 2>/dev/null || echo "${HTTP_BODY}"
echo ""

if [ "$HTTP_STATUS" -eq 200 ]; then
  echo "✅ Test passed! HTTP Status: ${HTTP_STATUS}"
  echo "Check your Telegram for notification"
elif [ "$HTTP_STATUS" -eq 400 ]; then
  echo "⚠️  Bad Request (HTTP ${HTTP_STATUS})"
  echo "This might be expected if exchange is not configured or insufficient funds"
elif [ "$HTTP_STATUS" -eq 500 ]; then
  echo "❌ Server Error (HTTP ${HTTP_STATUS})"
  echo "Check CloudWatch logs for details:"
  echo "  serverless logs -f webhookHandler --tail"
else
  echo "❓ Unexpected status: ${HTTP_STATUS}"
fi

exit 0

