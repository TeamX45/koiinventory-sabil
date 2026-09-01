<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Sub-jenis ikan + foto acuan.
 *
 * parent_id: hierarki induk-anak sederhana (adjacency list) di tabel yang sama.
 * Kohaku Tancho menunjuk ke Kohaku. Kedalaman dibatasi 2 tingkat di app layer
 * (lihat FishTypeController) — anak tidak boleh punya anak.
 *
 * Sengaja TIDAK mengubah kolom fish_type_id di batches/sorting_results, supaya
 * data lama yang menunjuk jenis induk tetap sah. Sub-jenis bersifat opsional.
 *
 * image_path: path relatif di disk 'public', mis. "fish-types/abc123.jpg".
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('fish_types', function (Blueprint $table) {
            $table->foreignId('parent_id')
                ->nullable()
                ->after('id')
                ->constrained('fish_types')
                ->nullOnDelete()
                ->comment('Induk jenis ikan; null = jenis tingkat atas');

            $table->string('image_path')->nullable()->after('description')
                ->comment('Path relatif foto acuan di disk public');
        });
    }

    public function down(): void
    {
        Schema::table('fish_types', function (Blueprint $table) {
            $table->dropConstrainedForeignId('parent_id');
            $table->dropColumn('image_path');
        });
    }
};
