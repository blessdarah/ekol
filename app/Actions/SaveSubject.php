<?php

namespace App\Actions;

use App\Enums\CoefficientStatus;
use App\Models\AuditEvent;
use App\Models\ClassSubject;
use App\Models\Coefficient;
use App\Models\School;
use App\Models\SchoolClass;
use App\Models\Subject;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class SaveSubject
{
    /**
     * Write the subject, its per-class teaching rows, and the per-level
     * coefficient rows that marks are weighted with.
     *
     * @param  array{name: string, code: string, department: string, coefficient: int|float|string, note?: string|null, classes: list<array{class_id: string, staff_id: string|null, weekly_periods: int}>}  $data
     */
    public function handle(School $school, ?User $actor, Subject $subject, array $data, ?int $defaultPeriods = null, bool $template = false): Subject
    {
        return DB::transaction(function () use ($school, $actor, $subject, $data, $defaultPeriods, $template) {
            $registered = ! $subject->exists;
            $before = $subject->only(['name', 'code', 'department', 'coefficient']);
            $this->save($school, $subject, $data, $defaultPeriods);
            AuditEvent::record($school, $actor, 'subject', $subject->id, $registered ? 'registered' : 'updated', $registered
                ? ['code' => $subject->code, ...($template ? ['template' => true] : [])]
                : ['before' => $before, 'after' => $subject->only(['name', 'code', 'department', 'coefficient']), 'classes' => count($data['classes'])]);

            return $subject;
        });
    }

    /**
     * @param  array{name: string, code: string, department: string, coefficient: int|float|string, note?: string|null, classes: list<array{class_id: string, staff_id: string|null, weekly_periods: int}>}  $data
     */
    protected function save(School $school, Subject $subject, array $data, ?int $defaultPeriods = null): Subject
    {
        $periods = collect($data['classes'])->pluck('weekly_periods');

        $subject->fill([
            'name' => trim((string) $data['name']),
            'code' => mb_strtoupper(trim((string) $data['code'])),
            'department' => trim((string) $data['department']),
            'coefficient' => $data['coefficient'],
            'note' => $data['note'] ?? null,
            'weekly_periods' => (int) ($periods->max() ?? $defaultPeriods ?? $subject->weekly_periods ?? 0),
        ])->save();

        $keep = [];

        foreach ($data['classes'] as $row) {
            $keep[] = ClassSubject::updateOrCreate(
                ['school_class_id' => $row['class_id'], 'subject_id' => $subject->id],
                [
                    'school_id' => $school->id,
                    'staff_id' => $row['staff_id'] ?: null,
                    'weekly_periods' => $row['weekly_periods'],
                ],
            )->id;
        }

        ClassSubject::where('subject_id', $subject->id)->whereNotIn('id', $keep)->delete();

        $levelIds = SchoolClass::whereIn('id', collect($data['classes'])->pluck('class_id'))
            ->distinct()
            ->pluck('level_id');

        // One coefficient weights sequences and exams alike.
        foreach ($levelIds as $levelId) {
            Coefficient::updateOrCreate(
                ['subject_id' => $subject->id, 'level_id' => $levelId],
                [
                    'sequence_coeff' => $data['coefficient'],
                    'exam_coeff' => $data['coefficient'],
                    'status' => CoefficientStatus::Complete,
                ],
            );
        }

        return $subject;
    }
}
