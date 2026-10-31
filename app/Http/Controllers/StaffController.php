<?php

namespace App\Http\Controllers;

use App\Enums\UserRole;
use App\Http\Requests\Staff\SaveStaffRequest;
use App\Http\Requests\Staff\UpdateStaffHoursRequest;
use App\Http\StaffPresentation;
use App\Models\AuditEvent;
use App\Models\Period;
use App\Models\School;
use App\Models\Term;
use App\Models\TimetableSlot;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class StaffController extends Controller
{
    protected function member(School $school, string $id): User
    {
        return User::where('school_id', $school->id)->where('id', $id)->firstOrFail();
    }

    public function create(Request $request): Response
    {
        $school = $this->schoolContext->school();

        return Inertia::render('staff/register', [
            'yearLabel' => StaffPresentation::yearLabel($school),
            'member' => null,
        ]);
    }

    public function store(SaveStaffRequest $request): RedirectResponse
    {
        $school = $this->schoolContext->school();
        $data = $request->validated();

        $member = DB::transaction(function () use ($request, $school, $data) {
            $member = User::create([
                ...$this->detailAttributes($data),
                'school_id' => $school->id,
                'staff_code' => $this->nextStaffCode($school),
                'role' => UserRole::Teacher,
                'joined_on' => today(),
            ]);

            $this->storePhoto($request, $school, $member);
            AuditEvent::record($school, $request->user(), 'staff', $member->id, 'registered', ['name' => $member->full_name]);

            return $member;
        });

        $this->notify('Staff member added.');

        return redirect()->route('staff.access', $member->id);
    }

    public function show(Request $request, string $staff): Response
    {
        $school = $this->schoolContext->school();
        $member = $this->member($school, $staff)->load('subjects:id,name');

        $term = Term::where('school_id', $school->id)->where('is_current', true)->first();
        $lastEdit = AuditEvent::where('entity', 'staff')
            ->where('entity_id', $member->id)
            ->with('actor:id,role')
            ->orderByDesc('occurred_at')
            ->first();

        return Inertia::render('staff/record', [
            'yearLabel' => StaffPresentation::yearLabel($school),
            'member' => [
                ...StaffPresentation::summary($member),
                ...StaffPresentation::details($member),
                'joined_on' => $member->joined_on?->toDateString(),
                'invitation_expired' => ! $member->hasPortalAccount()
                    && $member->invitation_expires_at?->isPast() === true,
                'teaching_days' => $member->teaching_days,
                'max_periods_week' => $member->max_periods_week,
                'max_periods_day' => $member->max_periods_day,
                'unavailable_times' => $member->unavailable_times ?? [],
                'periods_taught' => $term
                    ? TimetableSlot::where('staff_id', $member->id)->where('term_id', $term->id)->count()
                    : 0,
            ],
            'schoolDays' => $school->school_days,
            'periods' => Period::where('school_id', $school->id)
                ->where('is_break', false)
                ->orderBy('starts_at')
                ->pluck('label'),
            'lastEdit' => $lastEdit ? [
                'by' => $lastEdit->actor ? Str::lower($lastEdit->actor->role->label()) : null,
                'on' => $lastEdit->occurred_at->toDateString(),
            ] : null,
        ]);
    }

    public function edit(Request $request, string $staff): Response
    {
        $school = $this->schoolContext->school();
        $member = $this->member($school, $staff);

        return Inertia::render('staff/register', [
            'yearLabel' => StaffPresentation::yearLabel($school),
            'member' => [
                'id' => $member->id,
                'photo_url' => StaffPresentation::photoUrl($member),
                ...StaffPresentation::details($member),
            ],
        ]);
    }

    public function update(SaveStaffRequest $request, string $staff): RedirectResponse
    {
        $school = $this->schoolContext->school();
        $member = $this->member($school, $staff);
        $data = $request->validated();

        DB::transaction(function () use ($request, $school, $member, $data) {
            $before = StaffPresentation::details($member);
            $member->update($this->detailAttributes($data));
            $this->storePhoto($request, $school, $member);

            AuditEvent::record($school, $request->user(), 'staff', $member->id, 'corrected', [
                'before' => $before,
                'after' => StaffPresentation::details($member),
            ]);
        });

        $this->notify('Staff details saved.');

        return redirect()->route('staff.show', $member->id);
    }

    public function updateHours(UpdateStaffHoursRequest $request, string $staff): RedirectResponse
    {
        $school = $this->schoolContext->school();
        $member = $this->member($school, $staff);

        $data = $request->validated();

        $before = $member->only(array_keys($data));
        $member->update($data);

        AuditEvent::record($school, $request->user(), 'staff', $member->id, 'hours_saved', [
            'before' => $before,
            'after' => $member->only(array_keys($data)),
        ]);

        $this->notify('Teaching hours saved.');

        return back();
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    protected function detailAttributes(array $data): array
    {
        $given = trim((string) $data['given_name']);
        $family = trim((string) $data['family_name']);

        return [
            'given_name' => $given,
            'family_name' => $family,
            'full_name' => "{$given} {$family}",
            'initials' => mb_strtoupper(mb_substr($given, 0, 1).mb_substr($family, 0, 1)),
            'gender' => $data['gender'],
            'email' => $data['email'],
            'phone' => $data['phone'],
            'address' => $data['address'],
            'qualification' => $data['qualification'],
            'employment_type' => $data['employment_type'],
        ];
    }

    protected function storePhoto(Request $request, School $school, User $member): void
    {
        if (! $request->hasFile('photo')) {
            return;
        }

        if ($member->photo_path) {
            Storage::disk('public')->delete($member->photo_path);
        }

        $member->update([
            'photo_path' => $request->file('photo')->store("staff/{$school->id}", 'public'),
        ]);
    }

    protected function nextStaffCode(School $school): string
    {
        $number = User::withTrashed()->where('school_id', $school->id)->count();

        do {
            $code = 'STF-'.str_pad((string) ++$number, 4, '0', STR_PAD_LEFT);
        } while (User::withTrashed()->where('school_id', $school->id)->where('staff_code', $code)->exists());

        return $code;
    }
}
