<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Expense;
use App\Support\GeneratesCode;
use App\Support\PaginatesResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class ExpenseController extends Controller
{
    use GeneratesCode, PaginatesResponse;

    public function index(Request $request)
    {
        $query = Expense::with(['category', 'location', 'creator:id,name']);

        if ($request->filled('expense_category_id')) {
            $query->where('expense_category_id', $request->expense_category_id);
        }
        if ($request->filled('location_id')) {
            $query->where('location_id', $request->location_id);
        }
        if ($request->filled('from')) {
            $query->where('expense_date', '>=', $request->from);
        }
        if ($request->filled('to')) {
            $query->where('expense_date', '<=', $request->to);
        }
        if ($request->filled('q')) {
            $q = $request->q;
            $query->where(function ($w) use ($q) {
                $w->where('description', 'like', "%{$q}%")
                  ->orWhere('paid_by', 'like', "%{$q}%")
                  ->orWhere('notes', 'like', "%{$q}%");
            });
        }

        $query->orderByDesc('expense_date')->orderByDesc('id');

        $payload = $this->paginated($query, $request, defaultPerPage: 25);

        // Tambah ringkasan total untuk filter aktif (semua halaman, bukan cuma halaman ini)
        $summaryQ = Expense::query();
        if ($request->filled('expense_category_id')) $summaryQ->where('expense_category_id', $request->expense_category_id);
        if ($request->filled('location_id')) $summaryQ->where('location_id', $request->location_id);
        if ($request->filled('from')) $summaryQ->where('expense_date', '>=', $request->from);
        if ($request->filled('to')) $summaryQ->where('expense_date', '<=', $request->to);

        $payload['summary'] = [
            'total_amount' => (float) $summaryQ->sum('amount'),
            'count'        => (int) $summaryQ->count(),
        ];

        return response()->json($payload);
    }

    public function show(Expense $expense)
    {
        return response()->json([
            'data' => $expense->load(['category', 'location', 'creator:id,name']),
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'expense_date'        => 'required|date',
            'expense_category_id' => 'required|exists:expense_categories,id',
            'location_id'         => 'nullable|exists:locations,id',
            'description'         => 'required|string|max:200',
            'amount'              => 'required|numeric|min:0',
            'paid_by'             => 'nullable|string|max:100',
            'payment_method'      => 'nullable|string|max:30',
            'notes'               => 'nullable|string',
        ]);

        $data['code'] = $this->retryOnDuplicateCode(
            fn () => $this->generateCode(Expense::class, 'EXP'),
        );
        $data['created_by'] = Auth::id();

        $expense = Expense::create($data);

        return response()->json([
            'data' => $expense->load(['category', 'location', 'creator:id,name']),
        ], 201);
    }

    public function update(Request $request, Expense $expense)
    {
        $data = $request->validate([
            'expense_date'        => 'sometimes|date',
            'expense_category_id' => 'sometimes|exists:expense_categories,id',
            'location_id'         => 'nullable|exists:locations,id',
            'description'         => 'sometimes|string|max:200',
            'amount'              => 'sometimes|numeric|min:0',
            'paid_by'             => 'nullable|string|max:100',
            'payment_method'      => 'nullable|string|max:30',
            'notes'               => 'nullable|string',
        ]);

        $expense->update($data);

        return response()->json([
            'data' => $expense->fresh(['category', 'location', 'creator:id,name']),
        ]);
    }

    public function destroy(Expense $expense)
    {
        $expense->delete();
        return response()->json(null, 204);
    }
}
