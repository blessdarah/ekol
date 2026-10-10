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
        Schema::create('timetable_versions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('school_id')->constrained('schools')->cascadeOnDelete();
            $table->foreignUuid('term_id')->constrained('terms')->cascadeOnDelete();
            $table->smallInteger('number');
            $table->string('status')->default('draft');
            $table->jsonb('options')->nullable();
            $table->timestampTz('generated_at')->nullable();
            $table->integer('generation_ms')->nullable();
            $table->date('effective_on')->nullable();
            $table->timestampTz('published_at')->nullable();
            $table->foreignUuid('published_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampsTz();

            $table->unique(['term_id', 'number']);
        });

        Schema::table('timetable_slots', function (Blueprint $table) {
            $table->dropUnique(['term_id', 'school_class_id', 'period_id', 'weekday']);
            $table->foreignUuid('timetable_version_id')->nullable()->constrained('timetable_versions')->cascadeOnDelete();
            $table->boolean('is_locked')->default(false);

            $table->unique(['timetable_version_id', 'school_class_id', 'period_id', 'weekday'], 'timetable_slots_version_class_time_unique');
        });

        Schema::create('timetable_changes', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('school_id')->constrained('schools')->cascadeOnDelete();
            $table->foreignUuid('timetable_version_id')->constrained('timetable_versions')->cascadeOnDelete();
            $table->string('kind');
            $table->date('starts_on');
            $table->date('ends_on');
            $table->foreignUuid('timetable_slot_id')->constrained('timetable_slots')->cascadeOnDelete();
            $table->foreignUuid('other_slot_id')->nullable()->constrained('timetable_slots')->cascadeOnDelete();
            $table->foreignUuid('staff_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignUuid('room_id')->nullable()->constrained('rooms')->nullOnDelete();
            $table->string('summary');
            $table->foreignUuid('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampsTz();
        });

        Schema::table('rooms', function (Blueprint $table) {
            $table->jsonb('unavailable')->nullable();
        });

        Schema::table('subjects', function (Blueprint $table) {
            $table->string('room_kind')->nullable();
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE timetable_versions ADD CONSTRAINT timetable_versions_status_check CHECK (status IN ('draft', 'live', 'archived'))");
            DB::statement("ALTER TABLE timetable_changes ADD CONSTRAINT timetable_changes_kind_check CHECK (kind IN ('cover', 'swap', 'room'))");
            DB::statement('ALTER TABLE rooms DROP CONSTRAINT rooms_kind_check');
            DB::statement("ALTER TABLE rooms ADD CONSTRAINT rooms_kind_check CHECK (kind IN ('classroom', 'laboratory', 'computer', 'library', 'hall', 'office'))");
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE rooms DROP CONSTRAINT rooms_kind_check');
            DB::statement("ALTER TABLE rooms ADD CONSTRAINT rooms_kind_check CHECK (kind IN ('classroom', 'laboratory', 'library', 'hall', 'office'))");
        }

        Schema::table('subjects', function (Blueprint $table) {
            $table->dropColumn('room_kind');
        });

        Schema::table('rooms', function (Blueprint $table) {
            $table->dropColumn('unavailable');
        });

        Schema::dropIfExists('timetable_changes');

        Schema::table('timetable_slots', function (Blueprint $table) {
            $table->dropUnique('timetable_slots_version_class_time_unique');
            $table->dropConstrainedForeignId('timetable_version_id');
            $table->dropColumn('is_locked');
            $table->unique(['term_id', 'school_class_id', 'period_id', 'weekday']);
        });

        Schema::dropIfExists('timetable_versions');
    }
};
