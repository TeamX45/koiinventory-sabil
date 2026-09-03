<?php

namespace App\Support;

use Illuminate\Support\Facades\Cache;

/**
 * Change feed — penanda versi per entitas.
 *
 * Setiap perubahan model menaikkan versi entitasnya. Klien cukup poll
 * GET /api/v1/changes (satu request kecil) lalu me-refresh HANYA entitas yang
 * versinya berubah, jadi data user lain muncul tanpa refresh halaman tanpa
 * harus polling semua daftar.
 *
 * Disimpan di cache, bukan tabel baru: tidak perlu migrasi, dan otomatis ikut
 * driver cache aplikasi (database di prod, array di test).
 *
 * Sengaja tidak ada batching/dedupe per request: satu upsert baris cache per
 * perubahan model itu murah, dan menahannya sampai akhir request bikin versi
 * bisa hilang di konteks yang tidak memanggil terminating callback.
 */
final class ChangeFeed
{
    private const PREFIX = 'changefeed:';

    /**
     * Model → nama entitas yang dikenal klien.
     * Model anak dipetakan ke entitas induknya (SaleItem → sales) supaya
     * perubahan detail tetap terdeteksi walau baris induk tidak ikut berubah.
     */
    public const MODEL_ENTITY = [
        \App\Models\Pond::class            => 'ponds',
        \App\Models\Batch::class           => 'batches',
        \App\Models\StockMovement::class   => 'batches',
        \App\Models\Purchase::class        => 'purchases',
        \App\Models\Harvest::class         => 'harvests',
        \App\Models\Sorting::class         => 'sortings',
        \App\Models\SortingResult::class   => 'sortings',
        \App\Models\Sale::class            => 'sales',
        \App\Models\SaleItem::class        => 'sales',
        \App\Models\Mortality::class       => 'mortalities',
        \App\Models\StockOpname::class     => 'stock-opnames',
        \App\Models\Expense::class         => 'expenses',
        \App\Models\ExpenseCategory::class => 'expense-categories',
        \App\Models\FishType::class        => 'fish-types',
        \App\Models\Grade::class           => 'grades',
        \App\Models\Location::class        => 'locations',
        \App\Models\PondCategory::class    => 'pond-categories',
        \App\Models\Supplier::class        => 'suppliers',
        \App\Models\SalesChannel::class    => 'sales-channels',
        \App\Models\User::class            => 'users',
    ];

    /** Entitas yang perubahannya membuat angka ringkasan dashboard basi. */
    private const AFFECTS_DASHBOARD = [
        'ponds', 'batches', 'purchases', 'harvests', 'sortings',
        'sales', 'mortalities', 'stock-opnames', 'expenses',
    ];

    /** Entitas semu untuk ringkasan dashboard (tidak punya model sendiri). */
    public const DASHBOARD = 'dashboard';

    /** @return list<string> */
    public static function entities(): array
    {
        return [...array_values(array_unique(self::MODEL_ENTITY)), self::DASHBOARD];
    }

    public static function entityFor(object|string $model): ?string
    {
        return self::MODEL_ENTITY[is_string($model) ? $model : $model::class] ?? null;
    }

    /** Tandai satu entitas berubah. */
    public static function touch(string $entity): void
    {
        Cache::forever(self::PREFIX . $entity, self::stamp());

        if (in_array($entity, self::AFFECTS_DASHBOARD, true)) {
            // DashboardController meng-cache ringkasannya 60 detik di sisi server.
            // Tanpa dibuang di sini, angkanya tetap basi walau klien refetch —
            // bahkan setelah refresh halaman.
            Cache::forget('dashboard:summary');
            Cache::forever(self::PREFIX . self::DASHBOARD, self::stamp());
        }
    }

    /**
     * Versi semua entitas. Entitas yang belum pernah berubah sejak cache
     * kosong bernilai 0 — klien hanya membandingkan, tidak memakai nilainya.
     *
     * @return array<string, int>
     */
    public static function versions(): array
    {
        $entities = self::entities();
        $keys     = array_map(fn (string $e) => self::PREFIX . $e, $entities);
        $raw      = Cache::many($keys);

        return array_combine(
            $entities,
            array_map(fn (string $key) => (int) ($raw[$key] ?? 0), $keys),
        );
    }

    /** Milidetik — cukup halus untuk membedakan dua perubahan beruntun. */
    private static function stamp(): int
    {
        return (int) round(microtime(true) * 1000);
    }
}
