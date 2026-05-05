FROM php:8.4-fpm-alpine

RUN apk add --no-cache \
    bash \
    git \
    curl \
    icu-dev \
    libzip-dev \
    libpng-dev \
    libjpeg-turbo-dev \
    freetype-dev \
    oniguruma-dev \
    autoconf \
    g++ \
    make \
    mysql-client \
    nodejs \
    npm

RUN docker-php-ext-configure gd --with-freetype --with-jpeg && \
    docker-php-ext-install -j$(nproc) \
        pdo_mysql \
        mbstring \
        bcmath \
        intl \
        zip \
        gd \
        opcache \
        pcntl \
        exif

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

RUN addgroup -g 1000 dev && adduser -D -u 1000 -G dev dev

WORKDIR /var/www/html

USER dev

EXPOSE 9000
CMD ["php-fpm"]
