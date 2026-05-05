<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('purchases', function (Blueprint $table) {
            $table->id();
            $table->string('code', 30)->unique()->comment('Nomor PO, e.g. PO-202604-0001');
            $table->foreignId('supplier_id')->constrained()->restrictOnDelete();
            $table->date('purchase_date');
            $table->unsignedInteger('total_count')->comment('Total ekor borong');
            $table->decimal('subtotal', 14, 2)->comment('Harga borong total');
            $table->decimal('avg_price_per_fish', 12, 2)->storedAs('subtotal / NULLIF(total_count, 0)');
            $table->enum('status', ['pending', 'received', 'sorted', 'cancelled'])->default('pending')
                ->comment('pending=baru order, received=sudah masuk belum sortir, sorted=sudah disortir');
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['supplier_id', 'purchase_date']);
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('purchases');
    }
};
