<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Batch;
use App\Models\Mortality;
use App\Models\SaleItem;
use App\Models\Sorting;
use App\Models\StockMovement;
use App\Models\StockOpname;
use App\Services\StockOpnameService;
use App\Support\GeneratesCode;
use App\Support\PaginatesResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class StockOpnameController extends Controller
{
    use GeneratesCode, PaginatesResponse;

    /**
     * Relasi untuk tampilan. pond/fishType/grade dipakai baris temuan fisik
     * yang belum punya batch — tanpa itu barisnya tampil kosong di daftar.
     */
    private const WITH = [
        'batch.pond.location', 'batch.grade', 'batch.fishType.parent',
        'pond.location', 'fishType.parent', 'grade',
    ];

    public function __construct(private StockOpnameService $service) {}

    public function index(Request $request)
    {
        $query = StockOpname::with(self::WITH);

        if ($request->filled('batch_id')) {
            $query->where('batch_id', $request->batch_id);
        }
        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }
        if ($request->filled('from')) {
            $query->where('opname_date', '>=', $request->from);
        }
        if ($request->filled('to')) {
            $query->where('opname_date', '<=', $request->to);
        }

        $query->orderByDesc('opname_date')->orderByDesc('id');

        return response()->json($this->paginated($query, $request));
    }

    public function show(StockOpname $stockOpname)
    {
        return response()->json([
            'data' => $stockOpname->load([...self::WITH, 'creator']),
        ]);
    }

    /**
     * Satu baris opname.
     *
     * Dengan batch_id  → koreksi jumlah batch yang sudah ada.
     * Dengan pond_id   → temuan fisik: ikan yang ada di kolam tapi belum
     *                    tercatat. Batch-nya dibuat saat opname diselesaikan,
     *                    bukan sekarang, supaya draf yang batal tidak
     *                    meninggalkan baris kosong di daftar stok.
     */
    public function store(Request $request)
    {
        $data = $this->validateRows($request, single: true);
        $row  = $data['rows'][0];

        $opname = $this->retryOnDuplicateCode(fn () => DB::transaction(
            fn () => $this->makeRow($row, $data['opname_date'], $data['notes'] ?? null, optional($request->user())->id)
        ));

        return response()->json(['data' => $opname->load(self::WITH)], 201);
    }

    public function update(Request $request, StockOpname $stockOpname)
    {
        if ($stockOpname->status !== 'draft') {
            return response()->json([
                'message' => "Opname {$stockOpname->code} sudah {$stockOpname->status}, tidak bisa diubah.",
            ], 422);
        }

        $data = $request->validate([
            'opname_date'   => 'sometimes|date',
            'actual_count'  => 'sometimes|integer|min:0',
            'notes'         => 'nullable|string',
        ]);

        if (array_key_exists('actual_count', $data)) {
            $diff = (int) $data['actual_count'] - (int) $stockOpname->system_count;
            $data['difference'] = $diff;
        }

        $stockOpname->update($data);

        return response()->json([
            'data' => $stockOpname->fresh(self::WITH),
        ]);
    }

    public function complete(StockOpname $stockOpname)
    {
        try {
            $opname = $this->service->complete($stockOpname);
            return response()->json(['data' => $opname]);
        } catch (\RuntimeException $e) {
            // Domain error (mis. status bukan draft) → 422 dengan pesan ramah,
            // bukan 500 server error.
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    /**
     * Bulk opname: 1 transaksi DB untuk N baris di 1 kolam. Kalau ada 1 baris
     * gagal, semua dibatalkan (atomic).
     *
     * Tiap baris salah satu dari dua bentuk:
     *   { batch_id, actual_count }                        -> koreksi
     *   { pond_id, fish_type_id?, grade_id?, size_cm?,
     *     price_per_fish?, actual_count }                 -> temuan fisik
     */
    public function storeBulk(Request $request)
    {
        $data = $this->validateRows($request);

        $created = $this->retryOnDuplicateCode(fn () => DB::transaction(function () use ($data, $request) {
            $userId = optional($request->user())->id;

            return array_map(
                fn ($row) => $this->makeRow($row, $data['opname_date'], $data['notes'] ?? null, $userId),
                $data['rows'],
            );
        }));

        $baru = count(array_filter($created, fn ($o) => $o->batch_id === null));

        return response()->json([
            'data'    => $created,
            'message' => count($created) . ' draf opname tersimpan'
                . ($baru > 0 ? ", {$baru} di antaranya ikan baru." : '.'),
        ], 201);
    }

    /**
     * Validasi baris opname. Aturan yang tidak bisa ditulis sebagai rule biasa
     * ditambahkan di after(): tiap baris wajib punya batch ATAU kolam, dan
     * baris temuan fisik tidak masuk akal kalau jumlahnya nol.
     */
    private function validateRows(Request $request, bool $single = false): array
    {
        $payload = $single
            ? [
                'opname_date' => $request->input('opname_date'),
                'notes'       => $request->input('notes'),
                'rows'        => [$request->only([
                    'batch_id', 'pond_id', 'fish_type_id', 'grade_id',
                    'size_cm', 'price_per_fish', 'actual_count',
                ])],
            ]
            : $request->all();

        $validator = Validator::make($payload, [
            'opname_date'           => 'required|date',
            'notes'                 => 'nullable|string',
            'rows'                  => 'required|array|min:1',
            'rows.*.batch_id'       => 'nullable|exists:batches,id',
            'rows.*.pond_id'        => 'nullable|exists:ponds,id',
            'rows.*.fish_type_id'   => 'nullable|exists:fish_types,id',
            'rows.*.grade_id'       => 'nullable|exists:grades,id',
            'rows.*.size_cm'        => 'nullable|integer|min:1|max:300',
            'rows.*.price_per_fish' => 'nullable|numeric|min:0',
            'rows.*.actual_count'   => 'required|integer|min:0',
        ]);

        $validator->after(function ($v) use ($payload) {
            foreach ($payload['rows'] ?? [] as $i => $row) {
                if (blank($row['batch_id'] ?? null) && blank($row['pond_id'] ?? null)) {
                    $v->errors()->add("rows.{$i}.pond_id", 'Pilih kolam atau baris ikan yang sudah ada.');
                    continue;
                }

                if (blank($row['batch_id'] ?? null) && (int) ($row['actual_count'] ?? 0) < 1) {
                    $v->errors()->add(
                        "rows.{$i}.actual_count",
                        'Ikan baru harus lebih dari 0 ekor. Kalau memang tidak ada, jangan tambahkan barisnya.',
                    );
                }
            }
        });

        return $validator->validate();
    }

    /** Buat satu baris draf opname, koreksi maupun temuan fisik. */
    private function makeRow(array $row, string $date, ?string $notes, ?int $userId): StockOpname
    {
        $isNewStock  = blank($row['batch_id'] ?? null);
        $systemCount = 0;

        if (! $isNewStock) {
            $systemCount = (int) Batch::findOrFail($row['batch_id'])->current_count;
        }

        return StockOpname::create([
            'code'           => $this->generateCode(StockOpname::class, 'SO'),
            'batch_id'       => $isNewStock ? null : $row['batch_id'],
            'pond_id'        => $isNewStock ? $row['pond_id'] : null,
            'fish_type_id'   => $isNewStock ? ($row['fish_type_id'] ?? null) : null,
            'grade_id'       => $isNewStock ? ($row['grade_id'] ?? null) : null,
            'size_cm'        => $isNewStock ? ($row['size_cm'] ?? null) : null,
            'price_per_fish' => $isNewStock ? ($row['price_per_fish'] ?? null) : null,
            'opname_date'    => $date,
            'system_count'   => $systemCount,
            'actual_count'   => $row['actual_count'],
            'difference'     => (int) $row['actual_count'] - $systemCount,
            'status'         => 'draft',
            'notes'          => $notes,
            'created_by'     => $userId,
        ]);
    }

    public function destroy(StockOpname $stockOpname)
    {
        if ($stockOpname->status !== 'completed') {
            $stockOpname->delete();

            return response()->json(null, 204);
        }

        DB::transaction(function () use ($stockOpname) {
            $batch = Batch::lockForUpdate()->find($stockOpname->batch_id);

            // Batch yang lahir dari opname ini dan belum tersentuh apa pun
            // dibuang sekalian — meninggalkannya sebagai baris 0 ekor cuma
            // menyampah di daftar stok.
            if ($batch && $this->batchWasCreatedBy($batch, $stockOpname) && $this->batchIsUntouched($batch, $stockOpname)) {
                StockMovement::where('reference_type', 'StockOpname')
                    ->where('reference_id', $stockOpname->id)
                    ->delete();
                $stockOpname->delete();
                $batch->delete();

                return;
            }

            if ($batch && $stockOpname->difference !== 0) {
                // Dijepit di 0: kalau sebagian ikannya sudah terjual atau mati
                // sesudah opname, mengurangi selisih mentah-mentah bisa
                // menghasilkan stok negatif.
                $rolledBack = max(0, (int) $batch->current_count - (int) $stockOpname->difference);

                $batch->update([
                    'current_count' => $rolledBack,
                    'status'        => $rolledBack > 0 ? 'active' : 'depleted',
                ]);
            }

            StockMovement::where('reference_type', 'StockOpname')
                ->where('reference_id', $stockOpname->id)
                ->delete();

            $stockOpname->delete();
        });

        return response()->json(null, 204);
    }

    private function batchWasCreatedBy(Batch $batch, StockOpname $opname): bool
    {
        return $batch->source_type === 'opname' && (int) $batch->source_id === (int) $opname->id;
    }

    /**
     * Batch aman dihapus hanya kalau tidak ada jejak lain yang menunjuk ke
     * sana. Kalau sudah terjual, disortir, tercatat mati, atau dihitung ulang
     * oleh opname lain, batch-nya dipertahankan dan jumlahnya saja yang
     * dikembalikan.
     */
    private function batchIsUntouched(Batch $batch, StockOpname $opname): bool
    {
        if ((int) $batch->current_count !== (int) $opname->actual_count) {
            return false;
        }

        return ! SaleItem::where('batch_id', $batch->id)->exists()
            && ! Sorting::where('source_batch_id', $batch->id)->exists()
            && ! Mortality::where('batch_id', $batch->id)->exists()
            && ! Batch::where('parent_batch_id', $batch->id)->exists()
            && ! StockOpname::where('batch_id', $batch->id)
                ->whereKeyNot($opname->getKey())
                ->exists();
    }
}
