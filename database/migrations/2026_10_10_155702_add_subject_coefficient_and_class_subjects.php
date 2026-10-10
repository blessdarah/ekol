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
        Schema::table('subjects', function (Blueprint $table) {
            $table->decimal('coefficient', 3, 1)->nullable();
            $table->string('note')->nullable();
        });

        Schema::create('class_subjects', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('school_id')->constrained('schools')->cascadeOnDelete();
            $table->foreignUuid('school_class_id')->constrained('school_classes')->cascadeOnDelete();
            $table->foreignUuid('subject_id')->constrained('subjects')->cascadeOnDelete();
            $table->foreignUuid('staff_id')->nullable()->constrained('users')->nullOnDelete();
            $table->smallInteger('weekly_periods');
            $table->timestampsTz();

            $table->unique(['school_class_id', 'subject_id']);
            $table->index('staff_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('class_subjects');

        Schema::table('subjects', function (Blueprint $table) {
            $table->dropColumn(['coefficient', 'note']);
        });
    }
};
