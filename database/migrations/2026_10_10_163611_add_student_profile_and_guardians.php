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
        Schema::table('students', function (Blueprint $table) {
            $table->string('surname')->nullable();
            $table->string('given_names')->nullable();
            $table->string('place_of_birth')->nullable();
            $table->string('religion')->nullable();
            $table->boolean('has_disability')->default(false);
            $table->jsonb('disability_types')->nullable();
            $table->string('disability_support')->nullable();
            $table->boolean('transferred')->default(false);
            $table->string('previous_school')->nullable();
            $table->string('previous_class')->nullable();
            $table->smallInteger('previous_year_left')->nullable();
            $table->boolean('transfer_certificate_received')->default(false);
            $table->boolean('last_report_received')->default(false);
            $table->boolean('on_whatsapp')->default(false);
            $table->string('lives_with')->nullable();
            $table->uuid('family_id')->nullable()->index();
        });

        Schema::create('student_guardians', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('student_id')->constrained('students')->cascadeOnDelete();
            $table->string('relation');
            $table->string('name');
            $table->string('phone')->nullable();
            $table->string('occupation')->nullable();
            $table->boolean('is_main')->default(false);
            $table->timestampsTz();

            $table->unique(['student_id', 'relation']);
            $table->index('phone');
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE student_guardians ADD CONSTRAINT student_guardians_relation_check CHECK (relation IN ('father', 'mother', 'guardian'))");
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('student_guardians');

        Schema::table('students', function (Blueprint $table) {
            $table->dropIndex(['family_id']);
            $table->dropColumn([
                'surname', 'given_names', 'place_of_birth', 'religion', 'has_disability',
                'disability_types', 'disability_support', 'transferred', 'previous_school',
                'previous_class', 'previous_year_left', 'transfer_certificate_received',
                'last_report_received', 'on_whatsapp', 'lives_with', 'family_id',
            ]);
        });
    }
};
