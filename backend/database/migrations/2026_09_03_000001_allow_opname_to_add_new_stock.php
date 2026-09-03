<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Izinkan stok opname memasukkan ikan yang belum ada di sistem.
 *
 * Sebelumnya opname selalu menempel ke satu batch: hanya bisa mengoreksi
 * jumlah yang sudah tercatat. Petugas yang menemukan ikan di kolam yang belum
 * pernah didata harus membuat barisnya dulu lewat Detail Kolam.
 *
 * Sekarang baris opname boleh belum punya batch. Ia menyimpan kolam dan
 * identitas ikannya; batch-nya baru dibuat saat opname diselesaikan. Draf yang
 * tidak jadi diselesaikan tidak meninggalkan batch kosong di daftar stok.
 */
return new class extends Migration {
    public function up(): void
    {
        $driver = DB::connection()->getDriverName();

        Schema::table('stock_opnames', function (Blueprint $table) {
            $table->foreignId('pond_id')
                ->nullable()
                ->after('batch_id')
                ->constrained()
                ->restrictOnDelete()
                ->comment('Kolam temuan fisik, dipakai saat baris belum punya batch');
            $table->foreignId('fish_type_id')
                ->nullable()
                ->after('pond_id')
                ->constrained()
                ->nullOnDelete();
            $table->foreignId('grade_id')
                ->nullable()
                ->after('fish_type_id')
                ->constrained()
                ->nullOnDelete();
            $table->unsignedSmallInteger('size_cm')->nullable()->after('grade_id');
            $table->decimal('price_per_fish', 12, 2)->nullable()->after('size_cm');
        });

        if ($driver === 'mysql' || $driver === 'mariadb') {
            // FK stock_opnames_batch_id_foreign tetap; cukup ubah kolom jadi NULL.
            DB::statement('ALTER TABLE stock_opnames MODIFY COLUMN batch_id BIGINT UNSIGNED NULL');
        } else {
            Schema::table('stock_opnames', function (Blueprint $table) {
                $table->foreignId('batch_id')->nullable()->change();
            });
        }
    }

    public function down(): void
    {
        $driver = DB::connection()->getDriverName();

        // Baris temuan fisik tidak punya padanan saat kolom kembali NOT NULL.
        DB::table('stock_opnames')->whereNull('batch_id')->delete();

        Schema::table('stock_opnames', function (Blueprint $table) {
            $table->dropConstrainedForeignId('pond_id');
            $table->dropConstrainedForeignId('fish_type_id');
            $table->dropConstrainedForeignId('grade_id');
            $table->dropColumn(['size_cm', 'price_per_fish']);
        });

        if ($driver === 'mysql' || $driver === 'mariadb') {
            DB::statement('ALTER TABLE stock_opnames MODIFY COLUMN batch_id BIGINT UNSIGNED NOT NULL');
        } else {
            Schema::table('stock_opnames', function (Blueprint $table) {
                $table->foreignId('batch_id')->nullable(false)->change();
            });
        }
    }
};
