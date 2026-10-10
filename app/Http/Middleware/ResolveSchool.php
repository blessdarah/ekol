<?php

namespace App\Http\Middleware;

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

        app()->instance('currentSchool', $school);
        session(['school_id' => $school->id]);

        $user = $request->user();

        if ($user && $user->school_id && $user->school_id !== $school->id) {
            abort(403, 'This account does not belong to this school.');
        }

        return $next($request);
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
