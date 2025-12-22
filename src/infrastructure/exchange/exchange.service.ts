/**
 * Exchange service - интеграция с биржами через CCXT
 */
import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';
import * as ccxt from 'ccxt';

import type { 
  TradeSignal, 
  OrderResult, 
  ExchangeIdType,
  TradingSymbol,
  OrderType 
} from '../../types/trade-signal.types';
import type { DomainError } from '../../types/domain-error.types';
import { exchangeError, configurationError } from '../../types/domain-error.types';
import type { ExchangeConfig } from '../../types/config.types';

/**
 * Exchange service interface
 */
export interface IExchangeService {
  readonly executeOrder: (signal: TradeSignal) => TE.TaskEither<DomainError, OrderResult>;
}

/**
 * Определяет тип рынка из символа
 */
const detectMarketType = (symbol: TradingSymbol): 'spot' | 'swap' => {
  if (symbol.includes(':') || symbol.includes('.P')) {
    return 'swap';
  }
  return 'spot';
};

/**
 * Создает CCXT exchange instance
 */
const createExchangeInstance = (
  exchangeId: ExchangeIdType,
  config: ExchangeConfig,
  marketType?: 'spot' | 'swap'
): TE.TaskEither<DomainError, ccxt.Exchange> =>
  pipe(
    TE.tryCatch(
      async () => {
        const credentials = config.credentials[exchangeId];
        
        if (!credentials) {
          throw new Error(`No credentials found for exchange: ${exchangeId}`);
        }

        const ExchangeClass = ccxt[exchangeId as keyof typeof ccxt] as typeof ccxt.Exchange;
        
        if (!ExchangeClass) {
          throw new Error(`Unsupported exchange: ${exchangeId}`);
        }

        const exchange = new ExchangeClass({
          apiKey: credentials.apiKey,
          secret: credentials.secret,
          password: credentials.password,
          enableRateLimit: true,
          options: {
            defaultType: marketType || 'spot',
          },
        });

        await exchange.loadMarkets();

        return exchange;
      },
      (error) => {
        if (error instanceof Error && error.message.includes('No credentials')) {
          return configurationError(error.message, `${exchangeId}_API_KEY`);
        }
        return exchangeError(
          exchangeId,
          `Failed to initialize exchange: ${String(error)}`,
          undefined,
          error
        );
      }
    )
  );

/**
 * Устанавливает leverage для futures
 */
const setLeverage = (
  exchange: ccxt.Exchange,
  exchangeId: ExchangeIdType,
  symbol: TradingSymbol,
  leverage: number
): TE.TaskEither<DomainError, undefined> =>
  pipe(
    TE.tryCatch(
      async (): Promise<undefined> => {
        if (exchange.has['setLeverage']) {
          await exchange.setLeverage(leverage, symbol);
        }
        return undefined;
      },
      (error) => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return exchangeError(
          exchangeId,
          `Failed to set leverage: ${errorMessage}`,
          undefined,
          error
        );
      }
    )
  );

/**
 * Исполняет market order (spot или futures)
 */
const executeMarketOrder = (
  exchange: ccxt.Exchange,
  exchangeId: ExchangeIdType,
  signal: TradeSignal
): TE.TaskEither<DomainError, OrderResult> => {
  const leverageTask: TE.TaskEither<DomainError, undefined> = signal.leverage
    ? setLeverage(exchange, exchangeId, signal.symbol, signal.leverage)
    : TE.right(undefined);
  
  return pipe(
    leverageTask,
    TE.chain<DomainError, undefined, OrderResult>(() =>
      TE.tryCatch(
        async () => {
          const order = await exchange.createMarketOrder(
            signal.symbol,
            signal.action,
            signal.volume
          );

          return {
            orderId: order.id,
            exchange: exchangeId,
            symbol: signal.symbol,
            action: signal.action,
            volume: signal.volume,
            orderType: 'market' as OrderType,
            price: order.average ?? null,
            executedAt: new Date(),
            status: order.status === 'closed' ? 'filled' as const : 'partial' as const,
            marketType: signal.marketType,
            leverage: signal.leverage,
            direction: signal.direction,
          };
        },
        (error) => {
          const errorMessage = error instanceof Error ? error.message : String(error);
          const errorCode = (error as ccxt.BaseError).constructor.name;
          
          return exchangeError(
            exchangeId,
            `Market order failed: ${errorMessage}`,
            errorCode,
            error
          );
        }
      )
    )
  );
};

/**
 * Исполняет limit order (spot или futures)
 */
const executeLimitOrder = (
  exchange: ccxt.Exchange,
  exchangeId: ExchangeIdType,
  signal: TradeSignal
): TE.TaskEither<DomainError, OrderResult> => {
  const leverageTask: TE.TaskEither<DomainError, undefined> = signal.leverage
    ? setLeverage(exchange, exchangeId, signal.symbol, signal.leverage)
    : TE.right(undefined);
  
  return pipe(
    leverageTask,
    TE.chain<DomainError, undefined, OrderResult>(() =>
      TE.tryCatch(
        async () => {
          const ticker = await exchange.fetchTicker(signal.symbol);
          const currentPrice = ticker.last ?? ticker.close;

          if (!currentPrice) {
            throw new Error('Could not determine current price');
          }

          const offset = signal.action === 'buy' ? 0.999 : 1.001;
          const limitPrice = currentPrice * offset;

          const order = await exchange.createLimitOrder(
            signal.symbol,
            signal.action,
            signal.volume,
            limitPrice
          );

          return {
            orderId: order.id,
            exchange: exchangeId,
            symbol: signal.symbol,
            action: signal.action,
            volume: signal.volume,
            orderType: 'limit' as OrderType,
            price: limitPrice,
            executedAt: new Date(),
            status: order.status === 'closed' ? 'filled' as const : 'pending' as const,
            marketType: signal.marketType,
            leverage: signal.leverage,
            direction: signal.direction,
          };
        },
        (error) => {
          const errorMessage = error instanceof Error ? error.message : String(error);
          const errorCode = (error as ccxt.BaseError).constructor.name;
          
          return exchangeError(
            exchangeId,
            `Limit order failed: ${errorMessage}`,
            errorCode,
            error
          );
        }
      )
    )
  );
};

/**
 * Создает Exchange Service
 */
export const createExchangeService = (config: ExchangeConfig): IExchangeService => ({
  executeOrder: (signal: TradeSignal): TE.TaskEither<DomainError, OrderResult> => {
    const detectedType = signal.marketType || detectMarketType(signal.symbol);
    const ccxtMarketType = detectedType === 'futures' ? 'swap' : detectedType;
    
    return pipe(
      createExchangeInstance(signal.exchange, config, ccxtMarketType),
      TE.chain((exchange) =>
        signal.orderType === 'market'
          ? executeMarketOrder(exchange, signal.exchange, { ...signal, marketType: detectedType })
          : executeLimitOrder(exchange, signal.exchange, { ...signal, marketType: detectedType })
      )
    );
  },
});
