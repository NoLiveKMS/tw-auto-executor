/**
 * Fastify server setup
 */
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { getConfig } from './infrastructure/config/config.service';
import { createExchangeService } from './infrastructure/exchange/exchange.service';
import { createTelegramService } from './infrastructure/telegram/telegram.service';
import { createTradeExecutorService } from './application/trade-executor.service';
import { 
  createWebhookHandler, 
  healthCheckHandler, 
  webhookSchema 
} from './handler/webhook.handler';

/**
 * Создает и настраивает Fastify сервер
 */
export const createServer = (): E.Either<string, FastifyInstance> =>
  pipe(
    getConfig(),
    E.mapLeft((error) => `Configuration error: ${error.message}`),
    E.map((config) => {
      // Создаем Fastify instance с логированием
      const fastify = Fastify({
        logger: {
          level: config.server.nodeEnv === 'production' ? 'info' : 'debug',
          transport: config.server.nodeEnv === 'development' 
            ? {
                target: 'pino-pretty',
                options: {
                  translateTime: 'HH:MM:ss Z',
                  ignore: 'pid,hostname',
                },
              }
            : undefined,
        },
      });

      // Создаем сервисы
      const exchangeService = createExchangeService(config.exchange);
      const telegramService = createTelegramService(config.telegram);
      const tradeExecutor = createTradeExecutorService(
        exchangeService,
        telegramService,
        config.security.webhookPassphrase
      );

      // Health check endpoint
      fastify.get('/health', healthCheckHandler);

      // Webhook endpoint для TradingView
      fastify.post('/webhook', {
        schema: webhookSchema,
      }, createWebhookHandler(tradeExecutor));

      // Глобальный error handler
      fastify.setErrorHandler((error, _request, reply) => {
        fastify.log.error(error);
        
        return reply.status(500).send({
          success: false,
          error: 'Internal server error',
        });
      });

      return fastify;
    })
  );

/**
 * Запускает сервер
 */
export const startServer = async (): Promise<void> => {
  const serverResult = createServer();

  if (E.isLeft(serverResult)) {
    // eslint-disable-next-line no-console
    console.error('Failed to create server:', serverResult.left);
    process.exit(1);
  }

  const fastify = serverResult.right;
  
  const configResult = getConfig();
  if (E.isLeft(configResult)) {
    // eslint-disable-next-line no-console
    console.error('Failed to load config:', configResult.left.message);
    process.exit(1);
  }

  const config = configResult.right;

  try {
    await fastify.listen({
      port: config.server.port,
      host: config.server.host,
    });

    fastify.log.info(
      `🚀 TW Auto Executor started on ${config.server.host}:${config.server.port}`
    );
    fastify.log.info(`Environment: ${config.server.nodeEnv}`);
    fastify.log.info(`Telegram notifications: ${config.telegram.enabled ? 'ENABLED' : 'DISABLED'}`);
    fastify.log.info(`Configured exchanges: ${Object.keys(config.exchange.credentials).join(', ')}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

/**
 * Graceful shutdown
 */
const gracefulShutdown = async (fastify: FastifyInstance): Promise<void> => {
  fastify.log.info('Shutting down gracefully...');
  await fastify.close();
  process.exit(0);
};

// Обработка сигналов завершения
process.on('SIGTERM', async () => {
  const serverResult = createServer();
  if (E.isRight(serverResult)) {
    await gracefulShutdown(serverResult.right);
  }
});

process.on('SIGINT', async () => {
  const serverResult = createServer();
  if (E.isRight(serverResult)) {
    await gracefulShutdown(serverResult.right);
  }
});

