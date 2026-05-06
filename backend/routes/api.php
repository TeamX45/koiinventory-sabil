<?php

use App\Http\Controllers\Api\AuditLogController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BatchController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\ExportController;
use App\Http\Controllers\Api\FishTypeController;
use App\Http\Controllers\Api\GradeController;
use App\Http\Controllers\Api\HarvestController;
use App\Http\Controllers\Api\LocationController;
use App\Http\Controllers\Api\MortalityController;
use App\Http\Controllers\Api\PondCategoryController;
use App\Http\Controllers\Api\PondController;
use App\Http\Controllers\Api\PurchaseController;
use App\Http\Controllers\Api\SaleController;
use App\Http\Controllers\Api\SalesChannelController;
use App\Http\Controllers\Api\SortingController;
use App\Http\Controllers\Api\StockMovementController;
use App\Http\Controllers\Api\StockOpnameController;
use App\Http\Controllers\Api\SupplierController;
use App\Http\Controllers\Api\UserController;
use Illuminate\Support\Facades\Route;

// Fallback "login" route untuk fallback redirect Laravel auth (selalu return 401 JSON)
Route::get('/login', fn () => response()->json(['message' => 'Unauthenticated.'], 401))
    ->name('login');

// Public auth routes
Route::prefix('v1')->group(function () {
    Route::post('/auth/login', [AuthController::class, 'login'])
        ->middleware('throttle:login');
});

// Protected routes (require Sanctum token)
Route::prefix('v1')->middleware('auth:sanctum')->group(function () {
    // Auth: me, logout, profile, password
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::patch('/auth/profile', [AuthController::class, 'updateProfile']);
    Route::post('/auth/change-password', [AuthController::class, 'changePassword']);

    // User management (owner only — enforced di gate)
    Route::middleware('can:manage-users')->group(function () {
        Route::apiResource('users', UserController::class);
    });

    // Dashboard
    Route::get('/dashboard/summary', [DashboardController::class, 'summary']);

    // Master data — read-only untuk dropdown master kecil
    Route::apiResource('fish-types', FishTypeController::class)->only(['index', 'show']);
    Route::apiResource('sales-channels', SalesChannelController::class)->only(['index', 'show']);

    // Master data — full CRUD
    Route::apiResource('grades', GradeController::class);
    Route::apiResource('locations', LocationController::class);
    Route::apiResource('pond-categories', PondCategoryController::class);

    // Ponds
    Route::apiResource('ponds', PondController::class);
    Route::get('ponds/{pond}/batches', [PondController::class, 'batches']);

    // Suppliers
    Route::apiResource('suppliers', SupplierController::class);

    // Purchases
    Route::apiResource('purchases', PurchaseController::class);
    Route::post('purchases/{purchase}/receive', [PurchaseController::class, 'receive']);

    // Harvests
    Route::apiResource('harvests', HarvestController::class);
    Route::post('harvests/{harvest}/receive', [HarvestController::class, 'receive']);

    // Batches
    Route::apiResource('batches', BatchController::class)
        ->only(['index', 'show', 'store', 'update', 'destroy']);
    Route::post('batches/{batch}/transfer', [BatchController::class, 'transfer']);

    // Sortings
    Route::apiResource('sortings', SortingController::class);
    Route::post('sortings/{sorting}/complete', [SortingController::class, 'complete']);

    // Sales
    Route::apiResource('sales', SaleController::class);
    Route::post('sales/{sale}/cancel', [SaleController::class, 'cancel']);

    // Mortality
    Route::get('mortalities/summary', [MortalityController::class, 'summary']);
    Route::apiResource('mortalities', MortalityController::class)
        ->only(['index', 'store', 'update', 'destroy']);

    // Stock Opname
    Route::post('stock-opnames/bulk', [StockOpnameController::class, 'storeBulk']);
    Route::apiResource('stock-opnames', StockOpnameController::class);
    Route::post('stock-opnames/{stock_opname}/complete', [StockOpnameController::class, 'complete']);

    // Stock movements
    Route::get('stock-movements', [StockMovementController::class, 'index']);

    // Exports (CSV)
    Route::get('exports/inventory.csv', [ExportController::class, 'inventoryCsv']);
    Route::get('exports/stock-opnames.csv', [ExportController::class, 'stockOpnamesCsv']);

    // Audit log (owner only)
    Route::middleware('can:manage-users')->group(function () {
        Route::get('audit-logs', [AuditLogController::class, 'index']);
    });
});
