<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\BusinessAnalyst;
use App\Services\BusinessSnapshot;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

class AiAnalysisController extends Controller
{
    /**
     * Analisis bisnis dari data inventaris.
     *
     * Tanpa pertanyaan: analisis kesehatan usaha secara umum.
     * Dengan pertanyaan: jawaban atas pertanyaan itu, tetap bersandar pada angka
     * yang sama.
     */
    public function analyse(Request $request, BusinessAnalyst $analyst): JsonResponse
    {
        $validated = $request->validate([
            'question' => 'nullable|string|max:500',
        ]);

        try {
            $result = $analyst->analyse($validated['question'] ?? null);
        } catch (RuntimeException $e) {
            // Pesannya sudah dirapikan di GeminiClient dan aman ditampilkan.
            return response()->json(['message' => $e->getMessage()], 503);
        }

        return response()->json($result);
    }

    /**
     * Angka mentah yang dipakai analisis, tanpa memanggil AI sama sekali.
     * Berguna untuk memeriksa dasar sebuah kesimpulan, dan tidak memakan kuota.
     */
    public function snapshot(BusinessSnapshot $snapshot): JsonResponse
    {
        return response()->json(['data' => $snapshot->build()]);
    }

    /** Apakah fitur ini siap dipakai — dipakai UI untuk memberi pesan yang tepat. */
    public function status(BusinessAnalyst $analyst): JsonResponse
    {
        return response()->json([
            'data' => [
                'siap'  => $analyst->isConfigured(),
                'model' => config('services.gemini.model'),
            ],
        ]);
    }
}
