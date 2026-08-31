<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;

/**
 * Allow batch dibuat tanpa source (purchase/harvest/sorting), agar Stok Opname
 * bisa membuat initial batch langsung di kolam kosong.
 *
 * Perubahan:
 *   - batches.source_type: tambah 'manual' dan 'opname' ke enum
 *   - batches.source_id: jadi nullable (untuk source_type 'manual'/'opname')
 */
return new class extends Migration {
    public function up(): void
    {
        $driver = DB::connection()->getDriverName();

        if ($driver === 'mysql' || $driver === 'mariadb') {
            // MySQL/MariaDB: ALTER ENUM langsung
            DB::statement("
                ALTER TABLE batches
                MODIFY COLUMN source_type ENUM('purchase','harvest','sorting','manual','opname')
                NOT NULL
                COMMENT 'purchase=beli supplier, harvest=panen sendiri, sorting=hasil pecahan sortir, manual=stok awal manual, opname=set via stok opname'
            ");

            Schema::table('batches', function (Blueprint $table) {
                $table->unsignedBigInteger('source_id')
                    ->nullable()
                    ->comment('id purchase/harvest/sorting; null untuk source_type=manual/opname')
                    ->change();
            });
        } else {
            // SQLite/Postgres: tidak ada tipe ENUM asli — Laravel menuliskannya
            // sebagai varchar + CHECK constraint yang hanya mengizinkan tiga nilai
            // lama, jadi 'manual'/'opname' ikut ditolak. Ubah ke string biasa
            // (nilai divalidasi di app layer) sekaligus buat source_id nullable.
            //
            // Laravel 11+ menangani perubahan kolom SQLite dengan rebuild tabel
            // secara native, jadi tidak butuh doctrine/dbal.
            Schema::table('batches', function (Blueprint $table) {
                $table->string('source_type', 20)->nullable(false)->change();
                $table->unsignedBigInteger('source_id')->nullable()->change();
            });
        }
    }

    public function down(): void
    {
        $driver = DB::connection()->getDriverName();
        if ($driver !== 'mysql' && $driver !== 'mariadb') {
            return;
        }

        // Hapus dulu batch dengan source_type 'manual'/'opname' supaya enum bisa diciutkan
        DB::statement("DELETE FROM batches WHERE source_type IN ('manual','opname')");

        DB::statement("
            ALTER TABLE batches
            MODIFY COLUMN source_type ENUM('purchase','harvest','sorting')
            NOT NULL
        ");

        Schema::table('batches', function (Blueprint $table) {
            $table->unsignedBigInteger('source_id')
                ->nullable(false)
                ->change();
        });
    }
};
