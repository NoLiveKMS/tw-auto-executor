/**
 * Domain service для валидации торговых сигналов
 */
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';
import { PathReporter } from 'io-ts/PathReporter';

import type { TradeSignal } from '../types/trade-signal.types';
import { TradeSignalCodec } from '../types/trade-signal.types';
import type { DomainError } from '../types/domain-error.types';
import { validationError, authenticationError } from '../types/domain-error.types';

/**
 * Валидирует структуру торгового сигнала через io-ts codec
 */
export const validateSignalStructure = (payload: unknown): E.Either<DomainError, TradeSignal> =>
  pipe(
    TradeSignalCodec.decode(payload),
    E.mapLeft((errors) =>
      validationError(
        `Invalid signal structure: ${PathReporter.report(E.left(errors)).join(', ')}`
      )
    )
  );

/**
 * Проверяет passphrase
 */
export const validatePassphrase = (
  expectedPassphrase: string
) => (
  signal: TradeSignal
): E.Either<DomainError, TradeSignal> =>
  signal.passphrase === expectedPassphrase
    ? E.right(signal)
    : E.left(authenticationError('Invalid passphrase'));

/**
 * Композитная функция валидации: структура + passphrase
 */
export const validateTradeSignal = (
  payload: unknown,
  expectedPassphrase: string
): E.Either<DomainError, TradeSignal> =>
  pipe(
    payload,
    validateSignalStructure,
    E.chain(validatePassphrase(expectedPassphrase))
  );

