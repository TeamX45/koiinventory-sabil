<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Batch;
use App\Models\FishType;
use App\Support\GeneratesCode;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class FishTypeController extends Controller
{
    use GeneratesCode;

    /** Batas ukuran & tipe foto acuan. */
    private const IMAGE_RULES = 'nullable|image|mimes:jpeg,jpg,png,webp|max:2048';

    public function index()
    {
        // Urut abjad nama (case-insensitive) — user minta murni alfabet supaya
        // dropdown mudah dicari. Relasi ikut dimuat agar frontend bisa
        // menampilkan bertingkat tanpa query tambahan.
        return response()->json([
            'data' => FishType::with([
                'parent:id,name',
                'defaultGrade:id,name',
                'defaultPond:id,name',
                'children' => fn ($q) => $q->orderByRaw('LOWER(name) ASC'),
            ])
                ->orderByRaw('LOWER(name) ASC')
                ->get(),
        ]);
    }

    public function show(FishType $fishType)
    {
        $fishType->load(['parent:id,name', 'defaultGrade:id,name', 'defaultPond:id,name', 'children']);

        return response()->json(['data' => $fishType]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'code'        => 'sometimes|nullable|string|max:30|unique:fish_types,code',
            'name'        => 'required|string|max:100',
            'group'       => 'required|in:koi,penjinak',
            'description' => 'nullable|string',
            'parent_id'   => 'nullable|exists:fish_types,id',
            'default_grade_id' => 'nullable|exists:grades,id',
            'default_pond_id'  => 'nullable|exists:ponds,id',
            'image'       => self::IMAGE_RULES,
        ]);

        $this->assertParentIsTopLevel($data['parent_id'] ?? null);
        $this->assertNameUniqueAmongSiblings($data['name'], $data['parent_id'] ?? null);

        if (empty($data['code'])) {
            $data['code'] = $this->retryOnDuplicateCode(
                fn () => $this->generateCode(FishType::class, 'IKN'),
            );
        }

        if ($request->hasFile('image')) {
            $data['image_path'] = $request->file('image')->store('fish-types', 'public');
        }
        unset($data['image']);

        $fishType = FishType::create($data);
        $fishType->load(['parent:id,name', 'defaultGrade:id,name', 'defaultPond:id,name']);

        return response()->json(['data' => $fishType], 201);
    }

    public function update(Request $request, FishType $fishType)
    {
        $data = $request->validate([
            'code'         => ['sometimes', 'string', 'max:30', Rule::unique('fish_types', 'code')->ignore($fishType->id)],
            'name'         => 'sometimes|string|max:100',
            'group'        => 'sometimes|in:koi,penjinak',
            'description'  => 'nullable|string',
            'parent_id'    => 'nullable|exists:fish_types,id',
            'default_grade_id' => 'nullable|exists:grades,id',
            'default_pond_id'  => 'nullable|exists:ponds,id',
            'image'        => self::IMAGE_RULES,
            'remove_image' => 'sometimes|boolean',
        ]);

        if (array_key_exists('parent_id', $data)) {
            $this->assertParentIsValidFor($fishType, $data['parent_id']);
        }

        // Nama & induk bisa berubah terpisah — periksa dengan nilai akhir keduanya.
        $this->assertNameUniqueAmongSiblings(
            $data['name'] ?? $fishType->name,
            array_key_exists('parent_id', $data) ? $data['parent_id'] : $fishType->parent_id,
            $fishType->id,
        );

        // Ganti foto: simpan yang baru, buang yang lama supaya disk tidak menumpuk.
        if ($request->hasFile('image')) {
            $this->deleteImage($fishType);
            $data['image_path'] = $request->file('image')->store('fish-types', 'public');
        } elseif ($request->boolean('remove_image')) {
            $this->deleteImage($fishType);
            $data['image_path'] = null;
        }
        unset($data['image'], $data['remove_image']);

        $fishType->update($data);
        $fishType->load(['parent:id,name', 'defaultGrade:id,name', 'defaultPond:id,name']);

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

        $childCount = $fishType->children()->count();
        if ($childCount > 0) {
            return response()->json([
                'message' => "Jenis ikan {$fishType->name} masih punya {$childCount} sub-jenis. Hapus atau pindahkan sub-jenisnya dulu.",
            ], 422);
        }

        $this->deleteImage($fishType);
        $fishType->delete();

        return response()->json(null, 204);
    }

    /**
     * Kedalaman dibatasi 2 tingkat: induk harus jenis tingkat atas.
     * Tanpa ini, Kohaku > Tancho > Doitsu > ... bisa tumbuh tak terbatas dan
     * setiap dropdown harus menangani kedalaman sembarang.
     */
    private function assertParentIsTopLevel(?int $parentId): void
    {
        if ($parentId === null) {
            return;
        }

        $parent = FishType::find($parentId);

        if ($parent && $parent->parent_id !== null) {
            throw ValidationException::withMessages([
                'parent_id' => ["{$parent->name} sudah menjadi sub-jenis. Sub-jenis tidak boleh punya sub-jenis lagi (maksimal 2 tingkat)."],
            ]);
        }
    }

    private function assertParentIsValidFor(FishType $fishType, ?int $parentId): void
    {
        if ($parentId === null) {
            return;
        }

        if ($parentId === $fishType->id) {
            throw ValidationException::withMessages([
                'parent_id' => ['Jenis ikan tidak boleh menjadi induk dirinya sendiri.'],
            ]);
        }

        // Jenis yang sudah punya anak tidak boleh dijadikan anak — itu akan
        // membuat cucu, melewati batas 2 tingkat.
        if ($fishType->children()->exists()) {
            throw ValidationException::withMessages([
                'parent_id' => ["{$fishType->name} punya sub-jenis, jadi tidak bisa dijadikan sub-jenis dari yang lain."],
            ]);
        }

        $this->assertParentIsTopLevel($parentId);
    }

    /**
     * Nama harus unik di antara saudara sekandung: tidak boleh dua varian
     * bernama sama di bawah satu induk, dan tidak boleh dua jenis tingkat
     * atas bernama sama.
     *
     * Sengaja TIDAK unik global — "Jepang" di bawah Kohaku dan "Jepang" di
     * bawah Sanke adalah dua ikan berbeda, dan itu wajar.
     *
     * Perbandingan case-insensitive lewat LOWER() supaya konsisten di MySQL
     * (collation ci) maupun SQLite (default case-sensitive). Tidak dipasang
     * sebagai unique index karena MySQL menganggap NULL selalu berbeda,
     * sehingga jenis tingkat atas justru lolos.
     */
    private function assertNameUniqueAmongSiblings(string $name, ?int $parentId, ?int $ignoreId = null): void
    {
        $query = FishType::whereRaw('LOWER(TRIM(name)) = ?', [mb_strtolower(trim($name))]);

        $parentId === null
            ? $query->whereNull('parent_id')
            : $query->where('parent_id', $parentId);

        if ($ignoreId !== null) {
            $query->where('id', '!=', $ignoreId);
        }

        if (! $query->exists()) {
            return;
        }

        $scope = $parentId
            ? 'sub-jenis dari ' . (FishType::find($parentId)?->name ?? 'induk yang sama')
            : 'jenis tingkat atas';

        throw ValidationException::withMessages([
            'name' => ["Nama \"{$name}\" sudah dipakai {$scope}. Pakai nama lain agar tidak tertukar."],
        ]);
    }

    private function deleteImage(FishType $fishType): void
    {
        if ($fishType->image_path) {
            Storage::disk('public')->delete($fishType->image_path);
        }
    }
}
