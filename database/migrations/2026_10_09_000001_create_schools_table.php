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
        Schema::create('schools', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name')->unique();
            $table->string('code');
            $table->string('slug')->unique();
            $table->string('ownership')->default('government');
            $table->string('region')->nullable();
            $table->string('town')->nullable();
            $table->string('cycle')->nullable();
            $table->string('subsystem')->nullable();
            $table->char('currency', 3);
            $table->string('timezone');
            $table->timestampsTz();
            $table->softDeletesTz();
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE schools ADD CONSTRAINT schools_cycle_check CHECK (cycle IN ('primary', 'secondary', 'high_school'))");
            DB::statement("ALTER TABLE schools ADD CONSTRAINT schools_ownership_check CHECK (ownership IN ('government', 'mission', 'private'))");
        }

        Schema::create('academic_years', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('school_id')->constrained('schools')->cascadeOnDelete();
            $table->string('label');
            $table->date('starts_on');
            $table->date('ends_on');
            $table->string('status')->default('planned');
            $table->timestamptz('created_at')->useCurrent();

            $table->unique(['school_id', 'label']);
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE academic_years ADD CONSTRAINT academic_years_status_check CHECK (status IN ('planned', 'current', 'closed'))");
        }

        if (in_array(DB::getDriverName(), ['pgsql', 'sqlite'], true)) {
            DB::statement("CREATE UNIQUE INDEX academic_years_one_current_per_school ON academic_years (school_id) WHERE status = 'current'");
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('academic_years');
        Schema::dropIfExists('schools');
    }
};
