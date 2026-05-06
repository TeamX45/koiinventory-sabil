<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Batch;
use App\Models\Grade;
use App\Support\GeneratesCode;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class GradeController extends Controller
{
    use GeneratesCode;

    public function index()
    {
        return response()->json([
            'data' => Grade::orderBy('rank')->orderBy('name')->get(),
        ]);
    }

    public function show(Grade $grade)
    {
        return response()->json(['data' => $grade]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'code'        => 'sometimes|string|max:20|unique:grades,code',
            'name'        => 'required|string|max:50',
            'rank'        => 'required|integer|min:1|max:100',
            'description' => 'nullable|string',
        ]);

        if (empty($data['code'])) {
            $data['code'] = $this->retryOnDuplicateCode(
                fn () => $this->generateCode(Grade::class, 'GRD'),
            );
        }

        $grade = Grade::create($data);
        return response()->json(['data' => $grade], 201);
    }

    public function update(Request $request, Grade $grade)
    {
        $data = $request->validate([
            'code'        => ['sometimes', 'string', 'max:20', Rule::unique('grades', 'code')->ignore($grade->id)],
            'name'        => 'sometimes|string|max:50',
            'rank'        => 'sometimes|integer|min:1|max:100',
            'description' => 'nullable|string',
        ]);

        $grade->update($data);
        return response()->json(['data' => $grade]);
    }

    public function destroy(Grade $grade)
    {
        $batchCount = Batch::where('grade_id', $grade->id)->count();
        if ($batchCount > 0) {
            return response()->json([
                'message' => "Grade {$grade->name} masih dipakai {$batchCount} baris ikan. Ubah grade-nya dulu.",
            ], 422);
        }

        $grade->delete();
        return response()->json(null, 204);
    }
}
