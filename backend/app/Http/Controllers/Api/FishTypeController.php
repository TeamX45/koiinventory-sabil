<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Batch;
use App\Models\FishType;
use App\Support\GeneratesCode;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class FishTypeController extends Controller
{
    use GeneratesCode;

    public function index()
    {
        return response()->json([
            'data' => FishType::orderBy('group')->orderBy('name')->get(),
        ]);
    }

    public function show(FishType $fishType)
    {
        return response()->json(['data' => $fishType]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'code'  => 'sometimes|string|max:30|unique:fish_types,code',
            'name'  => 'required|string|max:100',
            'group' => 'required|in:koi,penjinak',
        ]);

        if (empty($data['code'])) {
            $data['code'] = $this->retryOnDuplicateCode(
                fn () => $this->generateCode(FishType::class, 'IKN'),
            );
        }

        $fishType = FishType::create($data);
        return response()->json(['data' => $fishType], 201);
    }

    public function update(Request $request, FishType $fishType)
    {
        $data = $request->validate([
            'code'  => ['sometimes', 'string', 'max:30', Rule::unique('fish_types', 'code')->ignore($fishType->id)],
            'name'  => 'sometimes|string|max:100',
            'group' => 'sometimes|in:koi,penjinak',
        ]);

        $fishType->update($data);
        return response()->json(['data' => $fishType]);
    }

    public function destroy(FishType $fishType)
    {
        $batchCount = Batch::where('fish_type_id', $fishType->id)->count();
        if ($batchCount > 0) {
            return response()->json([
                'message' => "Jenis ikan {$fishType->name} masih dipakai {$batchCount} baris ikan. Ubah jenis baris-baris itu dulu.",
            ], 422);
        }

        $fishType->delete();
        return response()->json(null, 204);
    }
}
