<?php

namespace App\Console\Commands;

use App\Services\GeminiClient;
use Illuminate\Console\Command;

/**
 * Nama model Gemini berganti cukup sering, dan salah nama hanya terlihat
 * sebagai HTTP 404 saat fitur dipakai. Perintah ini menanyakan langsung ke
 * Google model apa yang tersedia untuk kunci yang terpasang.
 */
class ListGeminiModels extends Command
{
    protected $signature = 'ai:models';

    protected $description = 'Daftar model Gemini yang tersedia untuk GEMINI_API_KEY yang terpasang';

    public function handle(GeminiClient $gemini): int
    {
        if (! $gemini->isConfigured()) {
            $this->error('Kunci API Gemini belum diisi.');
            $this->line('Isi lewat Pengaturan > Analisis AI di aplikasi, atau GEMINI_API_KEY di .env.');
            $this->line('Kunci gratis: https://aistudio.google.com/apikey');

            return self::FAILURE;
        }

        try {
            $models = $gemini->listModels();
        } catch (\RuntimeException $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        }

        if ($models === []) {
            $this->warn('Tidak ada model yang mendukung generateContent untuk kunci ini.');

            return self::FAILURE;
        }

        $this->table(
            ['Model', 'Nama tampilan'],
            array_map(fn ($m) => [$m['id'], $m['nama']], $models),
        );
        $this->line('Terpasang sekarang: ' . $gemini->model());

        return self::SUCCESS;
    }
}
