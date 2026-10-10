<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('school_classes', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('school_id')->constrained('schools')->cascadeOnDelete();
            $table->foreignUuid('academic_year_id')->constrained('academic_years')->cascadeOnDelete();
            $table->foreignUuid('level_id')->constrained('levels')->cascadeOnDelete();
            $table->string('name');
            $table->foreignUuid('form_master_id')->nullable()->constrained('users')->nullOnDelete();
            $table->smallInteger('capacity');
            $table->string('stream')->nullable();
            $table->timestampsTz();
            $table->softDeletesTz();

            $table->unique(['academic_year_id', 'level_id', 'name']);
        });

        Schema::create('series', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('school_id')->constrained('schools')->cascadeOnDelete();
            $table->foreignUuid('level_id')->constrained('levels')->cascadeOnDelete();
            $table->string('name');
            $table->string('code');
            $table->boolean('is_open')->default(true);
            $table->timestampsTz();
            $table->softDeletesTz();

            $table->unique(['level_id', 'name']);
        });

        Schema::create('subjects', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('school_id')->constrained('schools')->cascadeOnDelete();
            $table->string('code');
            $table->string('name');
            $table->string('department');
            $table->smallInteger('weekly_periods');
            $table->boolean('is_theory_practical')->default(false);
            $table->timestampsTz();
            $table->softDeletesTz();

            $table->unique(['school_id', 'code']);
        });

        Schema::create('rooms', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('school_id')->constrained('schools')->cascadeOnDelete();
            $table->string('code');
            $table->string('name');
            $table->smallInteger('capacity');
            $table->string('kind');
            $table->timestampsTz();
            $table->softDeletesTz();

            $table->unique(['school_id', 'code']);
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE rooms ADD CONSTRAINT rooms_kind_check CHECK (kind IN ('classroom', 'laboratory', 'library', 'hall', 'office'))");
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('rooms');
        Schema::dropIfExists('subjects');
        Schema::dropIfExists('series');
        Schema::dropIfExists('school_classes');
    }
};
