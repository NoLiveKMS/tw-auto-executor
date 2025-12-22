/**
 * Application layer - orchestration для исполнения торговых сигналов
 */
import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';

import type { TradeSignal, OrderResult } from '../types/trade-signal.types';
import type { DomainError } from '../types/domain-error.types';
import { validateTradeSignal } from '../domain/validation.service';
import type { IExchangeService } from '../infrastructure/exchange/exchange.service';
import type { ITelegramService } from '../infrastructure/telegram/telegram.service';

/**
 * Trade Executor Service - оркестрирует весь процесс исполнения
 */
export interface ITradeExecutorService {
  readonly execute: (payload: unknown) => TE.TaskEither<DomainError, OrderResult>;
}

/**
 * Создает Trade Executor Service
 */
export const createTradeExecutorService = (
  exchangeService: IExchangeService,
  telegramService: ITelegramService,
  passphrase: string
): ITradeExecutorService => ({
  execute: (payload: unknown): TE.TaskEither<DomainError, OrderResult> =>
    pipe(
      // 1. Валидируем структуру и passphrase
      TE.fromEither(validateTradeSignal(payload, passphrase)),
      
      // 2. Исполняем ордер на бирже
      TE.chain((signal: TradeSignal) => exchangeService.executeOrder(signal)),
      
      // 3. Отправляем уведомление об успехе (игнорируем ошибки отправки)
      TE.tap((result: OrderResult) =>
        pipe(
          telegramService.notifySuccess(result),
          TE.orElse(() => TE.right(undefined))
        )
      ),
      
      // 4. В случае ошибки отправляем уведомление об ошибке
      TE.tapError((error: DomainError) =>
        pipe(
          telegramService.notifyError(error),
          TE.orElse(() => TE.right(undefined))
        )
      )
    ),
});

