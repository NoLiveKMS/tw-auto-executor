# Руководство по деплою TW Auto Executor на AWS

## Шаг 1: Подготовка AWS Account

### 1.1 Установка AWS CLI

```bash
# macOS
brew install awscli

# Linux
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Windows
# Скачайте установщик с https://aws.amazon.com/cli/
```

### 1.2 Настройка AWS Credentials

```bash
aws configure
```

Введите:
- AWS Access Key ID
- AWS Secret Access Key
- Default region: `ap-northeast-1` (Токио для минимального пинга)
- Default output format: `json`

### 1.3 Проверка доступа

```bash
aws sts get-caller-identity
```

## Шаг 2: Получение API ключей

### 2.1 Binance API Keys

1. Войдите на https://www.binance.com
2. Перейдите в Account → API Management
3. Создайте новый API ключ
4. **Важно**: Включите только "Enable Spot & Margin Trading"
5. Настройте IP whitelist (рекомендуется)
6. Сохраните API Key и Secret Key

### 2.2 Bybit API Keys

1. Войдите на https://www.bybit.com
2. Перейдите в Account & Security → API
3. Создайте новый API ключ
4. Разрешения: "Contract Trade" или "Spot Trade"
5. Сохраните API Key и Secret Key

### 2.3 Telegram Bot

