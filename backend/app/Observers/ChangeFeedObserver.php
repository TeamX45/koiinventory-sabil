<?php

namespace App\Observers;

use App\Support\ChangeFeed;
use Illuminate\Database\Eloquent\Model;

/**
 * Observer generic: naikkan versi change feed setiap kali entitas inti
 * dibuat / diubah / dihapus, supaya klien lain tahu ada data baru.
 */
class ChangeFeedObserver
{
    public function created(Model $model): void
    {
        $this->bump($model);
    }

    public function updated(Model $model): void
    {
        $this->bump($model);
    }

    public function deleted(Model $model): void
    {
        $this->bump($model);
    }

    private function bump(Model $model): void
    {
        $entity = ChangeFeed::entityFor($model);
        if ($entity === null) {
            return;
        }

        try {
            ChangeFeed::touch($entity);
        } catch (\Throwable $e) {
            // Gagal menandai perubahan tidak boleh menggagalkan operasi utama.
            // Efeknya klien telat lihat data ini sampai poll berikutnya.
            logger()->warning('Change feed touch failed', [
                'entity' => $entity,
                'error'  => $e->getMessage(),
            ]);
        }
    }
}
