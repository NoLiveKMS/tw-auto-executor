/**
 * PM2 Ecosystem Configuration
 * Оптимизировано для сервера с 512 MB RAM
 * Используется для управления процессами в production
 */
module.exports = {
  apps: [
    {
      name: 'tw-auto-executor',
      script: './dist/index.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '400M',  // Оптимизировано для 512 MB RAM
      node_args: '--max-old-space-size=384',  // Ограничение heap для Node.js
      env: {
        NODE_ENV: 'production',
      },
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true,
      merge_logs: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 4000,
    },
  ],
};

