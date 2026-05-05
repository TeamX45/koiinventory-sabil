<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('sortings', function (Blueprint $table) {
            $table->id();
            $table->string('code', 30)->unique()->comment('e.g. SRT-202604-0001');
            $table->foreignId('source_batch_id')->constrained('batches')->restrictOnDelete()
                ->comment('Batch borong yang akan disortir');
            $table->date('sorting_date');
            $table->unsignedInteger('total_sorted')->default(0)->comment('Total ekor hasil distribusi');
            $table->unsignedInteger('total_loss')->default(0)->comment('Selisih ekor (mati saat sortir, dll)');
            $table->enum('status', ['draft', 'completed', 'cancelled'])->default('draft');
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['source_batch_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sortings');
    }
};
