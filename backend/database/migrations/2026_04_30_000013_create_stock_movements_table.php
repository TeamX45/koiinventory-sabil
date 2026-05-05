<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('stock_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('batch_id')->constrained()->cascadeOnDelete();
            $table->enum('type', ['in', 'out', 'transfer', 'sort_in', 'sort_out', 'death', 'adjustment'])
                ->comment('in=masuk(beli/panen), out=keluar(jual), transfer=pindah kolam, sort_*=hasil sortir, death=mati, adjustment=koreksi');
            $table->foreignId('from_pond_id')->nullable()->constrained('ponds')->nullOnDelete();
            $table->foreignId('to_pond_id')->nullable()->constrained('ponds')->nullOnDelete();
            $table->integer('count')->comment('Boleh negatif untuk koreksi');

            $table->string('reference_type', 50)->nullable()->comment('Purchase, Harvest, Sorting, Sale, Mortality');
            $table->unsignedBigInteger('reference_id')->nullable();

            $table->date('movement_date');
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['batch_id', 'movement_date']);
            $table->index(['reference_type', 'reference_id']);
            $table->index('type');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_movements');
    }
};
