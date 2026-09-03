<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\ChangeFeed;
use Illuminate\Http\JsonResponse;

class ChangeFeedController extends Controller
{
    /**
     * Versi terakhir tiap entitas. Klien poll endpoint ini secara berkala,
     * bandingkan dengan hasil poll sebelumnya, lalu refresh hanya daftar yang
     * versinya berubah. Payload-nya kecil dan tidak menyentuh tabel data.
     */
    public function index(): JsonResponse
    {
        return response()
            ->json([
                'data'        => ChangeFeed::versions(),
                'server_time' => now()->getTimestampMs(),
            ])
            ->header('Cache-Control', 'no-store');
    }
}
