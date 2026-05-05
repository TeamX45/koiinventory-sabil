<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('harvests', function (Blueprint $table) {
            $table->id();
            $table->string('code', 30)->unique()->comment('e.g. HRV-202604-0001');
            $table->foreignId('source_pond_id')->constrained('ponds')->restrictOnDelete()
                ->comment('Kolam tanah asal panen (Keramat/Penican)');
            $table->date('harvest_date');
            $table->unsignedInteger('total_count');
            $table->enum('status', ['pending', 'harvested', 'sorted', 'cancelled'])->default('pending');
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['source_pond_id', 'harvest_date']);
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('harvests');
    }
};
