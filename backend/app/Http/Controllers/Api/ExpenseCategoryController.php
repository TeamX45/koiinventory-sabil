<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ExpenseCategory;
use App\Support\GeneratesCode;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ExpenseCategoryController extends Controller
{
    use GeneratesCode;

    public function index()
    {
        return response()->json([
            'data' => ExpenseCategory::withCount('expenses')->orderBy('name')->get(),
        ]);
    }

    public function show(ExpenseCategory $expenseCategory)
    {
        return response()->json(['data' => $expenseCategory->loadCount('expenses')]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'code'        => 'sometimes|string|max:30|unique:expense_categories,code',
            'name'        => 'required|string|max:100',
            'icon'        => 'nullable|string|max:30',
            'description' => 'nullable|string',
            'is_active'   => 'boolean',
        ]);

        if (empty($data['code'])) {
            $data['code'] = $this->retryOnDuplicateCode(
                fn () => $this->generateCode(ExpenseCategory::class, 'EXC'),
            );
        }

        $cat = ExpenseCategory::create($data);
        return response()->json(['data' => $cat], 201);
    }

    public function update(Request $request, ExpenseCategory $expenseCategory)
    {
        $data = $request->validate([
            'code'        => ['sometimes', 'string', 'max:30', Rule::unique('expense_categories', 'code')->ignore($expenseCategory->id)],
            'name'        => 'sometimes|string|max:100',
            'icon'        => 'nullable|string|max:30',
            'description' => 'nullable|string',
            'is_active'   => 'boolean',
        ]);

        $expenseCategory->update($data);
        return response()->json(['data' => $expenseCategory]);
    }

    public function destroy(ExpenseCategory $expenseCategory)
    {
        $count = $expenseCategory->expenses()->count();
        if ($count > 0) {
            return response()->json([
                'message' => "Kategori {$expenseCategory->name} masih dipakai {$count} pengeluaran. Pindahkan/hapus pengeluaran dulu.",
            ], 422);
        }

        $expenseCategory->delete();
        return response()->json(null, 204);
    }
}
