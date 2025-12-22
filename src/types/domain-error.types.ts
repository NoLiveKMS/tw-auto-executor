/**
 * Domain error types - union type для всех ошибок системы
 */

/**
 * Ошибка валидации входного сигнала
 */
export interface ValidationError {
  readonly _tag: 'ValidationError';
  readonly message: string;
  readonly field?: string;
  readonly value?: unknown;
}

/**
 * Ошибка аутентификации (неверный passphrase)
 */
export interface AuthenticationError {
  readonly _tag: 'AuthenticationError';
  readonly message: string;
}

/**
 * Ошибка при взаимодействии с биржей
 */
export interface ExchangeError {
  readonly _tag: 'ExchangeError';
  readonly exchange: string;
  readonly message: string;
  readonly code?: string;
  readonly originalError?: unknown;
}

/**
 * Ошибка конфигурации (отсутствующие API ключи и т.д.)
 */
export interface ConfigurationError {
  readonly _tag: 'ConfigurationError';
  readonly message: string;
  readonly missingKey?: string;
}

/**
 * Ошибка при отправке Telegram уведомления
 */
export interface TelegramError {
  readonly _tag: 'TelegramError';
  readonly message: string;
  readonly originalError?: unknown;
}

/**
 * Неизвестная/непредвиденная ошибка
 */
export interface UnknownError {
  readonly _tag: 'UnknownError';
  readonly message: string;
  readonly originalError?: unknown;
}

/**
 * Union type для всех доменных ошибок
 */
export type DomainError =
  | ValidationError
  | AuthenticationError
  | ExchangeError
  | ConfigurationError
  | TelegramError
  | UnknownError;

// ============= Constructors =============

export const validationError = (
  message: string,
  field?: string,
  value?: unknown
): ValidationError => ({
  _tag: 'ValidationError',
  message,
  field,
  value,
});

export const authenticationError = (message: string): AuthenticationError => ({
  _tag: 'AuthenticationError',
  message,
});

export const exchangeError = (
  exchange: string,
  message: string,
  code?: string,
  originalError?: unknown
): ExchangeError => ({
  _tag: 'ExchangeError',
  exchange,
  message,
  code,
  originalError,
});

export const configurationError = (
  message: string,
  missingKey?: string
): ConfigurationError => ({
  _tag: 'ConfigurationError',
  message,
  missingKey,
});

export const telegramError = (
  message: string,
  originalError?: unknown
): TelegramError => ({
  _tag: 'TelegramError',
  message,
  originalError,
});

export const unknownError = (
  message: string,
  originalError?: unknown
): UnknownError => ({
  _tag: 'UnknownError',
  message,
  originalError,
});

/**
 * Форматирует доменную ошибку в читаемую строку
 */
export const formatDomainError = (error: DomainError): string => {
  switch (error._tag) {
    case 'ValidationError':
      return `Validation Error: ${error.message}${error.field ? ` (field: ${error.field})` : ''}`;
    case 'AuthenticationError':
      return `Authentication Error: ${error.message}`;
    case 'ExchangeError':
      return `Exchange Error [${error.exchange}]: ${error.message}${error.code ? ` (code: ${error.code})` : ''}`;
    case 'ConfigurationError':
      return `Configuration Error: ${error.message}${error.missingKey ? ` (missing: ${error.missingKey})` : ''}`;
    case 'TelegramError':
      return `Telegram Error: ${error.message}`;
    case 'UnknownError':
      return `Unknown Error: ${error.message}`;
  }
};

