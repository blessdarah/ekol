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
        Schema::create('assessment_subjects', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('assessment_id')->constrained('assessments')->cascadeOnDelete();
            $table->foreignUuid('subject_id')->constrained('subjects')->cascadeOnDelete();
            $table->foreignUuid('coefficient_id')->constrained('coefficients')->restrictOnDelete();
            $table->decimal('max_score', 5, 1);
            $table->foreignUuid('examiner_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('venue')->nullable();
            $table->timestampsTz();

            $table->unique(['assessment_id', 'subject_id']);
        });

        Schema::create('marks', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('assessment_subject_id')->constrained('assessment_subjects')->cascadeOnDelete();
            $table->foreignUuid('student_id')->constrained('students')->cascadeOnDelete();
            $table->decimal('score', 5, 1)->nullable();
            $table->foreignUuid('grade_band_id')->nullable()->constrained('grade_bands')->nullOnDelete();
            $table->boolean('is_absent')->default(false);
            $table->text('remark')->nullable();
            $table->foreignUuid('entered_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamptz('entered_at')->useCurrent();
            $table->timestampsTz();

            $table->unique(['assessment_subject_id', 'student_id']);
        });

        Schema::create('reports', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('student_id')->constrained('students')->cascadeOnDelete();
            $table->foreignUuid('term_id')->constrained('terms')->cascadeOnDelete();
            $table->smallInteger('class_position')->nullable();
            $table->decimal('total_score', 6, 2);
            $table->text('head_teacher_remark');
            $table->date('next_term_opens_on')->nullable();
            $table->timestamptz('published_at')->useCurrent();
            $table->timestamptz('voided_at')->nullable();

            $table->unique(['student_id', 'term_id']);
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE marks ADD CONSTRAINT marks_score_check CHECK (score IS NULL OR score >= 0)');
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('reports');
        Schema::dropIfExists('marks');
        Schema::dropIfExists('assessment_subjects');
    }
};
