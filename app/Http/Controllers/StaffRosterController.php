<?php

namespace App\Http\Controllers;

use App\Enums\EmploymentType;
use App\Enums\Gender;
use App\Enums\UserRole;
use App\Http\Controllers\Concerns\ListsTables;
use App\Http\StaffPresentation;
use App\Models\School;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class StaffRosterController extends Controller
{
    use ListsTables;

    public function index(Request $request): Response
    {
        $school = $this->schoolContext->school();
        [$query, $filters] = $this->roster($request, $school);

        $staff = $query->with('subjects:id,name')
            ->paginate($this->perPage($request))
            ->withQueryString();

        $everyone = User::where('school_id', $school->id);

        return Inertia::render('staff/roster', [
            'yearLabel' => StaffPresentation::yearLabel($school),
            'counts' => [
                'total' => $everyone->clone()->count(),
                'government' => $everyone->clone()->where('employment_type', EmploymentType::Government)->count(),
                'school_paid' => $everyone->clone()->where('employment_type', EmploymentType::SchoolPaid)->count(),
                'no_account' => $everyone->clone()->whereNull('password')->count(),
            ],
            'filters' => $filters,
            'roles' => StaffPresentation::roleOptions(UserRole::cases()),
            'staff' => [
                'rows' => collect($staff->items())->map(fn (User $member) => StaffPresentation::summary($member)),
                'page' => $staff->currentPage(),
                'lastPage' => $staff->lastPage(),
                'total' => $staff->total(),
                'perPage' => $staff->perPage(),
                'from' => $staff->firstItem(),
                'to' => $staff->lastItem(),
            ],
        ]);
    }

    /**
     * The roster as it is filtered on screen, as a CSV file or a list
     * to print. Selected rows narrow it to those people only.
     */
    public function export(Request $request): StreamedResponse|Response
    {
        $school = $this->schoolContext->school();
        [$query, , $applied] = $this->roster($request, $school);
        $ids = $this->exportIds($request);

        $staff = $query->with('subjects:id,name')
            ->when($ids !== [], fn (Builder $query) => $query->whereIn('id', $ids))
            ->get();

        $rows = $staff->map(fn (User $member) => [
            'name' => $member->full_name,
            'staff_code' => $member->staff_code,
            'role' => $member->role->label(),
            'subjects' => $member->subjects->pluck('name')->join(', '),
            'gender' => $member->gender ? $this->say(Str::headline($member->gender->value)) : '',
            'employment' => $member->employment_type?->label() ?? '',
            'email' => $member->email,
            'phone' => $member->phone,
            'portal' => $member->hasPortalAccount() ? $this->say('Portal on') : $this->say('No account yet'),
            'joined_on' => $member->joined_on?->toDateString() ?? '',
        ]);

        return $this->sendExport($request, $school, $this->say('Staff'), $ids !== [] ? [...$applied, $this->say(':count selected', ['count' => count($ids)])] : $applied, [
            'name' => $this->say('Name'),
            'staff_code' => $this->say('Staff code'),
            'role' => $this->say('Portal role'),
            'subjects' => $this->say('Subjects'),
            'gender' => $this->say('Gender'),
            'employment' => $this->say('Employment'),
            'email' => $this->say('Email'),
            'phone' => $this->say('Phone'),
            'portal' => $this->say('Portal'),
            'joined_on' => $this->say('Joined'),
        ], $rows, $rows->count());
    }

    /**
     * The staff query with the filters, search and sort from the page
     * address applied, the filters as the page shows them, and the same
     * in words for an export.
     *
     * @return array{0: Builder<User>, 1: array<string, mixed>, 2: list<string>}
     */
    protected function roster(Request $request, School $school): array
    {
        $search = trim((string) $request->query('q', ''));
        $employment = $this->many($request, 'employment', array_column(EmploymentType::cases(), 'value'));
        $portal = $this->many($request, 'portal', ['on', 'none']);
        $roles = $this->many($request, 'role', array_column(UserRole::cases(), 'value'));
        $gender = Gender::tryFrom((string) $request->query('gender', ''));
        [$sort, $direction] = $this->sorting($request, ['name', 'role', 'joined'], 'name');

        $query = User::where('school_id', $school->id)
            ->when($employment !== [], fn (Builder $query) => $query->whereIn('employment_type', $employment))
            ->when(count($portal) === 1, fn (Builder $query) => $portal === ['on'] ? $query->whereNotNull('password') : $query->whereNull('password'))
            ->when($roles !== [], fn (Builder $query) => $query->whereIn('role', $roles))
            ->when($gender, fn (Builder $query) => $query->where('gender', $gender))
            ->when($search !== '', fn (Builder $query) => $query->where(fn (Builder $inner) => $inner
                ->whereLike('full_name', "%{$search}%")
                ->orWhereLike('address', "%{$search}%")
                ->orWhereHas('subjects', fn (Builder $subjects) => $subjects->whereLike('name', "%{$search}%"))));

        match ($sort) {
            'role' => $query->orderBy('role', $direction)->orderByRaw('COALESCE(family_name, full_name)'),
            'joined' => $query->orderBy('joined_on', $direction)->orderBy('full_name'),
            default => $query->orderByRaw('COALESCE(family_name, full_name) '.$direction)->orderBy('full_name', $direction),
        };

        $applied = array_values(array_filter([
            $search !== '' ? $this->say('Search: :q', ['q' => $search]) : null,
            $employment !== [] ? $this->say('Employment: :value', ['value' => implode(', ', array_map(fn (string $type) => EmploymentType::from($type)->label(), $employment))]) : null,
            $portal !== [] ? $this->say('Portal: :value', ['value' => implode(', ', array_map(fn (string $state) => $state === 'on' ? $this->say('Portal on') : $this->say('No account yet'), $portal))]) : null,
            $roles !== [] ? $this->say('Role: :value', ['value' => implode(', ', array_map(fn (string $role) => UserRole::from($role)->label(), $roles))]) : null,
            $gender ? $this->say('Gender: :value', ['value' => $this->say(Str::headline($gender->value))]) : null,
        ]));

        return [$query, [
            'q' => $search,
            'employment' => $employment,
            'portal' => $portal,
            'role' => $roles,
            'gender' => $gender->value ?? '',
            'sort' => ($direction === 'desc' ? '-' : '').$sort,
        ], $applied];
    }
}
