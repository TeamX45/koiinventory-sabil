<?php

namespace App\Providers;

use App\Models\Batch;
use App\Models\Expense;
use App\Models\Pond;
use App\Models\Purchase;
use App\Models\Sale;
use App\Models\Sorting;
use App\Models\StockOpname;
use App\Models\User;
use App\Observers\AuditObserver;
use App\Observers\ChangeFeedObserver;
use App\Support\ChangeFeed;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        Gate::define('manage-users', fn (User $user) => $user->canManageUsers());
        Gate::define('manage-master', fn (User $user) => $user->canManageMaster());
        Gate::define('approve-transactions', fn (User $user) => $user->canApproveTransactions());
        // Analisis AI memuat omzet, margin, dan biaya — level pengelola saja.
        Gate::define('view-ai-analysis', fn (User $user) => $user->isOwner() || $user->isAdmin());
        // Kunci API bisa dipakai membebani tagihan/kuota, jadi hanya pemilik.
        Gate::define('manage-ai-settings', fn (User $user) => $user->isOwner());

        // Rate limiter API. User login dapat jatah lebih besar: satu halaman SPA
        // bisa menembak belasan query sekaligus (prefetch) dan sejak ada change
        // feed masih ditambah ~6 poll/menit. Tamu tetap 60/menit.
        RateLimiter::for('api', function (Request $request) {
            $userId = optional($request->user())->id;

            return $userId
                ? Limit::perMinute(120)->by($userId)
                : Limit::perMinute(60)->by($request->ip());
        });

        // Analisis AI memanggil layanan luar berkuota. Batas per jam menjaga
        // kuota gratis tidak habis karena tombol ditekan berulang-ulang.
        RateLimiter::for('ai', function (Request $request) {
            return Limit::perHour(20)->by(optional($request->user())->id ?: $request->ip());
        });

        // Throttle keras login: cegah brute-force
        RateLimiter::for('login', function (Request $request) {
            return Limit::perMinute(5)
                ->by($request->ip() . ':' . $request->input('email', ''));
        });

        // Audit observer di entitas inti — track created/updated/deleted
        foreach ([
            Pond::class, Batch::class, Purchase::class,
            Sorting::class, Sale::class, StockOpname::class,
            Expense::class,
        ] as $model) {
            $model::observe(AuditObserver::class);
        }

        // Change feed observer — dipasang ke SEMUA entitas yang tampil di UI
        // (termasuk master data) supaya perubahan dari user lain terdeteksi
        // klien tanpa refresh halaman.
        foreach (array_keys(ChangeFeed::MODEL_ENTITY) as $model) {
            $model::observe(ChangeFeedObserver::class);
        }
    }
}
