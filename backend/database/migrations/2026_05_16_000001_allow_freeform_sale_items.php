<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Izinkan sale item tanpa batch (penjualan bebas / jenis ikan ketik manual).
 *
 * Perubahan sale_items:
 *   - batch_id      : jadi nullable (item tanpa stok = tidak potong inventori)
 *   - fish_type_id  : baru, nullable FK ke fish_types (jenis dari master data)
 *   - fish_name     : baru, nullable string (nama jenis ketik manual / snapshot)
 *
 * Item dengan batch_id tetap memotong stok seperti biasa. Item tanpa batch_id
 * hanya dicatat sebagai baris penjualan — stok inventori TIDAK berubah.
 */
return new class extends Migration {
    public function up(): void
    {
        $driver = DB::connection()->getDriverName();

        Schema::table('sale_items', function (Blueprint $table) {
            $table->foreignId('fish_type_id')
                ->nullable()
                ->after('batch_id')
                ->constrained('fish_types')
                ->nullOnDelete();
            $table->string('fish_name', 150)
                ->nullable()
                ->after('fish_type_id')
                ->comment('Nama jenis ikan ketik manual / snapshot, dipakai saat item tanpa batch');
        });

        if ($driver === 'mysql' || $driver === 'mariadb') {
            // FK sale_items_batch_id_foreign tetap; cukup ubah kolom jadi NULL
            DB::statement('ALTER TABLE sale_items MODIFY COLUMN batch_id BIGINT UNSIGNED NULL');
        } else {
            Schema::table('sale_items', function (Blueprint $table) {
                $table->foreignId('batch_id')->nullable()->change();
            });
        }
    }

    public function down(): void
    {
        $driver = DB::connection()->getDriverName();

        // Item tanpa batch tidak punya padanan saat kolom kembali NOT NULL
        DB::table('sale_items')->whereNull('batch_id')->delete();

        Schema::table('sale_items', function (Blueprint $table) {
            $table->dropConstrainedForeignId('fish_type_id');
            $table->dropColumn('fish_name');
        });

        if ($driver === 'mysql' || $driver === 'mariadb') {
            DB::statement('ALTER TABLE sale_items MODIFY COLUMN batch_id BIGINT UNSIGNED NOT NULL');
        } else {
            Schema::table('sale_items', function (Blueprint $table) {
                $table->foreignId('batch_id')->nullable(false)->change();
            });
        }
    }
};
