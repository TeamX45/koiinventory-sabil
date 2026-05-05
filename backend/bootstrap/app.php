<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        apiPrefix: 'api',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // CSRF tidak berlaku untuk /api/* (Sanctum Bearer token, bukan session cookies)
        $middleware->validateCsrfTokens(except: ['api/*']);
        // Throttle default ke semua /api/*
        $middleware->api(prepend: ['throttle:api']);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Force JSON response untuk semua /api/* atau request yang Accept: application/json
        $exceptions->shouldRenderJsonWhen(function (Request $request) {
            return $request->is('api/*') || $request->expectsJson();
        });
    })->create();
