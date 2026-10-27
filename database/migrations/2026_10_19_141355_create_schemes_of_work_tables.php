<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Schemes of work: the syllabus each subject must cover at a level
 * (topics and their sub-topics, kept from year to year), the schemes
 * opened for a term (one per subject and class), the sub-topics each
 * teacher places week by week and ticks as taught, and the history
 * of every scheme.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('syllabus_topics', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('school_id')->constrained('schools')->cascadeOnDelete();
            $table->foreignUuid('level_id')->constrained('levels')->cascadeOnDelete();
            $table->foreignUuid('subject_id')->constrained('subjects')->cascadeOnDelete();
            $table->smallInteger('position');
            $table->string('name');
            $table->smallInteger('term_sequence')->default(1);
            $table->smallInteger('week_from')->nullable();
            $table->smallInteger('week_to')->nullable();
            $table->smallInteger('periods')->default(1);
            $table->timestampsTz();

            $table->index(['level_id', 'subject_id', 'position']);
        });

        Schema::create('syllabus_subtopics', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('syllabus_topic_id')->constrained('syllabus_topics')->cascadeOnDelete();
            $table->smallInteger('position');
            $table->string('name');
            $table->smallInteger('periods')->default(1);
            $table->timestampsTz();
        });

        Schema::create('scheme_openings', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('school_id')->constrained('schools')->cascadeOnDelete();
            $table->foreignUuid('term_id')->unique()->constrained('terms')->cascadeOnDelete();
            $table->date('due_on');
            $table->string('approval', 20)->default('head_of_department');
            $table->string('starts_from', 20)->default('syllabus');
            $table->boolean('free_changes')->default(false);
            $table->foreignUuid('opened_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('closed_at')->nullable();
            $table->foreignUuid('closed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampsTz();
        });

        Schema::create('schemes', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('school_id')->constrained('schools')->cascadeOnDelete();
            $table->foreignUuid('term_id')->constrained('terms')->cascadeOnDelete();
            $table->foreignUuid('class_subject_id')->constrained('class_subjects')->cascadeOnDelete();
            $table->string('status', 20)->default('not_started');
            $table->timestampTz('submitted_at')->nullable();
            $table->timestampTz('approved_at')->nullable();
            $table->foreignUuid('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('closed_at')->nullable();
            $table->timestampsTz();

            $table->unique(['term_id', 'class_subject_id']);
            $table->index(['school_id', 'term_id', 'status']);
        });

        Schema::create('scheme_items', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('scheme_id')->constrained('schemes')->cascadeOnDelete();
            $table->foreignUuid('syllabus_topic_id')->nullable()->constrained('syllabus_topics')->nullOnDelete();
            $table->foreignUuid('syllabus_subtopic_id')->nullable()->constrained('syllabus_subtopics')->nullOnDelete();
            $table->smallInteger('position');
            $table->string('topic');
            $table->string('name')->nullable();
            $table->smallInteger('week')->nullable();
            $table->smallInteger('periods')->default(1);
            $table->boolean('added_by_teacher')->default(false);
            $table->boolean('carried_over')->default(false);
            $table->date('taught_on')->nullable();
            $table->timestampsTz();

            $table->index(['scheme_id', 'week']);
        });

        Schema::create('scheme_events', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('scheme_id')->constrained('schemes')->cascadeOnDelete();
            $table->foreignUuid('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('action', 30);
            $table->text('note')->nullable();
            $table->timestampTz('created_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('scheme_events');
        Schema::dropIfExists('scheme_items');
        Schema::dropIfExists('schemes');
        Schema::dropIfExists('scheme_openings');
        Schema::dropIfExists('syllabus_subtopics');
        Schema::dropIfExists('syllabus_topics');
    }
};
