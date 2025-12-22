#!/bin/bash

################################################################################
# TW Auto Executor - One-Click Installation Script for Ubuntu VPS
# 
# Устанавливает Node.js 20.x, PM2, клонирует репозиторий и запускает бот
################################################################################

set -e  # Завершить скрипт при любой ошибке

# Цвета для вывода
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Конфигурация
REPO_URL="https://github.com/YOUR_USERNAME/tw-auto-executor.git"
INSTALL_DIR="$HOME/tw-auto-executor"
NODE_VERSION="20"

# Функция для вывода цветных сообщений
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Проверка операционной системы
check_os() {
    log_info "Проверка операционной системы..."
    
    if [[ ! -f /etc/os-release ]]; then
        log_error "Не удалось определить операционную систему"
        exit 1
    fi
    
    . /etc/os-release
    
    if [[ "$ID" != "ubuntu" && "$ID" != "debian" ]]; then
        log_warning "Этот скрипт предназначен для Ubuntu/Debian. Ваша ОС: $ID"
        read -p "Продолжить установку? (y/n): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
    
    log_success "ОС совместима: $PRETTY_NAME"
}

# Установка Node.js 20.x через NodeSource
install_nodejs() {
    log_info "Проверка установки Node.js..."
    
    if command -v node &> /dev/null; then
        NODE_INSTALLED_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
        
        if [[ "$NODE_INSTALLED_VERSION" -ge "$NODE_VERSION" ]]; then
            log_success "Node.js уже установлен: $(node -v)"
            return 0
        else
            log_warning "Установлена старая версия Node.js: $(node -v)"
        fi
    fi
    
    log_info "Установка Node.js ${NODE_VERSION}.x..."
    
    # Добавляем NodeSource репозиторий
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash -
    
    # Устанавливаем Node.js
    sudo apt-get install -y nodejs
    
    log_success "Node.js установлен: $(node -v)"
    log_success "npm установлен: $(npm -v)"
}

# Установка PM2
install_pm2() {
    log_info "Проверка установки PM2..."
    
    if command -v pm2 &> /dev/null; then
        log_success "PM2 уже установлен: $(pm2 -v)"
        return 0
    fi
    
    log_info "Установка PM2..."
    sudo npm install -g pm2
    
    log_success "PM2 установлен: $(pm2 -v)"
    
    # Настройка автозапуска PM2
    log_info "Настройка автозапуска PM2..."
    sudo pm2 startup systemd -u $USER --hp $HOME
    
    log_success "PM2 автозапуск настроен"
}

# Установка дополнительных зависимостей
install_dependencies() {
    log_info "Обновление системы и установка зависимостей..."
    
    sudo apt-get update -y
    sudo apt-get install -y git curl build-essential
    
    log_success "Зависимости установлены"
}

# Клонирование или обновление репозитория
setup_repository() {
    log_info "Настройка репозитория..."
    
    if [[ -d "$INSTALL_DIR" ]]; then
        log_warning "Директория $INSTALL_DIR уже существует"
        read -p "Удалить и клонировать заново? (y/n): " -n 1 -r
        echo
        
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            rm -rf "$INSTALL_DIR"
        else
            log_info "Обновление существующего репозитория..."
            cd "$INSTALL_DIR"
            git pull
            log_success "Репозиторий обновлен"
            return 0
        fi
    fi
    
    log_info "Клонирование репозитория из $REPO_URL..."
    git clone "$REPO_URL" "$INSTALL_DIR"
    
    log_success "Репозиторий клонирован в $INSTALL_DIR"
}

# Настройка .env файла
setup_env() {
    log_info "Настройка .env файла..."
    
    cd "$INSTALL_DIR"
    
    if [[ -f .env ]]; then
        log_warning ".env файл уже существует"
        read -p "Перезаписать? (y/n): " -n 1 -r
        echo
        
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Используется существующий .env файл"
            return 0
        fi
    fi
    
    if [[ ! -f .env.example ]]; then
        log_error ".env.example не найден"
        exit 1
    fi
    
    cp .env.example .env
    
    log_success ".env файл создан"
    log_warning "⚠️  ВАЖНО: Отредактируйте .env файл перед запуском!"
    log_info "Выполните: nano $INSTALL_DIR/.env"
}

# Установка npm зависимостей и сборка
build_project() {
    log_info "Установка npm зависимостей..."
    
    cd "$INSTALL_DIR"
    npm install
    
    log_success "Зависимости установлены"
    
    log_info "Сборка TypeScript проекта..."
    npm run build
    
    log_success "Проект собран"
}

# Создание директории для логов
setup_logs() {
    log_info "Создание директории для логов..."
    
    cd "$INSTALL_DIR"
    mkdir -p logs
    
    log_success "Директория logs создана"
}

# Запуск через PM2
start_service() {
    log_info "Запуск сервиса через PM2..."
    
    cd "$INSTALL_DIR"
    
    # Останавливаем если уже запущен
    pm2 stop tw-auto-executor 2>/dev/null || true
    pm2 delete tw-auto-executor 2>/dev/null || true
    
    # Запускаем
    pm2 start ecosystem.config.js
    
    # Сохраняем конфигурацию PM2
    pm2 save
    
    log_success "Сервис запущен!"
    
    log_info "Статус сервиса:"
    pm2 list
}

# Вывод итоговой информации
print_summary() {
    echo ""
    log_success "================================"
    log_success "  Установка завершена успешно!"
    log_success "================================"
    echo ""
    log_info "📋 Полезные команды:"
    echo ""
    echo "  pm2 status              - Статус процессов"
    echo "  pm2 logs                - Просмотр логов"
    echo "  pm2 restart tw-auto-executor - Перезапуск"
    echo "  pm2 stop tw-auto-executor    - Остановка"
    echo ""
    log_warning "⚠️  НЕ ЗАБУДЬТЕ настроить .env файл:"
    log_info "   nano $INSTALL_DIR/.env"
    echo ""
    log_info "После настройки .env перезапустите сервис:"
    log_info "   pm2 restart tw-auto-executor"
    echo ""
}

# Основная функция
main() {
    echo ""
    log_info "=================================="
    log_info "  TW Auto Executor Installer"
    log_info "=================================="
    echo ""
    
    check_os
    install_dependencies
    install_nodejs
    install_pm2
    setup_repository
    setup_env
    build_project
    setup_logs
    
    log_warning ""
    log_warning "Перед запуском отредактируйте .env файл!"
    read -p "Вы настроили .env файл? (y/n): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        start_service
        print_summary
    else
        log_warning "Пропущен запуск сервиса"
        log_info "После настройки .env выполните:"
        log_info "  cd $INSTALL_DIR"
        log_info "  pm2 start ecosystem.config.js"
        log_info "  pm2 save"
    fi
}

# Запуск установки
main

