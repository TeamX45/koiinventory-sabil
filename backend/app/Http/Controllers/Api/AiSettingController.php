<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AppSetting;
use App\Services\GeminiClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

/**
 * Pengaturan kunci API untuk Analisis AI.
 *
 * Kunci tidak pernah dikirim balik ke browser dalam bentuk utuh — hanya versi
 * bertopeng, cukup untuk memastikan kunci mana yang terpasang.
 */
class AiSettingController extends Controller
{
    public function show(GeminiClient $gemini): JsonResponse
    {
        return response()->json(['data' => $this->state($gemini)]);
    }

    public function update(Request $request, GeminiClient $gemini): JsonResponse
    {
        $validated = $request->validate([
            // Kunci AI Studio panjangnya ~39 karakter; batas bawah longgar supaya
            // format baru dari Google tidak ikut tertolak.
            'api_key' => 'nullable|string|min:20|max:200',
            'model'   => 'nullable|string|max:100',
        ]);

        if (array_key_exists('api_key', $validated) && filled($validated['api_key'])) {
            AppSetting::put(AppSetting::GEMINI_API_KEY, trim($validated['api_key']));
        }

        if (array_key_exists('model', $validated)) {
            AppSetting::put(AppSetting::GEMINI_MODEL, $validated['model'] ? trim($validated['model']) : null);
        }

        return response()->json([
            'message' => 'Pengaturan Analisis AI tersimpan.',
            'data'    => $this->state($gemini),
        ]);
    }

    /** Hapus kunci dari database; kalau .env punya kunci, sistem kembali memakainya. */
    public function destroy(GeminiClient $gemini): JsonResponse
    {
        AppSetting::put(AppSetting::GEMINI_API_KEY, null);

        return response()->json([
            'message' => 'Kunci API dihapus.',
            'data'    => $this->state($gemini),
        ]);
    }

    /** Model yang benar-benar tersedia untuk kunci yang terpasang. */
    public function models(GeminiClient $gemini): JsonResponse
    {
        try {
            return response()->json(['data' => $gemini->listModels()]);
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 503);
        }
    }

    /**
     * Uji kunci + model dengan satu permintaan sungguhan yang sangat kecil.
     * Lebih baik gagal di sini, saat pemilik sedang menyetel, daripada nanti
     * saat dia butuh analisisnya.
     */
    public function test(GeminiClient $gemini): JsonResponse
    {
        try {
            $gemini->generateJson(
                'Jawab sesuai skema. Ini hanya uji koneksi.',
                'Balas dengan {"ok": "ya"}.',
                [
                    'type'       => 'OBJECT',
                    'properties' => ['ok' => ['type' => 'STRING']],
                    'required'   => ['ok'],
                ],
            );
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 503);
        }

        return response()->json([
            'message' => 'Berhasil terhubung ke Gemini memakai model ' . $gemini->model() . '.',
            'data'    => $this->state($gemini),
        ]);
    }

    private function state(GeminiClient $gemini): array
    {
        return [
            'terpasang'     => $gemini->isConfigured(),
            'sumber'        => $gemini->keySource(),
            'preview'       => $gemini->maskedKey(),
            'model'         => $gemini->model(),
            'model_bawaan'  => (string) config('services.gemini.model'),
        ];
    }
}
