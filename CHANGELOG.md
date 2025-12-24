# Changelog

All notable changes to TW Auto Executor will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2024-12-24

### Added
- **Настраиваемый отступ лимитных ордеров** - новая переменная окружения `LIMIT_ORDER_OFFSET` для гибкой настройки отступа цены лимитных ордеров (по умолчанию 0.001 = 0.1%)
- **Автоматический стоп-лосс** - новая переменная окружения `STOP_LOSS_OFFSET` для автоматического выставления защитных стоп-ордеров после входа в позицию (по умолчанию 0 = отключено)
- Поддержка коэффициентов вместо процентов для упрощения расчетов (например, 0.02 = 2%)
- Автоматическое определение направления позиции (Long/Short) для корректного размещения стопов

### Changed
- Рефакторинг `executeLimitOrder` - замена жестко заданных значений на параметры из конфигурации
- Обновлен интерфейс `ExchangeConfig` с новыми полями `stopLossOffset` и `limitOrderOffset`
- Улучшена обработка ошибок стоп-лосса (non-critical, не прерывают основной поток)

### Fixed
- Исправлена проблема с TypeScript null check в функции `createStopLossOrder`
- Исправлена ESLint ошибка floating promise в webhook handler

### Documentation
- Добавлены примеры использования новых переменных в `example.env` и `env.example`
- Детальные комментарии для понимания формата коэффициентов

## [1.1.0] - Previous Release

### Added
- Поддержка volumeUSDT для торговли
- Поддержка нескольких бирж (Binance, Bybit, OKX, Bitget)
- Интеграция с Telegram для уведомлений
- Функциональное программирование с fp-ts

## [1.0.0] - Initial Release

### Added
- Базовая функциональность исполнения торговых сигналов
- Поддержка market и limit ордеров
- Интеграция с TradingView через webhooks

