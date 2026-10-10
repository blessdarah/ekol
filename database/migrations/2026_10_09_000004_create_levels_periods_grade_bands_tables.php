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
        Schema::create('levels', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('school_id')->constrained('schools')->cascadeOnDelete();
            $table->string('name');
            $table->smallInteger('ordinal');
            $table->string('cycle');
            $table->string('subsystem')->nullable();
            $table->boolean('uses_series')->default(false);
            $table->timestampsTz();
            $table->softDeletesTz();

            $table->unique(['school_id', 'name']);
        });

        Schema::create('periods', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('school_id')->constrained('schools')->cascadeOnDelete();
            $table->string('label');
            $table->smallInteger('ordinal');
            $table->time('starts_at');
            $table->time('ends_at');
            $table->boolean('is_break')->default(false);
            $table->timestampsTz();
            $table->softDeletesTz();

            $table->unique(['school_id', 'ordinal']);
        });

        Schema::create('grade_bands', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('school_id')->constrained('schools')->cascadeOnDelete();
            $table->char('letter', 2);
            $table->decimal('from_percent', 5, 2);
            $table->decimal('to_percent', 5, 2);
            $table->text('meaning');
            $table->text('standard_remark');
            $table->smallInteger('rank_order');
            $table->timestampsTz();

            $table->unique(['school_id', 'letter']);
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE levels ADD CONSTRAINT levels_cycle_check CHECK (cycle IN ('primary', 'secondary', 'high_school'))");
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('grade_bands');
        Schema::dropIfExists('periods');
        Schema::dropIfExists('levels');
    }
};
