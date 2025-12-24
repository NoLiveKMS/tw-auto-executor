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
 * Создает стоп-лосс ордер после успешного входа в позицию
 */
const createStopLossOrder = (
  exchange: ccxt.Exchange,
  exchangeId: ExchangeIdType,
  result: OrderResult,
  stopLossOffset: number
): TE.TaskEither<DomainError, undefined> => {
  // Если стоп-лосс отключен (offset = 0) или цена не определена - пропускаем
  if (stopLossOffset === 0 || !result.price) {
    return TE.right(undefined);
  }

  return pipe(
    TE.tryCatch(
      async (): Promise<undefined> => {
        const entryPrice = result.price;
        
        // Проверка что цена определена
        if (entryPrice === null) {
          throw new Error('Entry price is null, cannot set stop-loss');
        }
        
        // Определяем направление позиции
        // Для spot: buy = long, sell = short
        // Для futures: используем поле direction если есть
        const isLongPosition = result.direction === 'long' || 
                               (!result.direction && result.action === 'buy');
        
        // Рассчитываем цену стоп-лосса
        // Long: стоп ниже цены входа
        // Short: стоп выше цены входа
        const stopPrice = isLongPosition
          ? entryPrice * (1 - stopLossOffset)
          : entryPrice * (1 + stopLossOffset);
        
        // Обратное действие для стопа (если купили - продаем, если продали - покупаем)
        const stopAction = result.action === 'buy' ? 'sell' : 'buy';
        
        // Создаем стоп-ордер
        // Используем createOrder с типом 'stop' или 'stop_market' в зависимости от биржи
        if (exchange.has['createStopOrder']) {
          await exchange.createOrder(
            result.symbol,
            'stop',
            stopAction,
            result.volume,
            undefined,
            {
              stopPrice: stopPrice,
              reduceOnly: true, // Только для закрытия позиции
            }
          );
        } else if (exchange.has['createOrder']) {
          // Fallback: пробуем создать через обычный createOrder с параметрами стопа
          await exchange.createOrder(
            result.symbol,
            'stop_market',
            stopAction,
            result.volume,
            undefined,
            {
              stopPrice: stopPrice,
              reduceOnly: true,
            }
          );
        }
        
        return undefined;
      },
      (error) => {
        // Ошибки стоп-лосса не должны прерывать основной поток
        // Логируем, но возвращаем успех
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn(`Failed to set stop-loss for ${result.symbol}: ${errorMessage}`);
        return exchangeError(
          exchangeId,
          `Stop-loss order failed (non-critical): ${errorMessage}`,
          undefined,
          error
        );
      }
    ),
    // Игнорируем ошибки стоп-лосса - они не критичны
    TE.orElse(() => TE.right(undefined))
  );
};

/**
 * Рассчитывает объем в базовой валюте с учетом volumeUSDT
 * Если volumeUSDT указан, он имеет приоритет над volume
 */
const calculateVolume = (
  exchange: ccxt.Exchange,
  signal: TradeSignal,
  priceForCalculation: number
): number => {
  // Приоритет у volumeUSDT
  if (signal.volumeUSDT !== undefined) {
    const calculatedVolume = signal.volumeUSDT / priceForCalculation;
    return parseFloat(exchange.amountToPrecision(signal.symbol, calculatedVolume));
  }
  
  // Используем volume, если volumeUSDT не указан
  if (signal.volume !== undefined) {
    return parseFloat(exchange.amountToPrecision(signal.symbol, signal.volume));
  }
  
  throw new Error('Neither volume nor volumeUSDT specified');
};

/**
 * Исполняет market order (spot или futures)
 */
const executeMarketOrder = (
  exchange: ccxt.Exchange,
  exchangeId: ExchangeIdType,
  signal: TradeSignal,
  config: ExchangeConfig
): TE.TaskEither<DomainError, OrderResult> => {
  const leverageTask: TE.TaskEither<DomainError, undefined> = signal.leverage
    ? setLeverage(exchange, exchangeId, signal.symbol, signal.leverage)
    : TE.right(undefined);
  
  return pipe(
    leverageTask,
    TE.chain<DomainError, undefined, OrderResult>(() =>
      TE.tryCatch(
        async () => {
          // Если указан volumeUSDT, получаем текущую цену
          let volume: number;
          if (signal.volumeUSDT !== undefined) {
            const ticker = await exchange.fetchTicker(signal.symbol);
            const currentPrice = ticker.last ?? ticker.close;
            
            if (!currentPrice) {
              throw new Error('Could not determine current price for volumeUSDT calculation');
            }
            
            volume = calculateVolume(exchange, signal, currentPrice);
          } else {
            volume = calculateVolume(exchange, signal, 1); // volume уже задан
          }

          const order = await exchange.createMarketOrder(
            signal.symbol,
            signal.action,
            volume
          );

          return {
            orderId: order.id,
            exchange: exchangeId,
            symbol: signal.symbol,
            action: signal.action,
            volume: volume,
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
    ),
    // Автоматически выставляем стоп-лосс после успешного исполнения
    TE.chainFirst((result) => 
      createStopLossOrder(exchange, exchangeId, result, config.stopLossOffset)
    )
  );
};

/**
 * Исполняет limit order (spot или futures)
 */
const executeLimitOrder = (
  exchange: ccxt.Exchange,
  exchangeId: ExchangeIdType,
  signal: TradeSignal,
  config: ExchangeConfig
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

          // Рассчитываем цену лимитного ордера с использованием коэффициента из конфига
          const priceMultiplier = signal.action === 'buy' 
            ? (1 - config.limitOrderOffset) 
            : (1 + config.limitOrderOffset);
          const limitPrice = currentPrice * priceMultiplier;

          // Рассчитываем объем с учетом лимитной цены
          const volume = calculateVolume(exchange, signal, limitPrice);

          const order = await exchange.createLimitOrder(
            signal.symbol,
            signal.action,
            volume,
            limitPrice
          );

          return {
            orderId: order.id,
            exchange: exchangeId,
            symbol: signal.symbol,
            action: signal.action,
            volume: volume,
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
    ),
    // Автоматически выставляем стоп-лосс после успешного исполнения
    TE.chainFirst((result) => 
      createStopLossOrder(exchange, exchangeId, result, config.stopLossOffset)
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
          ? executeMarketOrder(exchange, signal.exchange, { ...signal, marketType: detectedType }, config)
          : executeLimitOrder(exchange, signal.exchange, { ...signal, marketType: detectedType }, config)
      )
    );
  },
});
