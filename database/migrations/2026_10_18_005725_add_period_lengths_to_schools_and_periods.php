<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Period times are worked out from when the day starts and a default
 * lesson length; a period keeps its own length only when it is marked
 * custom (breaks always carry theirs). Existing schools keep the day
 * they had: the first start, the most common lesson length, and their
 * own length for every period that differs from it.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('schools', function (Blueprint $table) {
            $table->time('day_starts_at')->default('07:30');
            $table->smallInteger('period_minutes')->default(55);
        });

        Schema::table('periods', function (Blueprint $table) {
            $table->smallInteger('custom_minutes')->nullable();
        });

        $minutes = fn (string $time): int => ((int) substr($time, 0, 2)) * 60 + (int) substr($time, 3, 2);

        DB::table('periods')->whereNull('deleted_at')->orderBy('starts_at')->get()
            ->groupBy('school_id')
            ->each(function ($periods, $schoolId) use ($minutes) {
                $lengths = $periods->mapWithKeys(fn ($period) => [$period->id => $minutes($period->ends_at) - $minutes($period->starts_at)]);
                $lessons = $periods->reject(fn ($period) => (bool) $period->is_break);
                $default = $lessons->isEmpty()
                    ? 55
                    : (int) $lessons->map(fn ($period) => $lengths[$period->id])->countBy()->sortDesc()->keys()->first();

                DB::table('schools')->where('id', $schoolId)->update([
                    'day_starts_at' => substr((string) $periods->first()->starts_at, 0, 5),
                    'period_minutes' => $default,
                ]);

                foreach ($periods as $period) {
                    $length = $lengths[$period->id];

                    if ($period->is_break || $length !== $default) {
                        DB::table('periods')->where('id', $period->id)->update(['custom_minutes' => max(1, $length)]);
                    }
                }
            });
    }

    public function down(): void
    {
        Schema::table('periods', function (Blueprint $table) {
            $table->dropColumn('custom_minutes');
        });

        Schema::table('schools', function (Blueprint $table) {
            $table->dropColumn(['day_starts_at', 'period_minutes']);
        });
    }
};
