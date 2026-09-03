<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Setelan aplikasi yang boleh diubah dari halaman Pengaturan, tanpa menyentuh
 * berkas .env. Di produksi .env di-mount read-only ke dalam container, jadi
 * menulis ke sana dari aplikasi memang tidak mungkin.
 *
 * Nilai rahasia (kunci API) disimpan terenkripsi lewat cast 'encrypted' di
 * model, memakai APP_KEY.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::create('app_settings', function (Blueprint $table) {
            $table->string('key', 100)->primary();
            $table->text('value')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('app_settings');
    }
};
