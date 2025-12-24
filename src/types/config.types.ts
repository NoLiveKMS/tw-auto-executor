/**
 * Configuration types
 */

/**
 * Конфигурация сервера
 */
export interface ServerConfig {
  readonly port: number;
  readonly host: string;
  readonly nodeEnv: 'development' | 'production' | 'test';
}

/**
 * Учетные данные для биржи
 */
export interface ExchangeCredentials {
  readonly apiKey: string;
  readonly secret: string;
  readonly password?: string;
}

/**
 * Конфигурация биржи
 */
export interface ExchangeConfig {
  readonly credentials: Record<string, ExchangeCredentials>;
  readonly defaultSlippage: number;
  readonly maxRetryAttempts: number;
  readonly orderTimeoutMs: number;
  readonly stopLossOffset: number;
  readonly limitOrderOffset: number;
}

/**
 * Конфигурация Telegram
 */
export interface TelegramConfig {
  readonly botToken: string;
  readonly chatId: string;
  readonly enabled: boolean;
}

/**
 * Конфигурация безопасности
 */
export interface SecurityConfig {
  readonly webhookPassphrase: string;
}

/**
 * Полная конфигурация приложения
 */
export interface AppConfig {
  readonly server: ServerConfig;
  readonly exchange: ExchangeConfig;
  readonly telegram: TelegramConfig;
  readonly security: SecurityConfig;
}
