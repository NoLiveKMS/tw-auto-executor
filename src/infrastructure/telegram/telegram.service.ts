/**
 * Telegram service - уведомления через Telegram Bot API
 */
import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';

import type { DomainError } from '../../types/domain-error.types';
import { telegramError, formatDomainError } from '../../types/domain-error.types';
import type { OrderResult } from '../../types/trade-signal.types';
import type { TelegramConfig } from '../../types/config.types';

/**
 * Telegram service interface
 */
export interface ITelegramService {
  readonly notifySuccess: (order: OrderResult) => TE.TaskEither<DomainError, undefined>;
  readonly notifyError: (error: DomainError) => TE.TaskEither<DomainError, undefined>;
}

/**
 * Форматирует сообщение об успешном исполнении ордера
 */
const formatSuccessMessage = (order: OrderResult): string => {
  const emoji = order.action === 'buy' ? '🟢' : '🔴';
  const statusEmoji = order.status === 'filled' ? '✅' : '⏳';
  
  return `
${emoji} *Order Executed* ${statusEmoji}

*Exchange:* ${order.exchange.toUpperCase()}
*Symbol:* \`${order.symbol}\`
*Action:* ${order.action.toUpperCase()}
*Volume:* ${order.volume}
*Type:* ${order.orderType}
*Price:* ${order.price ? order.price.toFixed(8) : 'Market'}
*Status:* ${order.status}
*Order ID:* \`${order.orderId}\`
*Time:* ${order.executedAt.toISOString()}
  `.trim();
};

/**
 * Форматирует сообщение об ошибке
 */
const formatErrorMessage = (error: DomainError): string => {
  return `
❌ *Order Failed*

${formatDomainError(error)}
  `.trim();
};

/**
 * Отправляет сообщение через Telegram Bot API
 */
const sendTelegramMessage = (
  config: TelegramConfig,
  message: string
): TE.TaskEither<DomainError, undefined> => {
  if (!config.enabled) {
    // Если Telegram не настроен, просто возвращаем успех (silent fail)
    return TE.right(undefined);
  }

  return pipe(
    TE.tryCatch(
      async (): Promise<undefined> => {
        const url = `https://api.telegram.org/bot${config.botToken}/sendMessage`;
        
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chat_id: config.chatId,
            text: message,
            parse_mode: 'Markdown',
          }),
        });

        if (!response.ok) {
          const errorData = await response.text();
          throw new Error(`Telegram API error: ${response.status} - ${errorData}`);
        }

        return undefined;
      },
      (error) => telegramError(
        `Failed to send Telegram notification: ${String(error)}`,
        error
      )
    )
  );
};

/**
 * Создает Telegram Service
 */
export const createTelegramService = (config: TelegramConfig): ITelegramService => ({
  notifySuccess: (order: OrderResult): TE.TaskEither<DomainError, undefined> =>
    sendTelegramMessage(config, formatSuccessMessage(order)),

  notifyError: (error: DomainError): TE.TaskEither<DomainError, undefined> =>
    sendTelegramMessage(config, formatErrorMessage(error)),
});
