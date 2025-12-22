/**
 * Configuration service - загрузка и валидация конфигурации из .env
 */
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';
import * as dotenv from 'dotenv';

import type { AppConfig, ExchangeCredentials } from '../../types/config.types';
import type { DomainError } from '../../types/domain-error.types';
import { configurationError } from '../../types/domain-error.types';

// Загружаем .env при импорте модуля
dotenv.config();

/**
 * Получает обязательную переменную окружения
 */
const getRequiredEnv = (key: string): E.Either<DomainError, string> => {
  const value = process.env[key];
  return value
    ? E.right(value)
    : E.left(configurationError(`Missing required environment variable`, key));
};

/**
 * Получает опциональную переменную окружения с значением по умолчанию
 */
const getOptionalEnv = (key: string, defaultValue: string): string =>
  process.env[key] ?? defaultValue;

/**
 * Парсит число из переменной окружения
 */
const parseNumber = (value: string, defaultValue: number): number => {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? defaultValue : parsed;
};

/**
 * Собирает учетные данные для всех настроенных бирж
 */
const buildExchangeCredentials = (): Record<string, ExchangeCredentials> => {
  const credentials: Record<string, ExchangeCredentials> = {};

  // Binance
  const binanceKey = process.env['BINANCE_API_KEY'];
  const binanceSecret = process.env['BINANCE_SECRET'];
  if (binanceKey && binanceSecret) {
    credentials['binance'] = { apiKey: binanceKey, secret: binanceSecret };
  }

  // Bybit
  const bybitKey = process.env['BYBIT_API_KEY'];
  const bybitSecret = process.env['BYBIT_SECRET'];
  if (bybitKey && bybitSecret) {
    credentials['bybit'] = { apiKey: bybitKey, secret: bybitSecret };
  }

  // OKX
  const okxKey = process.env['OKX_API_KEY'];
  const okxSecret = process.env['OKX_SECRET'];
  const okxPassword = process.env['OKX_PASSWORD'];
  if (okxKey && okxSecret && okxPassword) {
    credentials['okx'] = { apiKey: okxKey, secret: okxSecret, password: okxPassword };
  }

  // Bitget
  const bitgetKey = process.env['BITGET_API_KEY'];
  const bitgetSecret = process.env['BITGET_SECRET'];
  const bitgetPassword = process.env['BITGET_PASSWORD'];
  if (bitgetKey && bitgetSecret) {
    credentials['bitget'] = { 
      apiKey: bitgetKey, 
      secret: bitgetSecret, 
      password: bitgetPassword 
    };
  }

  return credentials;
};

/**
 * Загружает и валидирует полную конфигурацию приложения
 */
export const loadConfig = (): E.Either<DomainError, AppConfig> =>
  pipe(
    getRequiredEnv('WEBHOOK_PASSPHRASE'),
    E.map((passphrase) => {
      const config: AppConfig = {
        server: {
          port: parseNumber(getOptionalEnv('PORT', '3000'), 3000),
          host: getOptionalEnv('HOST', '0.0.0.0'),
          nodeEnv: (getOptionalEnv('NODE_ENV', 'production') as 'production' | 'development' | 'test'),
        },
        exchange: {
          credentials: buildExchangeCredentials(),
          defaultSlippage: parseNumber(getOptionalEnv('DEFAULT_SLIPPAGE', '0.001'), 0.001),
          maxRetryAttempts: parseNumber(getOptionalEnv('MAX_RETRY_ATTEMPTS', '3'), 3),
          orderTimeoutMs: parseNumber(getOptionalEnv('ORDER_TIMEOUT_MS', '30000'), 30000),
        },
        telegram: {
          botToken: getOptionalEnv('TELEGRAM_BOT_TOKEN', ''),
          chatId: getOptionalEnv('TELEGRAM_CHAT_ID', ''),
          enabled: Boolean(process.env['TELEGRAM_BOT_TOKEN'] && process.env['TELEGRAM_CHAT_ID']),
        },
        security: {
          webhookPassphrase: passphrase,
        },
      };
      return config;
    })
  );

/**
 * Singleton instance конфигурации
 */
let configInstance: AppConfig | null = null;

/**
 * Получает конфигурацию (lazy init)
 */
export const getConfig = (): E.Either<DomainError, AppConfig> => {
  if (configInstance) {
    return E.right(configInstance);
  }

  return pipe(
    loadConfig(),
    E.map((config) => {
      configInstance = config;
      return config;
    })
  );
};
