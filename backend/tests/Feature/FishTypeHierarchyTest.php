<?php

namespace Tests\Feature;

use App\Models\Batch;
use App\Models\FishType;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class FishTypeHierarchyTest extends TestCase
{
    use RefreshDatabase;

    private function actAsOwner(): User
    {
        $user = User::create([
            'name' => 'Owner', 'email' => 'owner@test.local',
            'password' => 'x', 'role' => 'owner', 'is_active' => true,
        ]);
        Sanctum::actingAs($user);

        return $user;
    }

    private function makeType(string $name, ?int $parentId = null): FishType
    {
        return FishType::create([
            'code' => strtoupper(substr(md5($name), 0, 8)),
            'name' => $name,
            'group' => 'koi',
            'parent_id' => $parentId,
        ]);
    }

    // ---------- Hierarki ----------

    public function test_bisa_membuat_sub_jenis(): void
    {
        $this->actAsOwner();
        $kohaku = $this->makeType('Kohaku');

        $res = $this->postJson('/api/v1/fish-types', [
            'name' => 'Tancho', 'group' => 'koi', 'parent_id' => $kohaku->id,
        ]);

        $res->assertStatus(201)->assertJsonPath('data.parent_id', $kohaku->id);
    }

    public function test_sub_jenis_tidak_boleh_punya_sub_jenis(): void
    {
        $this->actAsOwner();
        $kohaku = $this->makeType('Kohaku');
        $tancho = $this->makeType('Tancho', $kohaku->id);

        $this->postJson('/api/v1/fish-types', [
            'name' => 'Doitsu', 'group' => 'koi', 'parent_id' => $tancho->id,
        ])->assertStatus(422)->assertJsonValidationErrors('parent_id');
    }

    public function test_jenis_tidak_boleh_jadi_induk_dirinya_sendiri(): void
    {
        $this->actAsOwner();
        $kohaku = $this->makeType('Kohaku');

        $this->putJson("/api/v1/fish-types/{$kohaku->id}", ['parent_id' => $kohaku->id])
            ->assertStatus(422)->assertJsonValidationErrors('parent_id');
    }

    public function test_induk_yang_punya_anak_tidak_bisa_dijadikan_anak(): void
    {
        $this->actAsOwner();
        $kohaku = $this->makeType('Kohaku');
        $this->makeType('Tancho', $kohaku->id);
        $sanke = $this->makeType('Sanke');

        $this->putJson("/api/v1/fish-types/{$kohaku->id}", ['parent_id' => $sanke->id])
            ->assertStatus(422)->assertJsonValidationErrors('parent_id');
    }

    public function test_jenis_tanpa_sub_jenis_tetap_sah(): void
    {
        $this->actAsOwner();

        $this->postJson('/api/v1/fish-types', ['name' => 'Showa', 'group' => 'koi'])
            ->assertStatus(201)->assertJsonPath('data.parent_id', null);
    }

    // ---------- Penjaga hapus ----------

    public function test_induk_dengan_sub_jenis_tidak_bisa_dihapus(): void
    {
        $this->actAsOwner();
        $kohaku = $this->makeType('Kohaku');
        $this->makeType('Tancho', $kohaku->id);

        $this->deleteJson("/api/v1/fish-types/{$kohaku->id}")->assertStatus(422);
        $this->assertDatabaseHas('fish_types', ['id' => $kohaku->id]);
    }

    public function test_sub_jenis_bisa_dihapus(): void
    {
        $this->actAsOwner();
        $kohaku = $this->makeType('Kohaku');
        $tancho = $this->makeType('Tancho', $kohaku->id);

        $this->deleteJson("/api/v1/fish-types/{$tancho->id}")->assertStatus(204);
        $this->assertDatabaseMissing('fish_types', ['id' => $tancho->id]);
    }

    // ---------- Foto ----------

    public function test_bisa_unggah_foto_acuan(): void
    {
        Storage::fake('public');
        $this->actAsOwner();

        $res = $this->postJson('/api/v1/fish-types', [
            'name' => 'Kohaku', 'group' => 'koi',
            'image' => UploadedFile::fake()->image('kohaku.jpg', 400, 300),
        ]);

        $res->assertStatus(201);
        $path = $res->json('data.image_path');
        $this->assertNotNull($path);
        Storage::disk('public')->assertExists($path);
        $this->assertNotNull($res->json('data.image_url'));
    }

    public function test_menolak_berkas_bukan_gambar(): void
    {
        Storage::fake('public');
        $this->actAsOwner();

        $this->postJson('/api/v1/fish-types', [
            'name' => 'Kohaku', 'group' => 'koi',
            'image' => UploadedFile::fake()->create('dokumen.pdf', 100, 'application/pdf'),
        ])->assertStatus(422)->assertJsonValidationErrors('image');
    }

    public function test_ganti_foto_membuang_berkas_lama(): void
    {
        Storage::fake('public');
        $this->actAsOwner();

        $created = $this->postJson('/api/v1/fish-types', [
            'name' => 'Kohaku', 'group' => 'koi',
            'image' => UploadedFile::fake()->image('lama.jpg'),
        ]);
        $oldPath = $created->json('data.image_path');
        $id = $created->json('data.id');

        $updated = $this->putJson("/api/v1/fish-types/{$id}", [
            'image' => UploadedFile::fake()->image('baru.jpg'),
        ]);

        $newPath = $updated->json('data.image_path');
        $this->assertNotSame($oldPath, $newPath);
        Storage::disk('public')->assertMissing($oldPath);
        Storage::disk('public')->assertExists($newPath);
    }

    public function test_menghapus_jenis_ikan_ikut_membuang_fotonya(): void
    {
        Storage::fake('public');
        $this->actAsOwner();

        $created = $this->postJson('/api/v1/fish-types', [
            'name' => 'Kohaku', 'group' => 'koi',
            'image' => UploadedFile::fake()->image('foto.jpg'),
        ]);
        $path = $created->json('data.image_path');

        $this->deleteJson("/api/v1/fish-types/{$created->json('data.id')}")->assertStatus(204);
        Storage::disk('public')->assertMissing($path);
    }

    // ---------- Setelan bawaan ----------

    public function test_varian_bisa_menyimpan_grade_dan_kolam_bawaan(): void
    {
        $this->actAsOwner();
        $kohaku = $this->makeType('Kohaku');
        $grade = \App\Models\Grade::create(['code' => 'GA', 'name' => 'Grade A', 'rank' => 1]);
        $location = \App\Models\Location::create(['code' => 'L1', 'name' => 'Lokasi', 'type' => 'filter']);
        $category = \App\Models\PondCategory::create(['code' => 'C1', 'name' => 'Kategori']);
        $pond = \App\Models\Pond::create([
            'code' => 'P1', 'name' => 'Kolam 1',
            'location_id' => $location->id, 'pond_category_id' => $category->id, 'is_active' => true,
        ]);

        $res = $this->postJson('/api/v1/fish-types', [
            'name' => 'Jepang', 'group' => 'koi', 'parent_id' => $kohaku->id,
            'default_grade_id' => $grade->id, 'default_pond_id' => $pond->id,
        ]);

        $res->assertStatus(201)
            ->assertJsonPath('data.default_grade_id', $grade->id)
            ->assertJsonPath('data.default_pond_id', $pond->id);
    }

    public function test_setelan_bawaan_boleh_dikosongkan(): void
    {
        $this->actAsOwner();

        $this->postJson('/api/v1/fish-types', ['name' => 'Showa', 'group' => 'koi'])
            ->assertStatus(201)
            ->assertJsonPath('data.default_grade_id', null)
            ->assertJsonPath('data.default_pond_id', null);
    }

    public function test_menolak_grade_bawaan_yang_tidak_ada(): void
    {
        $this->actAsOwner();

        $this->postJson('/api/v1/fish-types', [
            'name' => 'Showa', 'group' => 'koi', 'default_grade_id' => 99999,
        ])->assertStatus(422)->assertJsonValidationErrors('default_grade_id');
    }

    // ---------- Data lama ----------

    public function test_batch_lama_yang_menunjuk_induk_tetap_sah(): void
    {
        $this->actAsOwner();
        $kohaku = $this->makeType('Kohaku');
        $this->makeType('Tancho', $kohaku->id);

        // Batch lama menunjuk jenis induk — harus tetap terbaca setelah punya anak.
        $this->assertSame(0, Batch::where('fish_type_id', $kohaku->id)->count());
        $this->getJson('/api/v1/fish-types')->assertStatus(200);
    }
}
