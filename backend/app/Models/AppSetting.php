<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

/**
 * Setelan yang bisa diubah dari UI. Kuncinya sedikit dan dibaca di banyak
 * request, jadi nilainya ditahan di cache — string biasa, bukan objek, supaya
 * aman terhadap cache.serializable_classes = false.
 */
class AppSetting extends Model
{
    public const GEMINI_API_KEY = 'gemini_api_key';
    public const GEMINI_MODEL   = 'gemini_model';

    protected $primaryKey = 'key';

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = ['key', 'value'];

    protected $casts = [
        // Terenkripsi dengan APP_KEY: kunci API tidak boleh terbaca polos oleh
        // siapa pun yang kebetulan bisa melihat isi tabel atau hasil backup.
        'value' => 'encrypted',
    ];

    private const CACHE_PREFIX = 'app-setting:';

    public static function get(string $key, ?string $default = null): ?string
    {
        $value = Cache::rememberForever(
            self::CACHE_PREFIX . $key,
            // Null disimpan sebagai string kosong: null bikin rememberForever
            // menembak query lagi setiap kali dibaca.
            fn () => (string) (static::query()->find($key)?->value ?? '')
        );

        return $value === '' ? $default : $value;
    }

    public static function put(string $key, ?string $value): void
    {
        if ($value === null || $value === '') {
            static::query()->whereKey($key)->delete();
        } else {
            static::query()->updateOrCreate(['key' => $key], ['value' => $value]);
        }

        Cache::forget(self::CACHE_PREFIX . $key);
    }
}
