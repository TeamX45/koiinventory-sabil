<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Audit log: catat aksi penting di entitas inti agar bisa ditelusuri.
 * Polymorphic ke subject_type/subject_id supaya 1 tabel cover banyak model.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('action', 30); // created, updated, deleted, completed, transferred, etc.
            $table->string('subject_type', 100);
            $table->unsignedBigInteger('subject_id');
            $table->json('changes')->nullable(); // before/after diff
            $table->json('meta')->nullable();    // extra context (IP, user-agent, dll)
            $table->timestamp('created_at')->useCurrent();

            $table->index(['subject_type', 'subject_id']);
            $table->index(['user_id', 'created_at']);
            $table->index('action');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
    }
};
