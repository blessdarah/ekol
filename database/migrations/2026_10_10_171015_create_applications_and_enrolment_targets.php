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
        Schema::create('applications', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('school_id')->constrained('schools')->cascadeOnDelete();
            $table->foreignUuid('academic_year_id')->constrained('academic_years')->cascadeOnDelete();
            $table->foreignUuid('level_id')->constrained('levels')->restrictOnDelete();
            $table->string('reference');
            $table->string('surname');
            $table->string('given_names');
            $table->string('full_name');
            $table->date('date_of_birth');
            $table->string('gender');
            $table->string('place_of_birth')->nullable();
            $table->string('religion')->nullable();
            $table->string('disability')->nullable();
            $table->boolean('transferred')->default(false);
            $table->string('previous_school')->nullable();
            $table->string('previous_class')->nullable();
            $table->string('reason')->nullable();
            $table->jsonb('guardians');
            $table->jsonb('documents');
            $table->string('stage')->default('to_review');
            $table->string('condition')->nullable();
            $table->foreignUuid('student_id')->nullable()->constrained('students')->nullOnDelete();
            $table->foreignUuid('decided_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('decided_at')->nullable();
            $table->timestampsTz();

            $table->unique(['school_id', 'reference']);
            $table->index(['academic_year_id', 'stage']);
        });

        Schema::table('enrolments', function (Blueprint $table) {
            $table->foreignUuid('level_id')->nullable()->constrained('levels')->restrictOnDelete();
        });

        Schema::table('academic_years', function (Blueprint $table) {
            $table->timestampTz('enrolment_confirmed_at')->nullable();
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE applications ADD CONSTRAINT applications_stage_check CHECK (stage IN ('to_review', 'admitted', 'waitlist', 'declined'))");
            DB::statement("ALTER TABLE applications ADD CONSTRAINT applications_gender_check CHECK (gender IN ('male', 'female'))");
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('academic_years', function (Blueprint $table) {
            $table->dropColumn('enrolment_confirmed_at');
        });

        Schema::table('enrolments', function (Blueprint $table) {
            $table->dropConstrainedForeignId('level_id');
        });

        Schema::dropIfExists('applications');
    }
};
