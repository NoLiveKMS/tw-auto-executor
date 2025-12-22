/**
 * Handler layer - Fastify webhook endpoint
 */
import type { FastifyRequest, FastifyReply } from 'fastify';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import type { ITradeExecutorService } from '../application/trade-executor.service';
import { formatDomainError } from '../types/domain-error.types';

/**
 * JSON Schema для валидации webhook payload
 */
export const webhookSchema = {
  body: {
    type: 'object',
    required: ['exchange', 'symbol', 'action', 'volume', 'orderType', 'passphrase'],
    properties: {
      exchange: {
        type: 'string',
        enum: ['binance', 'bybit', 'okx', 'bitget'],
      },
      symbol: {
        type: 'string',
        // Поддержка spot (BTC/USDT), futures (BTC/USDT:USDT) и perpetual (.P)
        pattern: '^([A-Z0-9]+/[A-Z0-9]+(:[A-Z0-9]+)?|[A-Z0-9]+\\.P)$',
      },
      action: {
        type: 'string',
        enum: ['buy', 'sell'],
      },
      volume: {
        type: 'number',
        exclusiveMinimum: 0,
      },
      orderType: {
        type: 'string',
        enum: ['market', 'limit'],
      },
      passphrase: {
        type: 'string',
        minLength: 1,
      },
      // Опциональные поля для futures
      marketType: {
        type: 'string',
        enum: ['spot', 'futures', 'swap'],
      },
      direction: {
        type: 'string',
        enum: ['long', 'short'],
      },
      leverage: {
        type: 'number',
        minimum: 1,
        maximum: 125,
      },
      reduceOnly: {
        type: 'boolean',
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        orderId: { type: 'string' },
        exchange: { type: 'string' },
        symbol: { type: 'string' },
        action: { type: 'string' },
        volume: { type: 'number' },
        orderType: { type: 'string' },
        price: { type: ['number', 'null'] },
        status: { type: 'string' },
        executedAt: { type: 'string' },
      },
    },
    400: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        error: { type: 'string' },
      },
    },
    500: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        error: { type: 'string' },
      },
    },
  },
} as const;

/**
 * Создает webhook handler
 */
export const createWebhookHandler = (tradeExecutor: ITradeExecutorService) =>
  async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const payload = request.body;

    // Исполняем торговый сигнал через TaskEither
    const result = await tradeExecutor.execute(payload)();

    // Обрабатываем результат
    pipe(
      result,
      E.match(
        // Left - ошибка
        (error) => {
          const statusCode = error._tag === 'AuthenticationError' ? 401 : 400;
          return reply.status(statusCode).send({
            success: false,
            error: formatDomainError(error),
          });
        },
        // Right - успех
        (orderResult) => {
          return reply.status(200).send({
            success: true,
            orderId: orderResult.orderId,
            exchange: orderResult.exchange,
            symbol: orderResult.symbol,
            action: orderResult.action,
            volume: orderResult.volume,
            orderType: orderResult.orderType,
            price: orderResult.price,
            status: orderResult.status,
            executedAt: orderResult.executedAt.toISOString(),
          });
        }
      )
    );
  };

/**
 * Health check handler
 */
export const healthCheckHandler = async (
  _request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  return reply.status(200).send({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
};

