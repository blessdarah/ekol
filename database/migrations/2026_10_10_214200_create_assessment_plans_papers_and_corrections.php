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
        Schema::create('assessment_plans', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('school_id')->constrained('schools')->cascadeOnDelete();
            $table->foreignUuid('term_id')->constrained('terms')->cascadeOnDelete();
            $table->string('kind');
            $table->string('name');
            $table->string('state')->default('draft');
            $table->date('held_from')->nullable();
            $table->date('held_until')->nullable();
            $table->date('window_starts_on')->nullable();
            $table->date('window_ends_on')->nullable();
            $table->jsonb('level_ids');
            $table->timestampTz('schedule_published_at')->nullable();
            $table->timestampTz('closed_at')->nullable();
            $table->timestampTz('published_at')->nullable();
            $table->foreignUuid('published_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampsTz();

            $table->unique(['term_id', 'name']);
        });

        Schema::table('assessments', function (Blueprint $table) {
            $table->foreignUuid('assessment_plan_id')->nullable()->constrained('assessment_plans')->cascadeOnDelete();
        });

        Schema::table('assessment_subjects', function (Blueprint $table) {
            $table->timestampTz('submitted_at')->nullable();
            $table->foreignUuid('submitted_by')->nullable()->constrained('users')->nullOnDelete();
        });

        Schema::create('exam_papers', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('assessment_plan_id')->constrained('assessment_plans')->cascadeOnDelete();
            $table->foreignUuid('level_id')->constrained('levels')->cascadeOnDelete();
            $table->foreignUuid('subject_id')->constrained('subjects')->cascadeOnDelete();
            $table->date('held_on');
            $table->time('starts_at');
            $table->decimal('hours', 3, 1);
            $table->foreignUuid('room_id')->nullable()->constrained('rooms')->nullOnDelete();
            $table->jsonb('invigilator_ids');
            $table->timestampsTz();

            $table->unique(['assessment_plan_id', 'level_id', 'subject_id']);
        });

        Schema::create('mark_corrections', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('school_id')->constrained('schools')->cascadeOnDelete();
            $table->foreignUuid('mark_id')->constrained('marks')->cascadeOnDelete();
            $table->string('reference');
            $table->decimal('old_score', 5, 2)->nullable();
            $table->decimal('new_score', 5, 2);
            $table->text('reason');
            $table->string('status')->default('pending');
            $table->foreignUuid('requested_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignUuid('decided_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('decided_at')->nullable();
            $table->string('note')->nullable();
            $table->timestampsTz();

            $table->unique(['school_id', 'reference']);
        });

        Schema::table('schools', function (Blueprint $table) {
            $table->decimal('pass_mark', 4, 2)->default(10);
        });

        // Marks are entered to the quarter point: 13.50, 7.25.
        Schema::table('marks', function (Blueprint $table) {
            $table->decimal('score', 5, 2)->nullable()->change();
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE assessment_plans ADD CONSTRAINT assessment_plans_kind_check CHECK (kind IN ('sequence', 'exam'))");
            DB::statement("ALTER TABLE assessment_plans ADD CONSTRAINT assessment_plans_state_check CHECK (state IN ('draft', 'scheduled', 'marks_open', 'marks_closed', 'published'))");
            DB::statement("ALTER TABLE mark_corrections ADD CONSTRAINT mark_corrections_status_check CHECK (status IN ('pending', 'approved', 'declined'))");
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('marks', function (Blueprint $table) {
            $table->decimal('score', 5, 1)->nullable()->change();
        });

        Schema::table('schools', function (Blueprint $table) {
            $table->dropColumn('pass_mark');
        });

        Schema::dropIfExists('mark_corrections');
        Schema::dropIfExists('exam_papers');

        Schema::table('assessment_subjects', function (Blueprint $table) {
            $table->dropConstrainedForeignId('submitted_by');
            $table->dropColumn('submitted_at');
        });

        Schema::table('assessments', function (Blueprint $table) {
            $table->dropConstrainedForeignId('assessment_plan_id');
        });

        Schema::dropIfExists('assessment_plans');
    }
};
