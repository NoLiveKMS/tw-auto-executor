# 🚀 Руководство по развертыванию

## Быстрый старт (Ubuntu VPS)

### Автоматическая установка

```bash
curl -sSL https://raw.githubusercontent.com/YOUR_USERNAME/tw-auto-executor/main/install.sh | bash
```

### Ручная установка

1. **Установите Node.js 20.x**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

2. **Установите PM2**
```bash
sudo npm install -g pm2
```

3. **Клонируйте репозиторий**
```bash
cd ~
git clone https://github.com/YOUR_USERNAME/tw-auto-executor.git
cd tw-auto-executor
```

4. **Установите зависимости**
```bash
npm install
```

5. **Настройте .env файл**
```bash
cp .env.example .env
nano .env
```

Заполните необходимые параметры:
- `WEBHOOK_PASSPHRASE` - секретный пароль для TradingView
- `BINANCE_API_KEY` и `BINANCE_SECRET` - ключи Binance API
- `TELEGRAM_BOT_TOKEN` и `TELEGRAM_CHAT_ID` - для уведомлений

6. **Соберите проект**
```bash
npm run build
```

7. **Запустите с PM2**
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## 🔧 Настройка TradingView

1. Откройте ваш график в TradingView
2. Создайте Alert
3. В поле "Webhook URL" укажите:
```
http://YOUR_VPS_IP:3000/webhook
```

4. В Message укажите JSON:
```json
{
  "exchange": "binance",
  "symbol": "BTC/USDT",
  "action": "{{strategy.order.action}}",
  "volume": 0.001,
  "orderType": "market",
  "passphrase": "YOUR_WEBHOOK_PASSPHRASE"
}
```

## 🎯 Настройка API ключей бирж

### Binance

1. Войдите в Binance → API Management
2. Создайте новый API ключ
3. Включите права:
   - ✅ Enable Spot & Margin Trading
   - ❌ Enable Withdrawals (не требуется)
4. Добавьте IP whitelist (рекомендуется)
5. Скопируйте API Key и Secret в `.env`

### Bybit

1. Войдите в Bybit → API Management
2. Создайте System-generated API
3. Права:
   - ✅ Contract - Trade
   - ✅ Spot - Trade
4. Скопируйте ключи в `.env`

### OKX

1. Войдите в OKX → API
2. Создайте API ключ
3. Права: Trade
4. Установите API Passphrase
5. Добавьте все три значения в `.env`

## 📱 Настройка Telegram уведомлений

1. Создайте бота через [@BotFather](https://t.me/botfather)
2. Получите токен бота
3. Найдите ваш Chat ID через [@userinfobot](https://t.me/userinfobot)
4. Добавьте значения в `.env`:
```env
TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
TELEGRAM_CHAT_ID=123456789
```

## 🐳 Развертывание через Docker (опционально)

Создайте `Dockerfile`:

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

Соберите и запустите:

```bash
docker build -t tw-auto-executor .
docker run -d --name tw-executor --restart always \
  --env-file .env \
  -p 3000:3000 \
  tw-auto-executor
```

## 🔐 Безопасность

### Обязательные меры

1. **Используйте сильный WEBHOOK_PASSPHRASE**
```bash
openssl rand -base64 32
```

2. **Настройте UFW firewall**
```bash
sudo ufw allow 22/tcp
sudo ufw allow 3000/tcp
sudo ufw enable
```

3. **Используйте HTTPS с Nginx**
```bash
sudo apt install nginx certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

Пример конфига Nginx:
```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

4. **IP Whitelist на бирже**
   - Добавьте IP вашего VPS в whitelist API ключей

5. **Ограничьте права API ключей**
   - Только Trading (без Withdrawal)

## 📊 Мониторинг

### Проверка логов
```bash
pm2 logs tw-auto-executor
```

### Статус процесса
```bash
pm2 status
```

### Мониторинг в реальном времени
```bash
pm2 monit
```

### Health check
```bash
curl http://localhost:3000/health
```

Ожидаемый ответ:
```json
{
  "status": "ok",
  "timestamp": "2024-12-22T10:30:00.000Z",
  "uptime": 12345.67
}
```

## 🔄 Обновление

```bash
cd ~/tw-auto-executor
git pull
npm install
npm run build
pm2 restart tw-auto-executor
```

## 🆘 Устранение неполадок

### Проблема: Ошибка "Invalid passphrase"

**Решение**: Проверьте, что `passphrase` в TradingView webhook совпадает с `WEBHOOK_PASSPHRASE` в `.env`

### Проблема: Ошибка "No credentials found for exchange"

**Решение**: Убедитесь, что API ключи правильно настроены в `.env` файле

### Проблема: Telegram уведомления не приходят

**Решение**: 
1. Проверьте корректность токена и chat ID
2. Убедитесь, что отправили `/start` боту
3. Проверьте логи: `pm2 logs`

### Проблема: Сервис не запускается

**Решение**:
```bash
# Проверьте конфигурацию
node -c dist/index.js

# Проверьте порт
sudo netstat -tulpn | grep 3000

# Проверьте права доступа
ls -la dist/

# Перезапустите PM2
pm2 delete all
pm2 start ecosystem.config.js
```

## 📈 Производительность

### Рекомендуемые характеристики VPS

- **CPU**: 1 vCore
- **RAM**: 1 GB
- **Storage**: 10 GB SSD
- **Регион**: Токио (минимальная латентность к биржам)

### Провайдеры VPS

- **Vultr** (Токио) - от $6/месяц
- **DigitalOcean** (Сингапур) - от $6/месяц
- **AWS Lightsail** (Токио) - от $5/месяц
- **Contabo** (Сингапур) - от €5/месяц

## 🔗 Полезные ссылки

- [Binance API Documentation](https://binance-docs.github.io/apidocs/spot/en/)
- [Bybit API Documentation](https://bybit-exchange.github.io/docs/v5/intro)
- [TradingView Webhooks](https://www.tradingview.com/support/solutions/43000529348-about-webhooks/)
- [PM2 Documentation](https://pm2.keymetrics.io/docs/usage/quick-start/)

## 📝 Лицензия

MIT License - см. LICENSE файл

