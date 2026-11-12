<?php

namespace App\Actions\Assessments;

use App\Enums\AssessmentState;
use App\Enums\EnrolmentStatus;
use App\Models\AssessmentPlan;
use App\Models\AssessmentSubject;
use App\Models\AuditEvent;
use App\Models\Enrolment;
use App\Models\GradeBand;
use App\Models\Mark;
use App\Models\School;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;

/**
 * Save a mark sheet, and hand it in when asked. Marks only change
 * while the plan's window is open, and a sheet is only handed in once
 * every student still in the class has a mark or is marked absent.
 */
class SaveMarkSheet
{
    /**
     * @param  array{marks: list<array{student_id: string, score?: float|int|string|null, absent: bool, remark?: string|null}>, submit?: bool}  $data
     */
    public function handle(School $school, AssessmentSubject $sheet, ?User $actor, array $data): void
    {
        $plan = $this->plan($school, $sheet);
        $this->ensureAcceptsMarks($plan);

        $students = $this->eligibleStudentIds($sheet);
        $rows = $data['marks'];
        $submit = (bool) ($data['submit'] ?? false);

        if (array_diff(array_column($rows, 'student_id'), $students) !== []) {
            throw new InvalidArgumentException('Marks can only be saved for students in the sheet\'s class.');
        }

        if ($submit) {
            $filled = collect($rows)->filter(fn (array $row) => $row['absent'] || ($row['score'] ?? null) !== null)->pluck('student_id')->all();
            $left = count(array_diff($students, $filled));

            if ($left > 0) {
                throw ValidationException::withMessages([
                    'marks' => trans_choice('{1} Fill :count empty mark before submitting, or mark the student absent.|[2,*] Fill :count empty marks before submitting, or mark the student absent.', $left, ['count' => $left]),
                ]);
            }
        }

        $max = (float) $sheet->max_score;

        DB::transaction(function () use ($school, $sheet, $actor, $rows, $submit, $max) {
            foreach ($rows as $row) {
                $score = $row['absent'] || ($row['score'] ?? null) === null ? null : round((float) $row['score'], 2);
                $band = GradeBand::forScore($school->id, $score !== null ? $score / max(1.0, $max) * AssessmentPlan::OUT_OF : null);

                Mark::updateOrCreate(
                    ['assessment_subject_id' => $sheet->id, 'student_id' => $row['student_id']],
                    [
                        'score' => $score,
                        'is_absent' => (bool) $row['absent'],
                        'remark' => isset($row['remark']) && trim((string) $row['remark']) !== '' ? trim((string) $row['remark']) : null,
                        'grade_band_id' => $band['id'] ?? null,
                        'entered_by' => $actor?->id,
                        'entered_at' => now(),
                    ],
                );
            }

            if ($submit) {
                $sheet->update(['submitted_at' => now(), 'submitted_by' => $actor?->id]);
            }

            AuditEvent::record($school, $actor, 'assessment_subject', $sheet->id, $submit ? 'marks_submitted' : 'marks_saved', ['marks' => count($rows)]);
        });
    }

    /**
     * Reject the edit unless the plan's marks window is open now.
     */
    public function ensureAcceptsMarks(AssessmentPlan $plan): void
    {
        if ($plan->acceptsMarks()) {
            return;
        }

        throw ValidationException::withMessages([
            'marks' => match ($plan->state) {
                AssessmentState::Published => __('These results are published. Ask for a correction instead.'),
                AssessmentState::MarksClosed => __('Marks entry is closed for this assessment.'),
                AssessmentState::MarksOpen => __('The marks window ended on :date. Ask the school to extend it.', ['date' => $plan->window_ends_on?->translatedFormat('j M')]),
                default => __('Marks are not open for this assessment yet.'),
            },
        ]);
    }

    /**
     * The students a sheet is for: everyone in its class who has not left.
     *
     * @return list<string>
     */
    public function eligibleStudentIds(AssessmentSubject $sheet): array
    {
        return array_values(Enrolment::where('school_class_id', $sheet->assessment?->school_class_id)
            ->where('status', '!=', EnrolmentStatus::Left)
            ->get(['student_id'])
            ->map(fn (Enrolment $enrolment) => $enrolment->student_id)
            ->all());
    }

    private function plan(School $school, AssessmentSubject $sheet): AssessmentPlan
    {
        $sheet->loadMissing('assessment.plan');
        $plan = $sheet->assessment?->plan;

        if ($sheet->assessment?->school_id !== $school->id || $plan === null || $plan->school_id !== $school->id) {
            throw new InvalidArgumentException('The mark sheet must belong to the school and an assessment plan.');
        }

        return $plan->refreshState();
    }
}
