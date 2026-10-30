<?php

namespace App\Livewire\Pulse;

use App\Models\School;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Support\Renderable;
use Illuminate\Support\Facades\View;
use Laravel\Pulse\Livewire\Card;
use Livewire\Attributes\Lazy;
use stdClass;

/**
 * The schools where errors were reported in the period, most first:
 * the first thing to check when someone says "Campus is broken".
 */
#[Lazy]
class SchoolExceptions extends Card
{
    public function render(): Renderable
    {
        [$schools, $time, $runAt] = $this->remember(function () {
            $rows = $this->aggregate('school_exception', ['max', 'count'], 'count');
            $names = School::withTrashed()->whereIn('id', $rows->pluck('key'))->get(['id', 'name', 'slug'])->keyBy('id');

            return $rows->map(fn (stdClass $row) => (object) [
                'name' => $names[$row->key]->name ?? __('Unknown school'),
                'slug' => $names[$row->key]->slug ?? null,
                'latest' => CarbonImmutable::createFromTimestamp($row->max),
                'count' => (int) $row->count,
            ]);
        });

        return View::make('livewire.pulse.school-exceptions', [
            'time' => $time,
            'runAt' => $runAt,
            'schools' => $schools,
        ]);
    }
}
