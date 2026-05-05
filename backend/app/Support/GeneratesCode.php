<?php

namespace App\Support;

use Illuminate\Database\QueryException;

trait GeneratesCode
{
    /**
     * Generate kode unik berformat {prefix}-{YYYYMM}-{NNNN}.
     * Pakai MAX(suffix) bukan latest('id') supaya tahan terhadap gap sequence
     * (mis. record dihapus / dibuat dengan kode manual).
     *
     * @param  class-string  $modelClass  Model dengan kolom 'code'
     * @param  string        $prefix      Prefix mis. "PO", "HRV"
     * @return string
     */
    protected function generateCode(string $modelClass, string $prefix): string
    {
        $codePrefix = $prefix . '-' . now()->format('Ym');
        $driver = \DB::connection()->getDriverName();

        if ($driver === 'mysql' || $driver === 'mariadb') {
            // Path optimal: agregat di DB
            $maxSeq = $modelClass::where('code', 'like', "{$codePrefix}-%")
                ->selectRaw('MAX(CAST(SUBSTRING_INDEX(code, "-", -1) AS UNSIGNED)) as max_seq')
                ->value('max_seq');
        } else {
            // Fallback portable (sqlite, postgres) — parsing di PHP
            $codes = $modelClass::where('code', 'like', "{$codePrefix}-%")
                ->pluck('code');
            $maxSeq = $codes
                ->map(fn ($c) => (int) substr($c, strrpos($c, '-') + 1))
                ->max() ?? 0;
        }

        $seq = ((int) $maxSeq) + 1;

        return sprintf('%s-%04d', $codePrefix, $seq);
    }

    /**
     * Bungkus mutator untuk auto-retry jika terjadi duplicate-key collision
     * (race condition saat dua request bersamaan generate kode yang sama).
     *
     * @template T
     * @param  callable(): T  $callback
     * @param  int            $maxAttempts
     * @return T
     */
    protected function retryOnDuplicateCode(callable $callback, int $maxAttempts = 5)
    {
        $attempt = 0;
        while (true) {
            try {
                return $callback();
            } catch (QueryException $e) {
                $attempt++;
                $msg = $e->getMessage();
                $isDuplicate = str_contains($msg, 'Duplicate entry')
                    || str_contains($msg, 'UNIQUE constraint failed')
                    || ($e->errorInfo[1] ?? null) === 1062;

                if (!$isDuplicate || $attempt >= $maxAttempts) {
                    throw $e;
                }
                // Tambah jitter kecil antar retry (1-15 ms)
                usleep(random_int(1000, 15000));
            }
        }
    }
}
