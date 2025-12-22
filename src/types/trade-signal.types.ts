/**
 * Domain types для торговых сигналов TradingView
 */
import * as t from 'io-ts';
import * as E from 'fp-ts/Either';

// ============= Branded Types =============

/**
 * Брендированный тип для Exchange ID
 */
export interface ExchangeIdBrand {
  readonly ExchangeId: unique symbol;
}
export type ExchangeId = string & ExchangeIdBrand;

/**
 * Брендированный тип для Trading Symbol
 */
export interface TradingSymbolBrand {
  readonly TradingSymbol: unique symbol;
}
export type TradingSymbol = string & TradingSymbolBrand;

/**
 * Брендированный тип для Passphrase
 */
export interface PassphraseBrand {
  readonly Passphrase: unique symbol;
}
export type Passphrase = string & PassphraseBrand;

/**
 * Брендированный тип для Volume (положительное число)
 */
export interface VolumeBrand {
  readonly Volume: unique symbol;
}
export type Volume = number & VolumeBrand;

// ============= Runtime Codecs =============

/**
 * Поддерживаемые биржи
 */
export const ExchangeIdCodec = t.union([
  t.literal('binance'),
  t.literal('bybit'),
  t.literal('okx'),
  t.literal('bitget'),
]);

/**
 * Типы ордеров
 */
export const OrderTypeCodec = t.union([
  t.literal('market'),
  t.literal('limit'),
]);

/**
 * Типы рынков
 */
export const MarketTypeCodec = t.union([
  t.literal('spot'),
  t.literal('futures'),
  t.literal('swap'), // perpetual futures
]);

/**
 * Направление (для futures)
 */
export const DirectionCodec = t.union([
  t.literal('long'),
  t.literal('short'),
]);

/**
 * Действия (buy/sell)
 */
export const TradeActionCodec = t.union([
  t.literal('buy'),
  t.literal('sell'),
]);

/**
 * Кодек для TradingSymbol (формат: BTC/USDT или BTC/USDT:USDT для futures)
 */
export const TradingSymbolCodec = new t.Type<TradingSymbol, string, unknown>(
  'TradingSymbol',
  (input): input is TradingSymbol => {
    if (typeof input !== 'string') return false;
    // Spot: BTC/USDT
    // Futures: BTC/USDT:USDT или BTCUSDT.P
    return /^[A-Z0-9]+\/[A-Z0-9]+(:[A-Z0-9]+)?$/.test(input) || /^[A-Z0-9]+\.P$/.test(input);
  },
  (input, context) => {
    if (typeof input !== 'string') {
      return t.failure(input, context, 'Expected string');
    }
    
    // Поддерживаем разные форматы
    const isSpot = /^[A-Z0-9]+\/[A-Z0-9]+$/.test(input);
    const isFutures = /^[A-Z0-9]+\/[A-Z0-9]+:[A-Z0-9]+$/.test(input);
    const isPerpetual = /^[A-Z0-9]+\.P$/.test(input);
    
    if (!isSpot && !isFutures && !isPerpetual) {
      return t.failure(
        input, 
        context, 
        'Invalid symbol format (expected BTC/USDT, BTC/USDT:USDT, or BTCUSDT.P)'
      );
    }
    
    // Нормализуем BTCUSDT.P -> BTC/USDT:USDT
    let normalized = input;
    if (isPerpetual) {
      const base = input.replace(/USDT\.P$/, '');
      normalized = `${base}/USDT:USDT`;
    }
    
    return t.success(normalized as TradingSymbol);
  },
  (a) => a
);

/**
 * Кодек для Volume (положительное число)
 */
export const VolumeCodec = new t.Type<Volume, number, unknown>(
  'Volume',
  (input): input is Volume => typeof input === 'number' && input > 0,
  (input, context) => {
    if (typeof input !== 'number') {
      return t.failure(input, context, 'Expected number');
    }
    if (input <= 0) {
      return t.failure(input, context, 'Volume must be positive');
    }
    return t.success(input as Volume);
  },
  (a) => a
);

/**
 * Кодек для Passphrase (непустая строка)
 */
export const PassphraseCodec = new t.Type<Passphrase, string, unknown>(
  'Passphrase',
  (input): input is Passphrase => typeof input === 'string' && input.length > 0,
  (input, context) => {
    if (typeof input !== 'string') {
      return t.failure(input, context, 'Expected string');
    }
    if (input.length === 0) {
      return t.failure(input, context, 'Passphrase cannot be empty');
    }
    return t.success(input as Passphrase);
  },
  (a) => a
);

/**
 * Основной кодек для TradeSignal (с опциональными futures полями)
 */
export const TradeSignalCodec = t.intersection([
  t.type({
    exchange: ExchangeIdCodec,
    symbol: TradingSymbolCodec,
    action: TradeActionCodec,
    orderType: OrderTypeCodec,
    passphrase: PassphraseCodec,
  }),
  t.partial({
    volume: VolumeCodec,               // объем в монетах (опциональный)
    volumeUSDT: t.number,              // объем в USDT (опциональный)
    marketType: MarketTypeCodec,       // spot или futures (auto-detect если не указано)
    direction: DirectionCodec,         // long или short (для futures)
    leverage: t.number,                // кредитное плечо (для futures)
    reduceOnly: t.boolean,             // только закрытие позиции (для futures)
  }),
]);

/**
 * Рефайнмент: должен быть указан либо volume, либо volumeUSDT
 * volumeUSDT имеет приоритет над volume
 */
export const TradeSignalWithVolumeCodec = new t.Type<TradeSignal, TradeSignal, unknown>(
  'TradeSignalWithVolume',
  (input): input is TradeSignal => {
    if (!TradeSignalCodec.is(input)) return false;
    return !!(input.volume || input.volumeUSDT);
  },
  (input, context) => {
    const baseValidation = TradeSignalCodec.decode(input);
    if (E.isLeft(baseValidation)) {
      return baseValidation;
    }
    const signal = baseValidation.right;
    if (!signal.volume && !signal.volumeUSDT) {
      return t.failure(
        input,
        context,
        'Either volume or volumeUSDT must be specified'
      );
    }
    if (signal.volumeUSDT !== undefined && signal.volumeUSDT <= 0) {
      return t.failure(
        input,
        context,
        'volumeUSDT must be positive'
      );
    }
    return t.success(signal);
  },
  t.identity
);

// ============= Static Types =============

export type ExchangeIdType = t.TypeOf<typeof ExchangeIdCodec>;
export type OrderType = t.TypeOf<typeof OrderTypeCodec>;
export type TradeAction = t.TypeOf<typeof TradeActionCodec>;
export type MarketType = t.TypeOf<typeof MarketTypeCodec>;
export type Direction = t.TypeOf<typeof DirectionCodec>;
export type TradeSignal = t.TypeOf<typeof TradeSignalCodec>;

/**
 * Результат исполнения ордера
 */
export interface OrderResult {
  readonly orderId: string;
  readonly exchange: ExchangeIdType;
  readonly symbol: TradingSymbol;
  readonly action: TradeAction;
  readonly volume: number;  // Фактический объем исполнения
  readonly orderType: OrderType;
  readonly price: number | null;
  readonly executedAt: Date;
  readonly status: 'filled' | 'partial' | 'pending';
  readonly marketType?: MarketType;
  readonly leverage?: number;
  readonly direction?: Direction;
}
