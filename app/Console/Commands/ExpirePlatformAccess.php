<?php

namespace App\Console\Commands;

use App\Models\Application;
use App\Models\Assessment;
use App\Models\DemoRequest;
use App\Models\Enrolment;
use App\Models\FeePlan;
use App\Models\Invoice;
use App\Models\School;
use App\Models\SchoolVisit;
use App\Models\Student;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class ExpirePlatformAccess extends Command
{
    protected $signature = 'platform:expire';

    protected $description = 'Close expired visits and demos, and delete demos closed for seven days';

    public function handle(): int
    {
        SchoolVisit::whereNull('ended_at')->where('expires_at', '<=', now())->each(fn (SchoolVisit $visit) => $visit->finish());
        DemoRequest::where('status', 'trying')->whereIn('demo_school_id', School::where('is_demo', true)->where('demo_expires_at', '<=', now())->select('id'))->update(['status' => 'closed']);
        School::where('is_demo', true)->where('demo_expires_at', '<=', now()->subWeek())->each(function (School $school) {
            DB::transaction(function () use ($school) {
                $school = School::whereKey($school->id)->lockForUpdate()->first();
                if (! $school || $school->demo_expires_at->gt(now()->subWeek())) {
                    return;
                }
                User::withTrashed()->where('school_id', $school->id)->forceDelete();
                $students = Student::withTrashed()->where('school_id', $school->id)->select('id');
                Invoice::whereIn('student_id', $students)->delete();
                Assessment::where('school_id', $school->id)->delete();
                Enrolment::whereIn('student_id', Student::withTrashed()->where('school_id', $school->id)->select('id'))->delete();
                Application::where('school_id', $school->id)->delete();
                FeePlan::where('school_id', $school->id)->delete();
                $school->forceDelete();
            });
        });

        return self::SUCCESS;
    }
}
