<?php

namespace App\Observers;

use App\Models\AuditLog;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Request;

/**
 * Observer generic: catat created/updated/deleted ke audit_logs
 * untuk model-model yang di-attach.
 */
class AuditObserver
{
    public function created(Model $model): void
    {
        $this->log($model, 'created', null, $model->getAttributes());
    }

    public function updated(Model $model): void
    {
        $changes = $model->getChanges();
        if (empty($changes) || (count($changes) === 1 && isset($changes['updated_at']))) {
            return; // skip noise
        }

        $original = collect($changes)
            ->mapWithKeys(fn ($_, $k) => [$k => $model->getOriginal($k)])
            ->toArray();

        $this->log($model, 'updated', $original, $changes);
    }

    public function deleted(Model $model): void
    {
        $this->log($model, 'deleted', $model->getOriginal(), null);
    }

    private function log(Model $model, string $action, ?array $before, ?array $after): void
    {
        try {
            // Filter password / token agar tidak leak
            $sanitize = function (?array $arr): ?array {
                if (!$arr) return $arr;
                foreach (['password', 'remember_token', 'api_token'] as $key) {
                    if (isset($arr[$key])) $arr[$key] = '***';
                }
                return $arr;
            };

            AuditLog::create([
                'user_id'      => Auth::id(),
                'action'       => $action,
                'subject_type' => $model::class,
                'subject_id'   => $model->getKey(),
                'changes'      => array_filter([
                    'before' => $sanitize($before),
                    'after'  => $sanitize($after),
                ]),
                'meta'         => [
                    'ip'  => Request::ip(),
                    'ua'  => substr((string) Request::userAgent(), 0, 200),
                ],
            ]);
        } catch (\Throwable $e) {
            // Audit gagal tidak boleh menggagalkan operasi utama
            logger()->warning('Audit log failed', ['error' => $e->getMessage()]);
        }
    }
}
