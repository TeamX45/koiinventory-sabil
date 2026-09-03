<?php

use App\Http\Controllers\Api\AuditLogController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BatchController;
use App\Http\Controllers\Api\ChangeFeedController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\ExpenseCategoryController;
use App\Http\Controllers\Api\ExpenseController;
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

    // Change feed: versi terakhir tiap entitas. Di-poll klien supaya tabel
    // ikut berubah saat user lain menyimpan data, tanpa refresh halaman.
    Route::get('/changes', [ChangeFeedController::class, 'index']);

    // =================================================================
    // MASTER DATA — semua role boleh BACA, hanya owner/admin boleh UBAH.
    // Staff mencatat transaksi, bukan mengubah kerangka datanya.
    // =================================================================
    Route::apiResource('sales-channels', SalesChannelController::class)->only(['index', 'show']);
    Route::apiResource('grades', GradeController::class)->only(['index', 'show']);
    Route::apiResource('fish-types', FishTypeController::class)->only(['index', 'show']);
    Route::apiResource('locations', LocationController::class)->only(['index', 'show']);
    Route::apiResource('pond-categories', PondCategoryController::class)->only(['index', 'show']);
    Route::apiResource('expense-categories', ExpenseCategoryController::class)->only(['index', 'show']);
    Route::apiResource('ponds', PondController::class)->only(['index', 'show']);
    Route::get('ponds/{pond}/batches', [PondController::class, 'batches']);
    Route::apiResource('suppliers', SupplierController::class)->only(['index', 'show']);

    Route::middleware('can:manage-master')->group(function () {
        Route::apiResource('grades', GradeController::class)->except(['index', 'show']);
        Route::apiResource('fish-types', FishTypeController::class)->except(['index', 'show']);
        Route::apiResource('locations', LocationController::class)->except(['index', 'show']);
        Route::apiResource('pond-categories', PondCategoryController::class)->except(['index', 'show']);
        Route::apiResource('expense-categories', ExpenseCategoryController::class)->except(['index', 'show']);
        Route::apiResource('ponds', PondController::class)->except(['index', 'show']);
        Route::apiResource('suppliers', SupplierController::class)->except(['index', 'show']);
    });

    // =================================================================
    // TRANSAKSI HARIAN — semua role boleh catat & ubah.
    // Penghapusan dipisah ke grup approve-transactions di bawah.
    // =================================================================
    Route::apiResource('expenses', ExpenseController::class)->except(['destroy']);

    Route::apiResource('purchases', PurchaseController::class)->except(['destroy']);
    Route::post('purchases/{purchase}/receive', [PurchaseController::class, 'receive']);

    Route::apiResource('harvests', HarvestController::class)->except(['destroy']);
    Route::post('harvests/{harvest}/receive', [HarvestController::class, 'receive']);

    Route::apiResource('batches', BatchController::class)->only(['index', 'show', 'store', 'update']);
    Route::post('batches/{batch}/transfer', [BatchController::class, 'transfer']);

    Route::apiResource('sortings', SortingController::class)->except(['destroy']);
    Route::post('sortings/{sorting}/complete', [SortingController::class, 'complete']);

    Route::apiResource('sales', SaleController::class)->except(['destroy']);

    Route::get('mortalities/summary', [MortalityController::class, 'summary']);
    Route::apiResource('mortalities', MortalityController::class)->only(['index', 'store', 'update']);

    Route::post('stock-opnames/bulk', [StockOpnameController::class, 'storeBulk']);
    Route::apiResource('stock-opnames', StockOpnameController::class)->except(['destroy']);

    // =================================================================
    // AKSI SENSITIF — owner/admin saja.
    // Membatalkan penjualan & menyelesaikan opname menulis ulang stok
    // secara permanen; penghapusan transaksi menghilangkan jejak audit.
    // =================================================================
    Route::middleware('can:approve-transactions')->group(function () {
        Route::post('sales/{sale}/cancel', [SaleController::class, 'cancel']);
        Route::post('stock-opnames/{stock_opname}/complete', [StockOpnameController::class, 'complete']);

        Route::apiResource('expenses', ExpenseController::class)->only(['destroy']);
        Route::apiResource('purchases', PurchaseController::class)->only(['destroy']);
        Route::apiResource('harvests', HarvestController::class)->only(['destroy']);
        Route::apiResource('batches', BatchController::class)->only(['destroy']);
        Route::apiResource('sortings', SortingController::class)->only(['destroy']);
        Route::apiResource('sales', SaleController::class)->only(['destroy']);
        Route::apiResource('mortalities', MortalityController::class)->only(['destroy']);
        Route::apiResource('stock-opnames', StockOpnameController::class)->only(['destroy']);
    });

    // Stock movements (audit trail — baca saja)
    Route::get('stock-movements', [StockMovementController::class, 'index']);

    // Exports (CSV)
    Route::get('exports/inventory.csv', [ExportController::class, 'inventoryCsv']);
    Route::get('exports/stock-opnames.csv', [ExportController::class, 'stockOpnamesCsv']);

    // Audit log (owner only)
    Route::middleware('can:manage-users')->group(function () {
        Route::get('audit-logs', [AuditLogController::class, 'index']);
    });
});