1. Найдите @BotFather в Telegram
2. Отправьте команду `/newbot`
3. Следуйте инструкциям для создания бота
4. Сохраните Bot Token (например: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

5. Получите Chat ID:
   - Найдите @userinfobot в Telegram
   - Отправьте ему любое сообщение
   - Бот вернет ваш Chat ID (например: `123456789`)

## Шаг 3: Создание параметров в AWS SSM

### 3.1 Автоматическое создание (скрипт)

Создайте файл `setup-ssm.sh`:

```bash
#!/bin/bash

STAGE="prod"
REGION="ap-northeast-1"

# Binance
aws ssm put-parameter \
  --name "/tw-executor/${STAGE}/binance-api-key" \
  --value "YOUR_BINANCE_API_KEY" \
  --type "SecureString" \
  --region ${REGION}

aws ssm put-parameter \
  --name "/tw-executor/${STAGE}/binance-api-secret" \
  --value "YOUR_BINANCE_SECRET_KEY" \
  --type "SecureString" \
  --region ${REGION}

# Bybit
aws ssm put-parameter \
  --name "/tw-executor/${STAGE}/bybit-api-key" \
  --value "YOUR_BYBIT_API_KEY" \
  --type "SecureString" \
  --region ${REGION}

aws ssm put-parameter \
  --name "/tw-executor/${STAGE}/bybit-api-secret" \
  --value "YOUR_BYBIT_SECRET_KEY" \
  --type "SecureString" \
  --region ${REGION}

# Telegram
aws ssm put-parameter \
  --name "/tw-executor/${STAGE}/telegram-bot-token" \
  --value "YOUR_TELEGRAM_BOT_TOKEN" \
  --type "SecureString" \
  --region ${REGION}

aws ssm put-parameter \
  --name "/tw-executor/${STAGE}/telegram-chat-id" \
  --value "YOUR_TELEGRAM_CHAT_ID" \
  --type "SecureString" \
  --region ${REGION}

# Webhook Security
aws ssm put-parameter \
  --name "/tw-executor/${STAGE}/webhook-passphrase" \
  --value "$(openssl rand -base64 32)" \
  --type "SecureString" \
  --region ${REGION}

echo "✅ All SSM parameters created successfully!"
```

Запустите:

```bash
chmod +x setup-ssm.sh
./setup-ssm.sh
```

### 3.2 Ручное создание через AWS Console

1. Откройте https://console.aws.amazon.com/systems-manager/
2. Перейдите в "Parameter Store"
3. Нажмите "Create parameter"
4. Для каждого параметра:
   - Name: `/tw-executor/prod/binance-api-key`
   - Type: `SecureString`
   - Value: Ваш API ключ
   - Нажмите "Create parameter"

## Шаг 4: Установка Serverless Framework

```bash
npm install -g serverless

# Проверка установки
serverless --version
```

## Шаг 5: Установка зависимостей проекта

```bash
cd TWAutoBotPy
npm install
```

## Шаг 6: Деплой на AWS

### 6.1 Сборка TypeScript

```bash
npm run build
```

### 6.2 Деплой в production

```bash
npm run deploy

# Или с явным указанием stage и региона
serverless deploy --stage prod --region ap-northeast-1
```

Процесс деплоя займет 2-3 минуты. Вы увидите:

```
✔ Service deployed to stack tw-auto-executor-prod

endpoints:
  POST - https://xxxxxxxxxx.execute-api.ap-northeast-1.amazonaws.com/webhook
  GET - https://xxxxxxxxxx.execute-api.ap-northeast-1.amazonaws.com/health

functions:
  webhookHandler: tw-auto-executor-prod-webhookHandler
  healthCheck: tw-auto-executor-prod-healthCheck
```

**Важно**: Сохраните Webhook URL!

## Шаг 7: Проверка работоспособности

### 7.1 Health Check

```bash
curl https://YOUR_API_URL/health
```

Должен вернуть:

```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "service": "tw-auto-executor"
}
```

### 7.2 Тестовый webhook

Получите passphrase:

```bash
aws ssm get-parameter \
  --name "/tw-executor/prod/webhook-passphrase" \
  --with-decryption \
  --query "Parameter.Value" \
  --output text
```

Отправьте тестовый запрос:

```bash
curl -X POST https://YOUR_API_URL/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "exchange": "binance",
    "symbol": "BTC/USDT",
    "action": "buy",
    "orderType": "market",
    "volume": 0.001,
    "passphrase": "YOUR_PASSPHRASE"
  }'
```

### 7.3 Проверка Telegram

Вы должны получить уведомление в Telegram о результате ордера.

## Шаг 8: Настройка TradingView

1. Откройте TradingView → ваш график
2. Добавьте индикатор/стратегию
3. Создайте Alert:
   - Condition: ваше условие
   - Options → Webhook URL: `https://YOUR_API_URL/webhook`
   - Message:

```json
{
  "exchange": "binance",
  "symbol": "{{ticker}}",
  "action": "buy",
  "orderType": "market",
  "volume": 0.01,
  "passphrase": "YOUR_PASSPHRASE"
}
```

4. Нажмите "Create"

## Шаг 9: Мониторинг

### 9.1 Просмотр логов в реальном времени

```bash
serverless logs -f webhookHandler --tail
```

### 9.2 CloudWatch Logs

1. Откройте AWS Console → CloudWatch
2. Перейдите в "Log groups"
3. Найдите `/aws/lambda/tw-auto-executor-prod-webhookHandler`

### 9.3 Метрики Lambda

```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=tw-auto-executor-prod-webhookHandler \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-02T00:00:00Z \
  --period 3600 \
  --statistics Sum
```

## Шаг 10: Обновление сервиса

### 10.1 Обновление кода

```bash
# Внесите изменения в код
npm run build
serverless deploy
```

### 10.2 Обновление параметров SSM

```bash
aws ssm put-parameter \
  --name "/tw-executor/prod/binance-api-key" \
  --value "NEW_API_KEY" \
  --type "SecureString" \
  --overwrite
```

## Шаг 11: Удаление сервиса

⚠️ **Внимание**: Это удалит все Lambda функции и API Gateway!

```bash
serverless remove --stage prod
```

Параметры SSM нужно удалить вручную:

```bash
aws ssm delete-parameters \
  --names \
  "/tw-executor/prod/binance-api-key" \
  "/tw-executor/prod/binance-api-secret" \
  "/tw-executor/prod/bybit-api-key" \
  "/tw-executor/prod/bybit-api-secret" \
  "/tw-executor/prod/telegram-bot-token" \
  "/tw-executor/prod/telegram-chat-id" \
  "/tw-executor/prod/webhook-passphrase"
```

## Troubleshooting

### Ошибка: "Unable to import module 'handler'"

```bash
# Пересоберите проект
rm -rf dist node_modules
npm install
npm run build
serverless deploy
```

### Ошибка: "Rate exceeded"

Serverless Framework имеет лимит на количество деплоев. Подождите 1 минуту и повторите.

### Ошибка: "Parameter not found"

Убедитесь, что все параметры созданы в SSM Parameter Store в правильном регионе.

### Lambda timeout

Увеличьте timeout в `serverless.yml`:

```yaml
provider:
  timeout: 60  # 60 секунд
```

## Оптимизация стоимости

### Вариант 1: Free Tier (0-100 сделок/день)

Используйте как есть. Стоимость: **$0/месяц**

### Вариант 2: Regular Usage (100-1000 сделок/день)

Текущая конфигурация. Стоимость: **~$1-2/месяц**

### Вариант 3: High Frequency (> 1000 сделок/день)

Добавьте Provisioned Concurrency:

```yaml
functions:
  webhookHandler:
    provisionedConcurrency: 1
```

Стоимость: **~$10/месяц** (без холодных стартов)

## Безопасность (Best Practices)

1. ✅ Используйте IP whitelist на биржах
2. ✅ Включите 2FA на биржах
3. ✅ Ограничьте права API ключей (только торговля, без вывода)
4. ✅ Регулярно меняйте passphrase
5. ✅ Мониторьте CloudWatch алерты
6. ✅ Установите лимиты на объём сделок в стратегии

## Следующие шаги

- [ ] Настройте CloudWatch алерты на ошибки
- [ ] Добавьте мониторинг метрик (Grafana/Datadog)
- [ ] Настройте автоматическое резервное копирование конфигурации
- [ ] Протестируйте на testnet биржи перед production

---

**Поздравляем! Ваш TradingView Auto Executor запущен на AWS! 🎉**

