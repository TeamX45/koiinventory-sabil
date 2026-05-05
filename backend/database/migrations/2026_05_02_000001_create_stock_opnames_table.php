<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('stock_opnames', function (Blueprint $table) {
            $table->id();
            $table->string('code', 30)->unique();
            $table->foreignId('batch_id')->constrained()->restrictOnDelete();
            $table->date('opname_date');
            $table->unsignedInteger('system_count')->comment('Stok sistem saat opname');
            $table->unsignedInteger('actual_count')->comment('Stok hasil hitung fisik');
            $table->integer('difference')->comment('actual - system (boleh negatif)');
            $table->enum('status', ['draft', 'completed', 'cancelled'])->default('draft');
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['batch_id', 'opname_date']);
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_opnames');
    }
};
