<?php

namespace App\Services;

use App\Models\AppSetting;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * Klien tipis untuk Gemini (Google AI Studio), dipakai fitur Analisis AI.
 *
 * Sengaja memakai REST langsung, bukan SDK: satu endpoint saja yang dipakai,
 * dan menambah dependensi composer untuk itu tidak sepadan.
 *
 * Kunci dikirim lewat header x-goog-api-key, bukan query string, supaya tidak
 * ikut tercatat di log akses atau riwayat proxy.
 *
 * Sumber kunci: halaman Pengaturan (tersimpan terenkripsi di database) lebih
 * dulu, lalu .env sebagai cadangan. Urutan ini dipilih supaya pemilik bisa
 * mengganti kunci sendiri tanpa akses server.
 */
class GeminiClient
{
    public function __construct(
        private readonly ?string $apiKey = null,
        private readonly ?string $model = null,
        private readonly ?string $baseUrl = null,
        private readonly ?int $timeout = null,
    ) {
    }

    public function isConfigured(): bool
    {
        return filled($this->key());
    }

    public function model(): string
    {
        return $this->model
            ?? AppSetting::get(AppSetting::GEMINI_MODEL)
            ?? (string) config('services.gemini.model');
    }

    /** Dari mana kunci yang dipakai berasal — ditampilkan di halaman Pengaturan. */
    public function keySource(): ?string
    {
        if (filled(AppSetting::get(AppSetting::GEMINI_API_KEY))) {
            return 'pengaturan';
        }

        return filled(config('services.gemini.key')) ? 'env' : null;
    }

    /**
     * Kunci dalam bentuk yang aman ditampilkan: cukup untuk mengenali kunci
     * mana yang terpasang, tidak cukup untuk dipakai orang lain.
     */
    public function maskedKey(): ?string
    {
        $key = $this->key();

        if (blank($key)) {
            return null;
        }

        return strlen($key) <= 10
            ? str_repeat('*', strlen($key))
            : substr($key, 0, 4) . str_repeat('*', 6) . substr($key, -4);
    }

    /**
     * Model yang tersedia untuk kunci ini. Nama model Gemini berganti cukup
     * sering, jadi daftarnya ditanyakan langsung ke Google alih-alih ditebak.
     *
     * @return list<array{id: string, nama: string}>
     */
    public function listModels(): array
    {
        if (! $this->isConfigured()) {
            throw new RuntimeException('Kunci API Gemini belum diisi.');
        }

        $url = rtrim($this->baseUrl ?? (string) config('services.gemini.base_url'), '/') . '/models';

        try {
            $response = Http::withHeaders(['x-goog-api-key' => $this->key()])
                ->timeout($this->timeout ?? (int) config('services.gemini.timeout'))
                ->get($url, ['pageSize' => 200]);
        } catch (ConnectionException $e) {
            throw new RuntimeException('Server tidak bisa menghubungi layanan Gemini.', 0, $e);
        }

        if ($response->failed()) {
            throw new RuntimeException($this->explainFailure($response->status(), $response->json()));
        }

        return collect($response->json('models', []))
            ->filter(fn ($m) => in_array('generateContent', $m['supportedGenerationMethods'] ?? [], true))
            ->map(fn ($m) => [
                'id'   => str_replace('models/', '', (string) ($m['name'] ?? '')),
                'nama' => (string) ($m['displayName'] ?? ''),
            ])
            ->values()
            ->all();
    }

    /**
     * Kirim prompt dan kembalikan JSON terstruktur sesuai $schema.
     *
     * @param  array  $schema  Skema respons ala OpenAPI (tipe huruf besar: OBJECT, STRING, ARRAY).
     * @return array Hasil yang sudah di-decode.
     *
     * @throws RuntimeException Pesan sudah berbahasa Indonesia dan aman ditampilkan ke user.
     */
    public function generateJson(string $systemInstruction, string $prompt, array $schema): array
    {
        if (! $this->isConfigured()) {
            throw new RuntimeException(
                'Kunci API Gemini belum diisi. Buka Pengaturan > Analisis AI dan masukkan kunci Anda '
                . '(gratis di aistudio.google.com/apikey).'
            );
        }

        $url = rtrim($this->baseUrl ?? (string) config('services.gemini.base_url'), '/')
            . '/models/' . $this->model() . ':generateContent';

        try {
            $response = Http::withHeaders([
                'x-goog-api-key' => $this->key(),
                'Content-Type'   => 'application/json',
            ])
                ->timeout($this->timeout ?? (int) config('services.gemini.timeout'))
                ->post($url, [
                    'systemInstruction' => [
                        'parts' => [['text' => $systemInstruction]],
                    ],
                    'contents' => [[
                        'role'  => 'user',
                        'parts' => [['text' => $prompt]],
                    ]],
                    'generationConfig' => [
                        'temperature'      => 0.2,
                        'responseMimeType' => 'application/json',
                        'responseSchema'   => $schema,
                    ],
                ]);
        } catch (ConnectionException $e) {
            throw new RuntimeException(
                'Server tidak bisa menghubungi layanan Gemini. Cek koneksi internet server lalu coba lagi.',
                0,
                $e
            );
        }

        if ($response->failed()) {
            throw new RuntimeException($this->explainFailure($response->status(), $response->json()));
        }

        $text = $response->json('candidates.0.content.parts.0.text');

        if (! is_string($text) || trim($text) === '') {
            // Umumnya karena jawaban terpotong limit token atau kena filter isi.
            $reason = $response->json('candidates.0.finishReason') ?? 'tidak diketahui';
            throw new RuntimeException("Gemini tidak mengembalikan jawaban (alasan: {$reason}). Coba lagi.");
        }

        $decoded = json_decode($text, true);

        if (! is_array($decoded)) {
            throw new RuntimeException('Jawaban Gemini tidak berbentuk JSON yang bisa dibaca. Coba lagi.');
        }

        return $decoded;
    }

    private function key(): ?string
    {
        return $this->apiKey
            ?? AppSetting::get(AppSetting::GEMINI_API_KEY)
            ?? config('services.gemini.key');
    }

    /** Terjemahkan galat HTTP jadi kalimat yang berguna buat pemakai, bukan kode mentah. */
    private function explainFailure(int $status, mixed $body): string
    {
        $detail = is_array($body) ? ($body['error']['message'] ?? '') : '';

        return match (true) {
            $status === 400 && str_contains($detail, 'API key not valid')
                => 'Kunci API Gemini ditolak. Pastikan kuncinya disalin utuh dari Google AI Studio.',
            $status === 401 || $status === 403
                => 'Akses ke Gemini ditolak. Cek kunci API dan pastikan layanannya aktif untuk proyek tersebut.',
            $status === 404
                => 'Model "' . $this->model() . '" tidak ditemukan atau tidak tersedia untuk kunci ini. '
                    . 'Buka Pengaturan > Analisis AI dan pilih model dari daftar yang muncul di sana.',
            $status === 429
                => 'Kuota gratis Gemini sedang habis. Tunggu beberapa menit lalu coba lagi.',
            $status >= 500
                => 'Layanan Gemini sedang bermasalah. Coba lagi beberapa saat lagi.',
            default
                => 'Permintaan ke Gemini gagal (HTTP ' . $status . ')' . ($detail ? ': ' . $detail : '.'),
        };
    }
}
