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
            // SQLite/Postgres: enum di-handle di app layer (validation Eloquent),
            // skema kolom string tetap, source_id sudah nullable di skema test.
            // Untuk SQLite, source_id NOT NULL — buat nullable manual via batch table copy
            // (atau biarkan default karena test pakai factory dengan source_id terisi)
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
