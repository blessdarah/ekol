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
        Schema::create('coefficient_versions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('coefficient_id')->constrained('coefficients')->cascadeOnDelete();
            $table->smallInteger('version');
            $table->decimal('sequence_coeff', 3, 1);
            $table->decimal('exam_coeff', 3, 1);
            $table->foreignUuid('effective_term_id')->constrained('terms')->cascadeOnDelete();
            $table->foreignUuid('changed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamptz('changed_at')->useCurrent();
            $table->text('reason');

            $table->unique(['coefficient_id', 'version']);
        });

        Schema::create('invoices', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('student_id')->constrained('students')->cascadeOnDelete();
            $table->foreignUuid('term_id')->constrained('terms')->cascadeOnDelete();
            $table->foreignUuid('fee_plan_id')->constrained('fee_plans')->restrictOnDelete();
            $table->decimal('amount_due', 10, 2);
            $table->date('issued_on');
            $table->string('status')->default('pending');
            $table->timestampsTz();

            $table->unique(['student_id', 'term_id']);
        });

        Schema::create('assessments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('school_id')->constrained('schools')->cascadeOnDelete();
            $table->foreignUuid('term_id')->constrained('terms')->cascadeOnDelete();
            $table->foreignUuid('school_class_id')->constrained('school_classes')->cascadeOnDelete();
            $table->string('kind');
            $table->string('name');
            $table->string('state')->default('draft');
            $table->decimal('sequence_weight', 3, 1);
            $table->decimal('exam_weight', 3, 1);
            $table->timestamptz('scheduled_for')->nullable();
            $table->date('window_starts_on')->nullable();
            $table->date('window_ends_on')->nullable();
            $table->decimal('total_max', 5, 1)->nullable();
            $table->timestampsTz();
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE invoices ADD CONSTRAINT invoices_status_check CHECK (status IN ('pending', 'partial', 'paid', 'overdue'))");
            DB::statement("ALTER TABLE assessments ADD CONSTRAINT assessments_kind_check CHECK (kind IN ('sequence', 'exam'))");
            DB::statement("ALTER TABLE assessments ADD CONSTRAINT assessments_state_check CHECK (state IN ('draft', 'scheduled', 'marks_open', 'marks_closed', 'published'))");
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('assessments');
        Schema::dropIfExists('invoices');
        Schema::dropIfExists('coefficient_versions');
    }
};
