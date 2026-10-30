<?php

namespace App\Http\Middleware;

use App\Http\SchoolContext;
use App\Models\School;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Binds the current school from the request subdomain.
 *
 * Bare-domain requests pass through untouched (general sign-in and
 * registration live there). Reserved subdomains are ignored. Unknown
 * slugs 404. Authenticated users whose school differs from the bound
 * school are denied: a session belongs to exactly one school.
 */
class ResolveSchool
{
    public function __construct(protected SchoolContext $schoolContext) {}

    public function handle(Request $request, Closure $next): Response
    {
        $slug = $this->subdomain($request);

        if ($slug === null || in_array($slug, School::RESERVED_SLUGS, true)) {
            return $next($request);
        }

        $school = School::where('slug', $slug)->first();

        if (! $school) {
            abort(404);
        }

        abort_if($school->is_demo && (! $school->demo_expires_at || $school->demo_expires_at->isPast()), 410, 'This demo has closed.');
        abort_if($school->suspended_at !== null, 403, 'This school is suspended.');

        app()->instance('currentSchool', $school);
        $this->schoolContext->bind($school);
        try {
            if ($school->is_demo) {
                abort_if($request->is('staff/*/access', 'staff/*/reminder', 'parents*', 'pay*', 'fees/mobile-money*'), 403, 'Messages and mobile money are off in demo schools.');
            }
            session(['school_id' => $school->id]);

            $user = $request->user();

            if ($user && $user->school_id && $user->school_id !== $school->id) {
                abort(403, __('This account does not belong to this school.'));
            }

            return $next($request);
        } finally {
            // The school lasts for this request only: nothing after it is
            // left scoped to a school it was not asked about.
            app()->forgetInstance('currentSchool');
            $this->schoolContext->clear();
        }
    }

    protected function subdomain(Request $request): ?string
    {
        $host = strtolower($request->getHost());
        $parent = strtolower((string) parse_url((string) config('app.url'), PHP_URL_HOST));

        if ($host === $parent || ! str_ends_with($host, '.'.$parent)) {
            return null;
        }

        return explode('.', substr($host, 0, -strlen('.'.$parent)))[0] ?: null;
    }
}
