<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('student_series_subjects', function (Blueprint $table) {
            $table->foreignUuid('student_series_id')->constrained('student_series')->cascadeOnDelete();
            $table->foreignUuid('subject_id')->constrained('subjects')->cascadeOnDelete();
            $table->timestampsTz();

            $table->primary(['student_series_id', 'subject_id']);
        });

        Schema::table('student_series', function (Blueprint $table) {
            $table->string('change_reason')->nullable();
            $table->string('change_note')->nullable();
            $table->boolean('parent_agreed')->default(false);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('student_series', function (Blueprint $table) {
            $table->dropColumn(['change_reason', 'change_note', 'parent_agreed']);
        });

        Schema::dropIfExists('student_series_subjects');
    }
};
