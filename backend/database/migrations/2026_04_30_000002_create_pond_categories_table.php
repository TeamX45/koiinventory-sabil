<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('pond_categories', function (Blueprint $table) {
            $table->id();
            $table->string('code', 30)->unique();
            $table->string('name', 100);
            $table->text('description')->nullable();
            $table->boolean('is_breeding')->default(false)->comment('true untuk aquarium penangkaran');
            $table->boolean('is_grow_out')->default(false)->comment('true untuk kolam pembesaran');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pond_categories');
    }
};
