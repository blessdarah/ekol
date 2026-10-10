<?php

namespace App\Http\Middleware;

use App\Enums\InvoiceStatus;
use App\Models\Invoice;
use App\Models\School;
use App\Models\Term;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        return [
            ...parent::share($request),
            'name' => config('app.name'),
            'auth' => [
                'user' => $request->user(),
            ],
            'school' => fn () => $this->sharedSchool($request),
            'term' => fn () => $this->sharedTerm($request),
            'shellUser' => fn () => $this->sharedShellUser($request),
            'feeBadge' => fn () => $this->sharedFeeBadge($request),
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    protected function sharedSchool(Request $request): ?array
    {
        $school = $this->currentSchool($request);

        if (! $school) {
            return null;
        }

        return [
            'id' => $school->id,
            'name' => $school->name,
            'code' => $school->code,
            'slug' => $school->slug,
            'role' => $request->user()?->role->value,
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    protected function sharedTerm(Request $request): ?array
    {
        $school = $this->currentSchool($request);

        if (! $school) {
            return null;
        }

        $term = Term::where('school_id', $school->id)
            ->where('is_current', true)
            ->first();

        if (! $term) {
            return null;
        }

        // Signed in Carbon 3: past dates come back negative.
        $days = abs((int) today()->diffInDays($term->starts_on));
        $week = (int) floor($days / 7) + 1;
        $week = max(1, min($week, $term->week_count));

        return [
            'label' => $term->label,
            'weekLabel' => "Week {$week} of {$term->week_count}",
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    protected function sharedShellUser(Request $request): ?array
    {
        $user = $request->user();

        if (! $user) {
            return null;
        }

        return [
            'full_name' => $user->full_name,
            'roleLabel' => Str::headline($user->role->value),
        ];
    }

    protected function sharedFeeBadge(Request $request): ?int
    {
        $school = $this->currentSchool($request);

        if (! $school) {
            return null;
        }

        $count = Invoice::where('status', InvoiceStatus::Overdue)
            ->whereHas('student', fn ($query) => $query->where('school_id', $school->id))
            ->count();

        return $count > 0 ? $count : null;
    }

    protected function currentSchool(Request $request): ?School
    {
        if (app()->bound('currentSchool') && app('currentSchool') instanceof School) {
            return app('currentSchool');
        }

        $schoolId = $request->session()->get('school_id');

        return $schoolId ? School::whereKey($schoolId)->first() : null;
    }
}
