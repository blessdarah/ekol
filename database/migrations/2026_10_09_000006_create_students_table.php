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
        Schema::create('students', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('school_id')->constrained('schools')->cascadeOnDelete();
            $table->string('admission_no');
            $table->string('full_name');
            $table->string('gender');
            $table->date('date_of_birth');
            $table->string('guardian_name');
            $table->string('guardian_phone');
            $table->date('admitted_on');
            $table->timestampsTz();
            $table->softDeletesTz();

            $table->unique(['school_id', 'admission_no']);
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE students ADD CONSTRAINT students_gender_check CHECK (gender IN ('male', 'female'))");
        }

        Schema::create('enrolments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('student_id')->constrained('students')->cascadeOnDelete();
            $table->foreignUuid('academic_year_id')->constrained('academic_years')->cascadeOnDelete();
            $table->foreignUuid('school_class_id')->nullable()->constrained('school_classes')->restrictOnDelete();
            $table->string('status')->default('admitted');
            $table->string('decision')->nullable();
            $table->timestampsTz();

            $table->unique(['student_id', 'academic_year_id']);
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE enrolments ADD CONSTRAINT enrolments_status_check CHECK (status IN ('admitted', 'placed', 'enrolled', 'left'))");
            DB::statement("ALTER TABLE enrolments ADD CONSTRAINT enrolments_decision_check CHECK (decision IS NULL OR decision IN ('promote', 'repeat', 'leaving'))");
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('enrolments');
        Schema::dropIfExists('students');
    }
};
