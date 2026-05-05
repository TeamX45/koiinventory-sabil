<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\StockMovement;
use App\Support\PaginatesResponse;
use Illuminate\Http\Request;

class StockMovementController extends Controller
{
    use PaginatesResponse;

    public function index(Request $request)
    {
        $query = StockMovement::with(['batch.pond', 'fromPond', 'toPond']);

        if ($request->filled('batch_id')) {
            $query->where('batch_id', $request->batch_id);
        }
        if ($request->filled('type')) {
            $query->where('type', $request->type);
        }
        if ($request->filled('from')) {
            $query->where('movement_date', '>=', $request->from);
        }
        if ($request->filled('to')) {
            $query->where('movement_date', '<=', $request->to);
        }

        $query->orderByDesc('movement_date')->orderByDesc('id');

        return response()->json($this->paginated($query, $request, defaultPerPage: 50));
    }
}
