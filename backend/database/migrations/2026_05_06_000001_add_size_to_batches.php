<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tambah ukuran ikan ke batch.
 * - size_cm: ukuran tunggal atau batas bawah rentang
 * - size_max_cm: nullable; jika diisi = batas atas rentang (mis. 25 s/d 35 cm)
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('batches', function (Blueprint $table) {
            $table->unsignedSmallInteger('size_cm')->nullable()->after('current_count')
                ->comment('Ukuran ikan dalam cm. Nullable krn ukuran kadang belum diukur.');
            $table->unsignedSmallInteger('size_max_cm')->nullable()->after('size_cm')
                ->comment('Batas atas rentang ukuran. Null = ukuran tunggal.');
        });
    }

    public function down(): void
    {
        Schema::table('batches', function (Blueprint $table) {
            $table->dropColumn(['size_cm', 'size_max_cm']);
        });
    }
};
