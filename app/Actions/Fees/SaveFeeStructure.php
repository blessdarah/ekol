<?php

namespace App\Actions\Fees;

use App\Enums\AcademicYearStatus;
use App\Models\AcademicYear;
use App\Models\AuditEvent;
use App\Models\FeeItem;
use App\Models\FeeItemAmount;
use App\Models\FeePlan;
use App\Models\Level;
use App\Models\Money;
use App\Models\School;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class SaveFeeStructure
{
    /** @param array<string, mixed> $data */
    public function handle(School $school, ?User $actor, array $data): void
    {

        $levels = Level::where('school_id', $school->id)->pluck('name', 'id');
        $year = AcademicYear::where('school_id', $school->id)->whereKey($data['year_id'])->firstOrFail();

        if ($year->status === AcademicYearStatus::Closed) {
            throw ValidationException::withMessages(['year_id' => __(':label is closed. Its fees can no longer change.', ['label' => $year->label])]);
        }

        $rows = array_values($data['items']);
        $charged = collect($rows)->flatMap(fn (array $row) => array_keys(array_filter($row['amounts'], fn ($amount) => Money::units((string) ($amount ?? 0)) > 0)))->unique();
        $stranded = FeePlan::where('school_id', $school->id)
            ->where('academic_year_id', $year->id)
            ->whereNotIn('level_id', $charged->all())
            ->whereHas('invoices')
            ->pluck('level_id')
            ->map(fn (string $levelId) => $levels->get($levelId))
            ->filter();

        if ($stranded->isNotEmpty()) {
            throw ValidationException::withMessages([
                'items' => __('Students in :levels are already billed, so the level has to keep at least one fee.', ['levels' => $stranded->join(', ')]),
            ]);
        }

        DB::transaction(function () use ($actor, $school, $year, $rows, $levels) {
            $existing = FeeItem::where('school_id', $school->id)->where('academic_year_id', $year->id)->get()->keyBy('id');
            $kept = [];

            foreach ($rows as $position => $row) {
                $item = $existing->get((string) ($row['id'] ?? '')) ?? new FeeItem(['school_id' => $school->id, 'academic_year_id' => $year->id]);
                $item->fill([
                    'name' => trim($row['name']),
                    'position' => $position + 1,
                    'is_spread' => (bool) $row['spread'],
                    'new_students_only' => (bool) $row['new_only'],
                ])->save();
                $kept[] = $item->id;

                foreach ($levels->keys() as $levelId) {
                    $amount = Money::units((string) ($row['amounts'][$levelId] ?? 0));

                    if ($amount > 0) {
                        FeeItemAmount::updateOrCreate(
                            ['fee_item_id' => $item->id, 'level_id' => $levelId],
                            ['amount' => Money::decimal($amount)],
                        );
                    } else {
                        FeeItemAmount::where('fee_item_id', $item->id)->where('level_id', $levelId)->delete();
                    }
                }
            }

            FeeItem::where('school_id', $school->id)->where('academic_year_id', $year->id)->whereNotIn('id', $kept)->delete();
            FeePlan::syncFor($school, $year);

            AuditEvent::record($school, $actor, 'academic_year', $year->id, 'fees_set', [
                'items' => array_map(fn (array $row) => [
                    'name' => trim($row['name']),
                    'spread' => (bool) $row['spread'],
                    'new_only' => (bool) $row['new_only'],
                    'amounts' => array_filter($row['amounts'], fn ($amount) => Money::units((string) ($amount ?? 0)) > 0),
                ], $rows),
            ]);
        });
    }
}
