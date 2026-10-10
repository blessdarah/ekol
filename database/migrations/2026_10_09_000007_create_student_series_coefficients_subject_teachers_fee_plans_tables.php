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
        Schema::create('student_series', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('student_id')->constrained('students')->cascadeOnDelete();
            $table->foreignUuid('series_id')->constrained('series')->cascadeOnDelete();
            $table->foreignUuid('term_id')->constrained('terms')->cascadeOnDelete();
            $table->foreignUuid('chosen_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamptz('chosen_at')->useCurrent();
            $table->timestampsTz();

            $table->unique(['student_id', 'term_id']);
        });

        Schema::create('coefficients', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('subject_id')->constrained('subjects')->cascadeOnDelete();
            $table->foreignUuid('level_id')->constrained('levels')->cascadeOnDelete();
            $table->decimal('sequence_coeff', 3, 1);
            $table->decimal('exam_coeff', 3, 1);
            $table->uuid('current_version_id')->nullable();
            $table->string('status')->default('draft');
            $table->timestamptz('last_reviewed_at')->nullable();
            $table->timestampsTz();

            $table->unique(['subject_id', 'level_id']);
        });

        Schema::create('subject_teachers', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('subject_id')->constrained('subjects')->cascadeOnDelete();
            $table->foreignUuid('staff_id')->constrained('users')->cascadeOnDelete();
            $table->string('role')->default('backup');
            $table->timestamptz('assigned_at')->useCurrent();
            $table->timestamptz('released_at')->nullable();
            $table->timestampsTz();
        });

        Schema::create('fee_plans', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('school_id')->constrained('schools')->cascadeOnDelete();
            $table->foreignUuid('level_id')->constrained('levels')->cascadeOnDelete();
            $table->foreignUuid('academic_year_id')->constrained('academic_years')->restrictOnDelete();
            $table->decimal('annual_amount', 10, 2);
            $table->char('currency', 3);
            $table->boolean('is_active')->default(true);
            $table->timestampsTz();

            $table->unique(['school_id', 'level_id', 'academic_year_id']);
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE coefficients ADD CONSTRAINT coefficients_status_check CHECK (status IN ('draft', 'pending', 'complete'))");
            DB::statement("ALTER TABLE subject_teachers ADD CONSTRAINT subject_teachers_role_check CHECK (role IN ('lead', 'backup'))");
        }

        if (in_array(DB::getDriverName(), ['pgsql', 'sqlite'], true)) {
            DB::statement("CREATE UNIQUE INDEX subject_teachers_one_lead_per_subject ON subject_teachers (subject_id) WHERE role = 'lead' AND released_at IS NULL");
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('fee_plans');
        Schema::dropIfExists('subject_teachers');
        Schema::dropIfExists('coefficients');
        Schema::dropIfExists('student_series');
    }
};
