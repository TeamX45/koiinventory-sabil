<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('expenses', function (Blueprint $table) {
            $table->id();
            $table->string('code', 30)->unique();
            $table->date('expense_date');
            $table->foreignId('expense_category_id')->constrained()->restrictOnDelete();
            $table->foreignId('location_id')->nullable()->constrained()->nullOnDelete()
                ->comment('Lokasi/farm terkait, opsional');
            $table->string('description', 200);
            $table->decimal('amount', 14, 2);
            $table->string('paid_by', 100)->nullable()->comment('Nama orang/petugas yg bayar');
            $table->string('payment_method', 30)->nullable()->comment('cash, transfer, e-wallet, dll');
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('expense_date');
            $table->index(['expense_category_id', 'expense_date']);
            $table->index(['location_id', 'expense_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('expenses');
    }
};
