<?php

use App\Actions\ActivateAcademicYear;
use App\Enums\AcademicYearStatus;
use App\Enums\SchoolCycle;
use App\Models\AcademicYear;
use App\Models\AuditEvent;
use App\Models\School;
use App\Models\Term;
use App\Models\User;

/**
 * Two consecutive years, the earlier one current with its third term active.
 *
 * @return array{school: School, actor: User, old: AcademicYear, oldTerm: Term, next: AcademicYear}
 */
function activationWorld(string $slug = 'activation'): array
{
    $school = School::create([
        'name' => 'Activation Academy '.$slug, 'code' => 'ACT', 'slug' => $slug,
        'cycle' => SchoolCycle::Secondary, 'currency' => 'XAF', 'timezone' => 'Africa/Douala',
    ]);
    $old = AcademicYear::create([
        'school_id' => $school->id, 'label' => '2025/26',
        'starts_on' => '2025-09-01', 'ends_on' => '2026-07-31',
        'status' => AcademicYearStatus::Current,
    ]);
    $oldTerm = Term::create([
        'school_id' => $school->id, 'academic_year_id' => $old->id,
        'label' => 'Term 3', 'sequence' => 3,
        'starts_on' => '2026-04-13', 'ends_on' => '2026-06-26',
        'week_count' => 11, 'is_current' => true,
    ]);
    $next = AcademicYear::create([
        'school_id' => $school->id, 'label' => '2026/27',
        'starts_on' => '2026-09-01', 'ends_on' => '2027-07-31',
        'status' => AcademicYearStatus::Planned,
    ]);
    $actor = User::factory()->create(['school_id' => $school->id]);

    return compact('school', 'actor', 'old', 'oldTerm', 'next');
}

function activationTerm(AcademicYear $year, int $sequence, string $startsOn, string $endsOn): Term
{
    return Term::create([
        'school_id' => $year->school_id, 'academic_year_id' => $year->id,
        'label' => "Term {$sequence}", 'sequence' => $sequence,
        'starts_on' => $startsOn, 'ends_on' => $endsOn, 'week_count' => 12,
    ]);
}

/**
 * @return list<string>
 */
function activeTermIds(School $school): array
{
    return Term::where('school_id', $school->id)->where('is_current', true)->pluck('id')->all();
}

test('activating a later year closes the old one and selects todays term', function () {
    $this->travelTo('2027-01-20');
    $world = activationWorld();
    activationTerm($world['next'], 1, '2026-09-01', '2026-12-18');
    $today = activationTerm($world['next'], 2, '2027-01-04', '2027-03-26');

    $activated = app(ActivateAcademicYear::class)->handle($world['school'], $world['next'], $world['actor']);

    expect($activated)->toBeTrue()
        ->and($world['next']->fresh()->status)->toBe(AcademicYearStatus::Current)
        ->and($world['old']->fresh()->status)->toBe(AcademicYearStatus::Closed)
        ->and(activeTermIds($world['school']))->toBe([$today->id]);

    $audit = AuditEvent::sole();
    expect($audit->only(['entity', 'entity_id', 'action', 'actor_id', 'school_id']))->toBe([
        'entity' => 'academic_year', 'entity_id' => $world['next']->id, 'action' => 'activated',
        'actor_id' => $world['actor']->id, 'school_id' => $world['school']->id,
    ])->and($audit->diff)->toBe(['label' => '2026/27']);
});

test('activating an earlier year returns the later one to planned and falls back to its first term', function () {
    $this->travelTo('2026-08-15');
    $world = activationWorld();
    $world['old']->update(['status' => AcademicYearStatus::Closed]);
    $world['next']->update(['status' => AcademicYearStatus::Current]);
    $first = activationTerm($world['old'], 1, '2025-09-01', '2025-12-19');

    app(ActivateAcademicYear::class)->handle($world['school'], $world['old'], $world['actor']);

    expect($world['old']->fresh()->status)->toBe(AcademicYearStatus::Current)
        ->and($world['next']->fresh()->status)->toBe(AcademicYearStatus::Planned)
        ->and(activeTermIds($world['school']))->toBe([$first->id]);
});

test('activating a year without terms leaves the school without an active term', function () {
    $this->travelTo('2026-10-01');
    $world = activationWorld();

    app(ActivateAcademicYear::class)->handle($world['school'], $world['next'], $world['actor']);

    expect($world['next']->fresh()->status)->toBe(AcademicYearStatus::Current)
        ->and($world['oldTerm']->fresh()->is_current)->toBeFalse()
        ->and(activeTermIds($world['school']))->toBe([]);
});

test('activating the current year changes nothing', function () {
    $world = activationWorld();
    activationTerm($world['old'], 1, '2025-09-01', '2025-12-19');

    $activated = app(ActivateAcademicYear::class)->handle($world['school'], $world['old'], $world['actor']);

    expect($activated)->toBeFalse()
        ->and(activeTermIds($world['school']))->toBe([$world['oldTerm']->id])
        ->and(AuditEvent::count())->toBe(0);
});

test('repeated activation keeps one current year and one active term', function () {
    $this->travelTo('2026-10-01');
    $world = activationWorld();
    $nextTerm = activationTerm($world['next'], 1, '2026-09-01', '2026-12-18');
    $action = app(ActivateAcademicYear::class);

    $action->handle($world['school'], $world['next'], $world['actor']);
    $action->handle($world['school'], $world['old'], $world['actor']);
    $action->handle($world['school'], $world['next'], $world['actor']);

    expect(AcademicYear::where('school_id', $world['school']->id)->where('status', AcademicYearStatus::Current)->pluck('id')->all())
        ->toBe([$world['next']->id])
        ->and($world['old']->fresh()->status)->toBe(AcademicYearStatus::Closed)
        ->and(activeTermIds($world['school']))->toBe([$nextTerm->id])
        ->and(AuditEvent::where('action', 'activated')->count())->toBe(3);
});

test('activation rolls back year states and terms when the audit cannot be written', function () {
    $this->travelTo('2026-10-01');
    $world = activationWorld();
    $nextTerm = activationTerm($world['next'], 1, '2026-09-01', '2026-12-18');
    AuditEvent::creating(fn () => throw new RuntimeException('Audit store unavailable.'));

    expect(fn () => app(ActivateAcademicYear::class)->handle($world['school'], $world['next'], $world['actor']))
        ->toThrow(RuntimeException::class, 'Audit store unavailable.');

    expect($world['old']->fresh()->status)->toBe(AcademicYearStatus::Current)
        ->and($world['next']->fresh()->status)->toBe(AcademicYearStatus::Planned)
        ->and(activeTermIds($world['school']))->toBe([$world['oldTerm']->id])
        ->and($nextTerm->fresh()->is_current)->toBeFalse();
});

test('activation rejects another schools year without touching either school', function () {
    $world = activationWorld();
    $foreign = activationWorld('activation-other');

    expect(fn () => app(ActivateAcademicYear::class)->handle($world['school'], $foreign['next'], $world['actor']))
        ->toThrow(InvalidArgumentException::class);

    expect($foreign['next']->fresh()->status)->toBe(AcademicYearStatus::Planned)
        ->and($foreign['old']->fresh()->status)->toBe(AcademicYearStatus::Current)
        ->and($world['old']->fresh()->status)->toBe(AcademicYearStatus::Current)
        ->and(AuditEvent::count())->toBe(0);
});
