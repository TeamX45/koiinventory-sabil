<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('grades', function (Blueprint $table) {
            $table->id();
            $table->string('code', 20)->unique()->comment('SHOW, A, B');
            $table->string('name', 50);
            $table->unsignedTinyInteger('rank')->comment('1 = terbaik (Show Quality), 3 = terendah (Grade B)');
            $table->text('description')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('grades');
    }
};
