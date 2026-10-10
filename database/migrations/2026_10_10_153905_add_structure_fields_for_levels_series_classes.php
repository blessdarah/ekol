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
        Schema::table('levels', function (Blueprint $table) {
            $table->string('code', 10)->nullable();
        });

        Schema::table('series', function (Blueprint $table) {
            $table->string('stream')->nullable();
            $table->smallInteger('min_subjects')->nullable();
            $table->smallInteger('max_subjects')->nullable();
        });

        Schema::create('series_subjects', function (Blueprint $table) {
            $table->foreignUuid('series_id')->constrained('series')->cascadeOnDelete();
            $table->foreignUuid('subject_id')->constrained('subjects')->cascadeOnDelete();
            $table->string('kind');
            $table->timestampsTz();

            $table->primary(['series_id', 'subject_id']);
        });

        Schema::table('school_classes', function (Blueprint $table) {
            $table->foreignUuid('home_room_id')->nullable()->constrained('rooms')->nullOnDelete();
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE series ADD CONSTRAINT series_stream_check CHECK (stream IS NULL OR stream IN ('science', 'arts'))");
            DB::statement("ALTER TABLE series_subjects ADD CONSTRAINT series_subjects_kind_check CHECK (kind IN ('core', 'elective'))");
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('school_classes', function (Blueprint $table) {
            $table->dropConstrainedForeignId('home_room_id');
        });

        Schema::dropIfExists('series_subjects');

        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE series DROP CONSTRAINT series_stream_check');
        }

        Schema::table('series', function (Blueprint $table) {
            $table->dropColumn(['stream', 'min_subjects', 'max_subjects']);
        });

        Schema::table('levels', function (Blueprint $table) {
            $table->dropColumn('code');
        });
    }
};
