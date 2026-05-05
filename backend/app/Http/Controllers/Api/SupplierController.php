<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Supplier;
use App\Support\GeneratesCode;
use Illuminate\Http\Request;

class SupplierController extends Controller
{
    use GeneratesCode;

    public function index()
    {
        return response()->json(['data' => Supplier::orderBy('name')->get()]);
    }

    public function show(Supplier $supplier)
    {
        return response()->json(['data' => $supplier]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'code'      => 'sometimes|string|max:30|unique:suppliers,code',
            'name'      => 'required|string|max:150',
            'location'  => 'nullable|string|max:150',
            'phone'     => 'nullable|string|max:30',
            'address'   => 'nullable|string',
            'is_active' => 'boolean',
            'notes'     => 'nullable|string',
        ]);

        // Auto-generate kode kalau user tidak isi
        if (empty($data['code'])) {
            $data['code'] = $this->retryOnDuplicateCode(
                fn () => $this->generateCode(Supplier::class, 'SUP'),
            );
        }

        $supplier = Supplier::create($data);
        return response()->json(['data' => $supplier], 201);
    }

    public function update(Request $request, Supplier $supplier)
    {
        $data = $request->validate([
            'name'      => 'sometimes|string|max:150',
            'location'  => 'nullable|string|max:150',
            'phone'     => 'nullable|string|max:30',
            'address'   => 'nullable|string',
            'is_active' => 'boolean',
            'notes'     => 'nullable|string',
        ]);

        $supplier->update($data);
        return response()->json(['data' => $supplier]);
    }

    public function destroy(Supplier $supplier)
    {
        $purchaseCount = $supplier->purchases()->count();
        if ($purchaseCount > 0) {
            return response()->json([
                'message' => "Supplier {$supplier->name} sudah dipakai di {$purchaseCount} PO. Nonaktifkan saja (toggle status) atau hapus PO terkait dulu.",
            ], 422);
        }

        $supplier->delete();
        return response()->json(null, 204);
    }
}
