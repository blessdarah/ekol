<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('demo_requests', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('school_name');
            $table->string('role');
            $table->string('students');
            $table->string('whatsapp');
            $table->string('locale', 5)->default('en');
            $table->timestampTz('handled_at')->nullable();
            $table->timestampsTz();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('demo_requests');
    }
};
