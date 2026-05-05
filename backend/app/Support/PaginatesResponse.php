<?php

namespace App\Support;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\Request;

trait PaginatesResponse
{
    /**
     * Pagination response standar. Selalu mengembalikan struktur
     * { data: [...], meta: { current_page, per_page, total, last_page } }.
     *
     * Default per_page = 25, dibatasi maksimum 100 untuk hindari overload.
     * Lewati pagination jika query string ?all=1 (utk dropdown master data).
     */
    protected function paginated(Builder $query, Request $request, int $defaultPerPage = 25, int $maxPerPage = 100): array
    {
        if ($request->boolean('all')) {
            $items = $query->limit($maxPerPage * 4)->get();
            return [
                'data' => $items,
                'meta' => [
                    'current_page' => 1,
                    'per_page'     => $items->count(),
                    'total'        => $items->count(),
                    'last_page'    => 1,
                ],
            ];
        }

        $perPage = (int) $request->input('per_page', $defaultPerPage);
        $perPage = max(1, min($perPage, $maxPerPage));

        /** @var LengthAwarePaginator $paginator */
        $paginator = $query->paginate($perPage)->appends($request->query());

        return [
            'data' => $paginator->items(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'per_page'     => $paginator->perPage(),
                'total'        => $paginator->total(),
                'last_page'    => $paginator->lastPage(),
            ],
        ];
    }

    /**
     * Format collection biasa (tanpa pagination) ke struktur standar
     * supaya frontend bisa konsumsi dengan shape yang sama.
     */
    protected function listed(Collection $items): array
    {
        return [
            'data' => $items,
            'meta' => [
                'current_page' => 1,
                'per_page'     => $items->count(),
                'total'        => $items->count(),
                'last_page'    => 1,
            ],
        ];
    }
}
