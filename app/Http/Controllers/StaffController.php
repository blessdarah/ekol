<?php

namespace App\Http\Controllers;

use App\Enums\AcademicYearStatus;
use App\Enums\EmploymentType;
use App\Enums\Gender;
use App\Enums\UserRole;
use App\Http\Requests\Staff\SaveStaffAccessRequest;
use App\Http\Requests\Staff\SaveStaffRequest;
use App\Http\Requests\Staff\UpdateStaffHoursRequest;
use App\Mail\StaffInvitationMail;
use App\Models\AcademicYear;
use App\Models\AuditEvent;
use App\Models\Period;
use App\Models\School;
use App\Models\Term;
use App\Models\TimetableSlot;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class StaffController extends Controller
{
    public const int INVITATION_DAYS = 7;

    protected const int PER_PAGE = 9;

    /**
     * The bound school, for a signed-in user allowed to manage staff.
     */
    protected function school(Request $request): School
    {
        $school = app()->bound('currentSchool') ? app('currentSchool') : null;

        if (! $school instanceof School) {
            abort(404);
        }

        abort_unless((bool) $request->user()?->role->managesStaff(), 403);

        return $school;
    }

    protected function member(School $school, string $id): User
    {
        return User::where('school_id', $school->id)->where('id', $id)->firstOrFail();
    }

    public function index(Request $request): Response
    {
        $school = $this->school($request);
        $filter = (string) $request->query('filter', 'all');
        $search = trim((string) $request->query('q', ''));
        $role = UserRole::tryFrom((string) $request->query('role', ''));
        $gender = Gender::tryFrom((string) $request->query('gender', ''));

        $staff = User::where('school_id', $school->id)
            ->with('subjects:id,name')
            ->when($filter === 'government', fn (Builder $query) => $query->where('employment_type', EmploymentType::Government))
            ->when($filter === 'school_paid', fn (Builder $query) => $query->where('employment_type', EmploymentType::SchoolPaid))
            ->when($filter === 'no_account', fn (Builder $query) => $query->whereNull('password'))
            ->when($role, fn (Builder $query) => $query->where('role', $role))
            ->when($gender, fn (Builder $query) => $query->where('gender', $gender))
            ->when($search !== '', fn (Builder $query) => $query->where(fn (Builder $inner) => $inner
                ->whereLike('full_name', "%{$search}%")
                ->orWhereLike('address', "%{$search}%")
                ->orWhereHas('subjects', fn (Builder $subjects) => $subjects->whereLike('name', "%{$search}%"))))
            ->orderByRaw('COALESCE(family_name, full_name)')
            ->orderBy('full_name')
            ->paginate(static::PER_PAGE)
            ->withQueryString();

        $everyone = User::where('school_id', $school->id);

        return Inertia::render('staff/roster', [
            'yearLabel' => $this->yearLabel($school),
            'counts' => [
                'total' => $everyone->clone()->count(),
                'government' => $everyone->clone()->where('employment_type', EmploymentType::Government)->count(),
                'school_paid' => $everyone->clone()->where('employment_type', EmploymentType::SchoolPaid)->count(),
                'no_account' => $everyone->clone()->whereNull('password')->count(),
            ],
            'filters' => [
                'filter' => $filter,
                'q' => $search,
                'role' => $role->value ?? '',
                'gender' => $gender->value ?? '',
            ],
            'roles' => $this->roleOptions(UserRole::cases()),
            'staff' => [
                'rows' => collect($staff->items())->map(fn (User $member) => $this->summary($member)),
                'page' => $staff->currentPage(),
                'lastPage' => $staff->lastPage(),
                'total' => $staff->total(),
            ],
        ]);
    }

    public function create(Request $request): Response
    {
        $school = $this->school($request);

        return Inertia::render('staff/register', [
            'yearLabel' => $this->yearLabel($school),
            'member' => null,
        ]);
    }

    public function store(SaveStaffRequest $request): RedirectResponse
    {
        $school = $this->school($request);
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
            $this->audit($request, $school, $member, 'registered', ['name' => $member->full_name]);

            return $member;
        });

        $this->notify('Staff member added.');

        return redirect()->route('staff.access', $member->id);
    }

    public function show(Request $request, string $staff): Response
    {
        $school = $this->school($request);
        $member = $this->member($school, $staff)->load('subjects:id,name');

        $term = Term::where('school_id', $school->id)->where('is_current', true)->first();
        $lastEdit = AuditEvent::where('entity', 'staff')
            ->where('entity_id', $member->id)
            ->with('actor:id,role')
            ->orderByDesc('occurred_at')
            ->first();

        return Inertia::render('staff/record', [
            'yearLabel' => $this->yearLabel($school),
            'member' => [
                ...$this->summary($member),
                ...$this->details($member),
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
        $school = $this->school($request);
        $member = $this->member($school, $staff);

        return Inertia::render('staff/register', [
            'yearLabel' => $this->yearLabel($school),
            'member' => [
                'id' => $member->id,
                'photo_url' => $this->photoUrl($member),
                ...$this->details($member),
            ],
        ]);
    }

    public function update(SaveStaffRequest $request, string $staff): RedirectResponse
    {
        $school = $this->school($request);
        $member = $this->member($school, $staff);
        $data = $request->validated();

        DB::transaction(function () use ($request, $school, $member, $data) {
            $before = $this->details($member);
            $member->update($this->detailAttributes($data));
            $this->storePhoto($request, $school, $member);

            $this->audit($request, $school, $member, 'corrected', [
                'before' => $before,
                'after' => $this->details($member),
            ]);
        });

        $this->notify('Staff details saved.');

        return redirect()->route('staff.show', $member->id);
    }

    public function access(Request $request, string $staff): Response
    {
        $school = $this->school($request);
        $member = $this->member($school, $staff);
        $term = Term::where('school_id', $school->id)->where('is_current', true)->first();

        return Inertia::render('staff/access', [
            'yearLabel' => $this->yearLabel($school),
            'member' => [
                'id' => $member->id,
                'formal_name' => $member->formalName(),
                'salutation' => $this->salutation($member),
                'gender' => $member->gender?->value,
                'role' => $member->role->value,
                'email' => $member->email,
                'phone' => $member->phone,
                'has_account' => $member->hasPortalAccount(),
                'channel' => $member->invitation_channel ?? 'email',
            ],
            'roles' => $this->roleOptions(UserRole::assignable()),
            'schoolName' => $school->name,
            'termLabel' => $term?->label,
        ]);
    }

    public function saveAccess(SaveStaffAccessRequest $request, string $staff): RedirectResponse
    {
        $school = $this->school($request);
        $member = $this->member($school, $staff);

        $data = $request->validated();

        $before = $member->only(['role', 'email', 'phone']);
        $member->update([
            'role' => $data['role'],
            'email' => $data['email'],
            'phone' => $data['phone'],
            'invitation_channel' => $data['channel'],
        ]);

        $this->audit($request, $school, $member, 'access_saved', [
            'before' => $before,
            'after' => $member->only(['role', 'email', 'phone']),
            'invited' => (bool) $data['create_now'],
        ]);

        if ($data['create_now'] && ! $member->hasPortalAccount()) {
            $this->invite($request, $school, $member, $data['channel']);
        }

        $this->notify('Portal access saved.');

        return redirect()->route('staff.show', $member->id);
    }

    public function remind(Request $request, string $staff): RedirectResponse
    {
        $school = $this->school($request);
        $member = $this->member($school, $staff);

        if (! $member->hasPortalAccount()) {
            $this->invite($request, $school, $member, $member->invitation_channel ?? 'email');
            $this->audit($request, $school, $member, 'invitation_sent', [
                'channel' => $member->invitation_channel,
            ]);
        }

        $this->notify('Invitation sent again.');

        return back();
    }

    public function updateHours(UpdateStaffHoursRequest $request, string $staff): RedirectResponse
    {
        $school = $this->school($request);
        $member = $this->member($school, $staff);

        $data = $request->validated();

        $before = $member->only(array_keys($data));
        $member->update($data);

        $this->audit($request, $school, $member, 'hours_saved', [
            'before' => $before,
            'after' => $member->only(array_keys($data)),
        ]);

        $this->notify('Teaching hours saved.');

        return back();
    }

    /**
     * Issue a fresh seven-day link and deliver it. The link replaces any
     * earlier one; only its hash is stored.
     */
    protected function invite(Request $request, School $school, User $member, string $channel): void
    {
        $token = Str::random(64);

        $member->update([
            'invitation_token_hash' => hash('sha256', $token),
            'invitation_channel' => $channel,
            'invitation_expires_at' => now()->addDays(static::INVITATION_DAYS),
            'invited_at' => now(),
        ]);

        if (in_array($channel, ['email', 'both'], true)) {
            try {
                Mail::to($member->email)->locale($member->locale ?? $school->locale)->send(new StaffInvitationMail(
                    $school,
                    $this->salutation($member),
                    (string) $request->user()?->full_name,
                    route('invitation.show', $token),
                ));
            } catch (\Throwable $exception) {
                Log::warning('Staff invitation email failed.', [
                    'staff_id' => $member->id,
                    'error' => $exception->getMessage(),
                ]);

                throw ValidationException::withMessages([
                    'invitation' => __('The invitation email could not be sent. Check the address and send it again.'),
                ]);
            }
        }

        if (in_array($channel, ['sms', 'both'], true)) {
            Log::warning('Staff invitation SMS pending: no SMS provider is configured.', [
                'staff_id' => $member->id,
            ]);
        }
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

    /**
     * The roster row: who she is at a glance.
     *
     * @return array<string, mixed>
     */
    protected function summary(User $member): array
    {
        return [
            'id' => $member->id,
            'name' => $member->full_name,
            'formal_name' => $member->formalName(),
            'initials' => $member->initials,
            'photo_url' => $this->photoUrl($member),
            'role' => $member->role->value,
            'role_label' => $member->role->label(),
            'subjects' => $member->subjects->pluck('name')->all(),
            'gender' => $member->gender?->value,
            'employment_type' => $member->employment_type?->value,
            'email' => $member->email,
            'phone' => $member->phone,
            'has_account' => $member->hasPortalAccount(),
            'invited_on' => $member->invited_at?->toDateString(),
        ];
    }

    /**
     * The seven registered fields, as the form edits them.
     *
     * @return array<string, mixed>
     */
    protected function details(User $member): array
    {
        return [
            'given_name' => $member->given_name ?? Str::beforeLast($member->full_name, ' '),
            'family_name' => $member->family_name ?? Str::afterLast($member->full_name, ' '),
            'gender' => $member->gender?->value,
            'email' => $member->email,
            'phone' => $member->phone,
            'address' => $member->address,
            'qualification' => $member->qualification,
            'employment_type' => $member->employment_type?->value,
        ];
    }

    /**
     * @param  array<int, UserRole>  $roles
     * @return array<int, array{value: string, label: string, summary: string}>
     */
    protected function roleOptions(array $roles): array
    {
        return array_map(fn (UserRole $role) => [
            'value' => $role->value,
            'label' => $role->label(),
            'summary' => $role->portalSummary(),
        ], $roles);
    }

    protected function salutation(User $member): string
    {
        $title = match ($member->gender) {
            Gender::Female => 'Mrs ',
            Gender::Male => 'Mr ',
            default => '',
        };

        return $title.($member->family_name ?? $member->full_name);
    }

    protected function photoUrl(User $member): ?string
    {
        return $member->photo_path ? "/storage/{$member->photo_path}" : null;
    }

    protected function yearLabel(School $school): ?string
    {
        return AcademicYear::where('school_id', $school->id)
            ->where('status', AcademicYearStatus::Current)
            ->value('label');
    }

    protected function nextStaffCode(School $school): string
    {
        $number = User::withTrashed()->where('school_id', $school->id)->count();

        do {
            $code = 'STF-'.str_pad((string) ++$number, 4, '0', STR_PAD_LEFT);
        } while (User::withTrashed()->where('school_id', $school->id)->where('staff_code', $code)->exists());

        return $code;
    }

    protected function audit(Request $request, School $school, User $member, string $action, mixed $diff): void
    {
        AuditEvent::create([
            'school_id' => $school->id,
            'actor_id' => $request->user()?->id,
            'entity' => 'staff',
            'entity_id' => $member->id,
            'action' => $action,
            'diff' => $diff,
        ]);
    }
}
