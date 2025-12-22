#!/bin/bash

# Setup AWS SSM Parameters for TW Auto Executor
# Usage: ./scripts/setup-ssm.sh

set -e

STAGE="${1:-prod}"
REGION="${2:-ap-northeast-1}"

echo "🔧 Setting up SSM parameters for stage: ${STAGE} in region: ${REGION}"
echo ""

# Function to prompt for input
prompt_for_value() {
  local param_name=$1
  local param_description=$2
  local is_secret=$3
  
  echo "Enter ${param_description}:"
  if [ "$is_secret" = "true" ]; then
    read -s value
    echo ""
  else
    read value
  fi
  
  echo "$value"
}

# Binance
echo "📊 Binance Configuration"
BINANCE_API_KEY=$(prompt_for_value "binance-api-key" "Binance API Key" "false")
BINANCE_API_SECRET=$(prompt_for_value "binance-api-secret" "Binance API Secret" "true")

# Bybit
echo ""
echo "📊 Bybit Configuration"
BYBIT_API_KEY=$(prompt_for_value "bybit-api-key" "Bybit API Key" "false")
BYBIT_API_SECRET=$(prompt_for_value "bybit-api-secret" "Bybit API Secret" "true")

# Telegram
echo ""
echo "💬 Telegram Configuration"
TELEGRAM_BOT_TOKEN=$(prompt_for_value "telegram-bot-token" "Telegram Bot Token" "true")
TELEGRAM_CHAT_ID=$(prompt_for_value "telegram-chat-id" "Telegram Chat ID" "false")

# Webhook Passphrase
echo ""
echo "🔒 Webhook Security"
echo "Generate random passphrase? (y/n)"
read generate_passphrase
if [ "$generate_passphrase" = "y" ]; then
  WEBHOOK_PASSPHRASE=$(openssl rand -base64 32)
  echo "Generated passphrase: ${WEBHOOK_PASSPHRASE}"
else
  WEBHOOK_PASSPHRASE=$(prompt_for_value "webhook-passphrase" "Webhook Passphrase" "true")
fi

echo ""
echo "📤 Creating SSM parameters..."

# Create Binance parameters
aws ssm put-parameter \
  --name "/tw-executor/${STAGE}/binance-api-key" \
  --value "${BINANCE_API_KEY}" \
  --type "SecureString" \
  --region ${REGION} \
  --overwrite || echo "⚠️  Failed to create binance-api-key"

aws ssm put-parameter \
  --name "/tw-executor/${STAGE}/binance-api-secret" \
  --value "${BINANCE_API_SECRET}" \
  --type "SecureString" \
  --region ${REGION} \
  --overwrite || echo "⚠️  Failed to create binance-api-secret"

# Create Bybit parameters
aws ssm put-parameter \
  --name "/tw-executor/${STAGE}/bybit-api-key" \
  --value "${BYBIT_API_KEY}" \
  --type "SecureString" \
  --region ${REGION} \
  --overwrite || echo "⚠️  Failed to create bybit-api-key"

aws ssm put-parameter \
  --name "/tw-executor/${STAGE}/bybit-api-secret" \
  --value "${BYBIT_API_SECRET}" \
  --type "SecureString" \
  --region ${REGION} \
  --overwrite || echo "⚠️  Failed to create bybit-api-secret"

# Create Telegram parameters
aws ssm put-parameter \
  --name "/tw-executor/${STAGE}/telegram-bot-token" \
  --value "${TELEGRAM_BOT_TOKEN}" \
  --type "SecureString" \
  --region ${REGION} \
  --overwrite || echo "⚠️  Failed to create telegram-bot-token"

aws ssm put-parameter \
  --name "/tw-executor/${STAGE}/telegram-chat-id" \
  --value "${TELEGRAM_CHAT_ID}" \
  --type "SecureString" \
  --region ${REGION} \
  --overwrite || echo "⚠️  Failed to create telegram-chat-id"

# Create Webhook passphrase
aws ssm put-parameter \
  --name "/tw-executor/${STAGE}/webhook-passphrase" \
  --value "${WEBHOOK_PASSPHRASE}" \
  --type "SecureString" \
  --region ${REGION} \
  --overwrite || echo "⚠️  Failed to create webhook-passphrase"

echo ""
echo "✅ All SSM parameters created successfully!"
echo ""
echo "📋 Summary:"
echo "  Stage: ${STAGE}"
echo "  Region: ${REGION}"
echo "  Parameters created: 7"
echo ""
echo "🔐 Your webhook passphrase:"
echo "  ${WEBHOOK_PASSPHRASE}"
echo ""
echo "⚠️  Save this passphrase! You'll need it for TradingView alerts."

