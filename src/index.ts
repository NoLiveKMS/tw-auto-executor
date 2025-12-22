/**
 * Entry point - TW Auto Executor
 */
import { startServer } from './server';

// Запуск сервера
startServer().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Fatal error during startup:', error);
  process.exit(1);
});
