<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('sorting_results', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sorting_id')->constrained()->cascadeOnDelete();
            $table->foreignId('grade_id')->constrained()->restrictOnDelete();
            $table->foreignId('target_pond_id')->constrained('ponds')->restrictOnDelete();
            $table->foreignId('fish_type_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('target_batch_id')->nullable()->constrained('batches')->nullOnDelete()
                ->comment('Batch baru hasil pecahan, di-create saat sorting di-complete');
            $table->unsignedInteger('count');
            $table->decimal('price_per_fish', 12, 2)->comment('Harga per ekor di tahap ini');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['sorting_id', 'grade_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sorting_results');
    }
};
