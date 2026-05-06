<?php

namespace App\Providers;

use App\Models\Batch;
use App\Models\Pond;
use App\Models\Purchase;
use App\Models\Sale;
use App\Models\Sorting;
use App\Models\StockOpname;
use App\Models\User;
use App\Observers\AuditObserver;
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

        // Rate limiter API: 60 req/menit per user (atau IP utk guest)
        RateLimiter::for('api', function (Request $request) {
            return Limit::perMinute(60)
                ->by(optional($request->user())->id ?: $request->ip());
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
        ] as $model) {
            $model::observe(AuditObserver::class);
        }
    }
}
