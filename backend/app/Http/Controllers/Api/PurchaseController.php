<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Purchase;
use App\Services\PurchaseService;
use App\Support\GeneratesCode;
use App\Support\PaginatesResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class PurchaseController extends Controller
{
    use GeneratesCode, PaginatesResponse;

    public function __construct(private PurchaseService $service) {}

    public function index(Request $request)
    {
        $query = Purchase::with('supplier')
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->status))
            ->when($request->filled('supplier_id'), fn ($q) => $q->where('supplier_id', $request->supplier_id))
            ->when($request->filled('from'), fn ($q) => $q->where('purchase_date', '>=', $request->from))
            ->when($request->filled('to'), fn ($q) => $q->where('purchase_date', '<=', $request->to))
            ->latest('purchase_date')
            ->latest('id');

        return response()->json($this->paginated($query, $request));
    }

    public function show(Purchase $purchase)
    {
        $purchase->load('supplier');
        return response()->json(['data' => $purchase]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'supplier_id'   => 'required|exists:suppliers,id',
            'purchase_date' => 'required|date',
            'total_count'   => 'required|integer|min:1',
            'subtotal'      => 'required|numeric|min:0',
            'notes'         => 'nullable|string',
        ]);

        $data['status']     = 'pending';
        $data['created_by'] = optional($request->user())->id;

        $purchase = $this->retryOnDuplicateCode(function () use ($data) {
            $data['code'] = $this->generateCode(Purchase::class, 'PO');
            return Purchase::create($data);
        });

        return response()->json(['data' => $purchase->load('supplier')], 201);
    }

    public function update(Request $request, Purchase $purchase)
    {
        if ($purchase->status !== 'pending') {
            return response()->json(['message' => 'Hanya purchase pending yang bisa diubah.'], 422);
        }

        $data = $request->validate([
            'supplier_id'   => 'sometimes|exists:suppliers,id',
            'purchase_date' => 'sometimes|date',
            'total_count'   => 'sometimes|integer|min:1',
            'subtotal'      => 'sometimes|numeric|min:0',
            'notes'         => 'nullable|string',
        ]);

        $purchase->update($data);
        return response()->json(['data' => $purchase->load('supplier')]);
    }

    public function destroy(Purchase $purchase)
    {
        if ($purchase->status !== 'pending') {
            return response()->json(['message' => 'Tidak bisa menghapus purchase yang sudah received/sorted.'], 422);
        }
        $purchase->delete();
        return response()->json(null, 204);
    }

    /**
     * Terima barang.
     *
     * Dua bentuk payload:
     *   { pond_id }        -> seluruh isi PO masuk ke satu kolam (bentuk lama)
     *   { allocations: [] } -> dipecah ke beberapa kolam, tiap bagian boleh
     *                          punya jenis, grade, rentang ukuran, dan estimasi
     *                          harga jual sendiri
     */
    public function receive(Request $request, Purchase $purchase)
    {
        $validator = Validator::make($request->all(), [
            'pond_id'                     => 'required_without:allocations|exists:ponds,id',
            'notes'                       => 'nullable|string',
            'allocations'                 => 'required_without:pond_id|array|min:1',
            'allocations.*.pond_id'       => 'required|exists:ponds,id',
            'allocations.*.count'         => 'required|integer|min:1',
            'allocations.*.fish_type_id'  => 'nullable|exists:fish_types,id',
            'allocations.*.grade_id'      => 'nullable|exists:grades,id',
            'allocations.*.size_cm'       => 'nullable|integer|min:1|max:300',
            'allocations.*.size_max_cm'   => 'nullable|integer|min:1|max:300',
            // Estimasi harga JUAL per ekor, bukan harga beli.
            'allocations.*.price_per_fish' => 'nullable|numeric|min:0',
        ]);

        $validator->after(function ($v) use ($request) {
            // gte tidak bisa dipakai lintas wildcard, jadi dicek manual.
            foreach ($request->input('allocations', []) as $i => $row) {
                $min = $row['size_cm'] ?? null;
                $max = $row['size_max_cm'] ?? null;

                if ($min !== null && $max !== null && (int) $max < (int) $min) {
                    $v->errors()->add("allocations.{$i}.size_max_cm", 'Ukuran maksimal tidak boleh lebih kecil dari minimal.');
                }
            }
        });

        $data = $validator->validate();

        $allocations = $data['allocations']
            ?? [['pond_id' => $data['pond_id'], 'count' => (int) $purchase->total_count]];

        try {
            $batches = $this->service->receive($purchase, $allocations, $data['notes'] ?? null);
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        // Jumlah baris tidak sama dengan jumlah kolam: satu kolam boleh diisi
        // beberapa jenis sekaligus. Pesannya harus menyebut keduanya dengan
        // benar, bukan menghitung baris sebagai kolam.
        $jumlahKolam = count(array_unique(array_column($allocations, 'pond_id')));
        $jumlahBaris = count($batches);

        return response()->json([
            'data'    => $jumlahBaris === 1 ? $batches[0] : $batches,
            'message' => match (true) {
                $jumlahBaris === 1              => 'Barang diterima.',
                $jumlahBaris === $jumlahKolam   => "Barang diterima dan dibagi ke {$jumlahKolam} kolam.",
                $jumlahKolam === 1              => "Barang diterima sebagai {$jumlahBaris} baris ikan di satu kolam.",
                default                         => "Barang diterima: {$jumlahBaris} baris ikan di {$jumlahKolam} kolam.",
            },
        ]);
    }

}
