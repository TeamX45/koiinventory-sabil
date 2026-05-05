<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PondCategory;
use App\Support\GeneratesCode;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PondCategoryController extends Controller
{
    use GeneratesCode;

    public function index()
    {
        return response()->json([
            'data' => PondCategory::withCount('ponds')->orderBy('name')->get(),
        ]);
    }

    public function show(PondCategory $pondCategory)
    {
        return response()->json(['data' => $pondCategory->load('ponds')]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'code'        => 'sometimes|string|max:30|unique:pond_categories,code',
            'name'        => 'required|string|max:100',
            'description' => 'nullable|string',
            'is_breeding' => 'boolean',
            'is_grow_out' => 'boolean',
        ]);

        if (empty($data['code'])) {
            $data['code'] = $this->retryOnDuplicateCode(
                fn () => $this->generateCode(PondCategory::class, 'KAT'),
            );
        }

        $cat = PondCategory::create($data);
        return response()->json(['data' => $cat], 201);
    }

    public function update(Request $request, PondCategory $pondCategory)
    {
        $data = $request->validate([
            'code'        => ['sometimes', 'string', 'max:30', Rule::unique('pond_categories', 'code')->ignore($pondCategory->id)],
            'name'        => 'sometimes|string|max:100',
            'description' => 'nullable|string',
            'is_breeding' => 'boolean',
            'is_grow_out' => 'boolean',
        ]);

        $pondCategory->update($data);
        return response()->json(['data' => $pondCategory]);
    }

    public function destroy(PondCategory $pondCategory)
    {
        $pondCount = $pondCategory->ponds()->count();
        if ($pondCount > 0) {
            return response()->json([
                'message' => "Kategori {$pondCategory->name} masih dipakai {$pondCount} kolam. Pindahkan/hapus kolam dulu.",
            ], 422);
        }

        $pondCategory->delete();
        return response()->json(null, 204);
    }
}
