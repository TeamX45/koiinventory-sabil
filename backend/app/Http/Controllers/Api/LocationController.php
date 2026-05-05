<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Location;
use App\Support\GeneratesCode;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class LocationController extends Controller
{
    use GeneratesCode;

    public function index()
    {
        // Lightweight: tambahkan count ponds tanpa load semua relasi (hindari N+1 + payload besar)
        return response()->json([
            'data' => Location::withCount('ponds')->orderBy('name')->get(),
        ]);
    }

    public function show(Location $location)
    {
        return response()->json(['data' => $location->load('ponds.category')]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'code'    => 'sometimes|string|max:20|unique:locations,code',
            'name'    => 'required|string|max:100',
            'type'    => ['required', Rule::in(['filter', 'tanah'])],
            'address' => 'nullable|string|max:255',
            'notes'   => 'nullable|string',
        ]);

        if (empty($data['code'])) {
            $data['code'] = $this->retryOnDuplicateCode(
                fn () => $this->generateCode(Location::class, 'LOC'),
            );
        }

        $location = Location::create($data);
        return response()->json(['data' => $location], 201);
    }

    public function update(Request $request, Location $location)
    {
        $data = $request->validate([
            'code'    => ['sometimes', 'string', 'max:20', Rule::unique('locations', 'code')->ignore($location->id)],
            'name'    => 'sometimes|string|max:100',
            'type'    => ['sometimes', Rule::in(['filter', 'tanah'])],
            'address' => 'nullable|string|max:255',
            'notes'   => 'nullable|string',
        ]);

        $location->update($data);
        return response()->json(['data' => $location]);
    }

    public function destroy(Location $location)
    {
        $pondCount = $location->ponds()->count();
        if ($pondCount > 0) {
            return response()->json([
                'message' => "Lokasi {$location->name} masih dipakai {$pondCount} kolam. Pindahkan/hapus kolam dulu.",
            ], 422);
        }

        $location->delete();
        return response()->json(null, 204);
    }
}
