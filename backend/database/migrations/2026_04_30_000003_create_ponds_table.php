<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('ponds', function (Blueprint $table) {
            $table->id();
            $table->foreignId('location_id')->constrained()->cascadeOnDelete();
            $table->foreignId('pond_category_id')->constrained()->restrictOnDelete();
            $table->string('code', 30)->unique()->comment('e.g. SKR-K01, KRT-K02, AQ-01');
            $table->string('name', 100);
            $table->unsignedSmallInteger('capacity')->nullable()->comment('kapasitas ekor');
            $table->unsignedSmallInteger('target_min_size_cm')->nullable();
            $table->unsignedSmallInteger('target_max_size_cm')->nullable();
            $table->unsignedSmallInteger('grow_duration_months')->nullable();
            $table->boolean('is_active')->default(true);
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['location_id', 'pond_category_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ponds');
    }
};
