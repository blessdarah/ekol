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
        Schema::create('installments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('invoice_id')->constrained('invoices')->cascadeOnDelete();
            $table->smallInteger('seq');
            $table->string('label');
            $table->decimal('amount', 10, 2);
            $table->date('due_on');
            $table->string('status')->default('pending');
            $table->timestampsTz();

            $table->unique(['invoice_id', 'seq']);
        });

        Schema::create('payments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('invoice_id')->constrained('invoices')->cascadeOnDelete();
            $table->foreignUuid('installment_id')->nullable()->constrained('installments')->nullOnDelete();
            $table->decimal('amount', 10, 2);
            $table->string('method');
            $table->string('reference')->nullable();
            $table->timestamptz('received_at')->useCurrent();
            $table->foreignUuid('received_by')->nullable()->constrained('users')->nullOnDelete();
        });

        Schema::create('timetable_slots', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('school_id')->constrained('schools')->cascadeOnDelete();
            $table->foreignUuid('term_id')->constrained('terms')->cascadeOnDelete();
            $table->foreignUuid('school_class_id')->constrained('school_classes')->cascadeOnDelete();
            $table->foreignUuid('period_id')->constrained('periods')->cascadeOnDelete();
            $table->foreignUuid('subject_id')->nullable()->constrained('subjects')->nullOnDelete();
            $table->foreignUuid('staff_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignUuid('room_id')->nullable()->constrained('rooms')->nullOnDelete();
            $table->smallInteger('weekday');
            $table->timestampsTz();

            $table->unique(['term_id', 'school_class_id', 'period_id', 'weekday']);
        });

        Schema::create('attendance', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('timetable_slot_id')->constrained('timetable_slots')->cascadeOnDelete();
            $table->foreignUuid('student_id')->constrained('students')->cascadeOnDelete();
            $table->date('date');
            $table->string('status');
            $table->foreignUuid('marked_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamptz('marked_at')->useCurrent();
            $table->timestampsTz();

            $table->unique(['timetable_slot_id', 'date', 'student_id']);
        });

        Schema::create('teaching_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('timetable_slot_id')->constrained('timetable_slots')->cascadeOnDelete();
            $table->foreignUuid('staff_id')->nullable()->constrained('users')->nullOnDelete();
            $table->date('date');
            $table->text('topic');
            $table->timestamptz('started_at')->nullable();
            $table->timestamptz('ended_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestampsTz();
        });

        Schema::create('audit_events', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('school_id')->constrained('schools')->cascadeOnDelete();
            $table->foreignUuid('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('entity');
            $table->uuid('entity_id');
            $table->string('action');
            $table->jsonb('diff');
            $table->timestamptz('occurred_at')->useCurrent();

            $table->index(['entity', 'entity_id']);
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE installments ADD CONSTRAINT installments_status_check CHECK (status IN ('pending', 'paid', 'overdue'))");
            DB::statement("ALTER TABLE payments ADD CONSTRAINT payments_method_check CHECK (method IN ('cash', 'bank_transfer', 'mobile_money', 'cheque'))");
            DB::statement("ALTER TABLE attendance ADD CONSTRAINT attendance_status_check CHECK (status IN ('present', 'absent', 'late', 'excused'))");
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('audit_events');
        Schema::dropIfExists('teaching_logs');
        Schema::dropIfExists('attendance');
        Schema::dropIfExists('timetable_slots');
        Schema::dropIfExists('payments');
        Schema::dropIfExists('installments');
    }
};
