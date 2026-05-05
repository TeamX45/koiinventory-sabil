<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('batches', function (Blueprint $table) {
            $table->id();
            $table->string('code', 40)->unique()->comment('e.g. BTC-202604-0001');

            // polymorphic-like asal (purchase atau harvest atau hasil sortir)
            $table->enum('source_type', ['purchase', 'harvest', 'sorting'])
                ->comment('purchase=beli supplier, harvest=panen sendiri, sorting=hasil pecahan sortir');
            $table->unsignedBigInteger('source_id')->comment('id purchase/harvest/sorting');

            $table->foreignId('parent_batch_id')->nullable()->constrained('batches')->nullOnDelete()
                ->comment('Untuk batch hasil sortir, refer ke batch borong asalnya');

            $table->foreignId('pond_id')->constrained()->restrictOnDelete();
            $table->foreignId('fish_type_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('grade_id')->nullable()->constrained()->nullOnDelete()
                ->comment('NULL untuk batch borong yang belum disortir');

            $table->unsignedInteger('initial_count');
            $table->unsignedInteger('current_count')->comment('berkurang saat jual/mati/transfer');

            $table->decimal('price_per_fish', 12, 2)->nullable()
                ->comment('NULL untuk batch borong; terisi setelah sortir');

            $table->date('entry_date');
            $table->enum('status', ['active', 'depleted', 'archived'])->default('active');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['source_type', 'source_id']);
            $table->index(['pond_id', 'status']);
            $table->index(['grade_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('batches');
    }
};
