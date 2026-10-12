<?php

namespace App\Http\Middleware;

use App\Models\School;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Serve the request in the reader's language: the one a signed-in
 * user chose, else the one picked in this browser, else the school's
 * default.
 */
class SetLocale
{
    /**
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $school = app()->bound('currentSchool') ? app('currentSchool') : null;
        $choices = [
            $request->user()?->locale,
            $request->hasSession() ? $request->session()->get('locale') : null,
            $school instanceof School ? $school->locale : null,
        ];

        foreach ($choices as $locale) {
            if (is_string($locale) && array_key_exists($locale, School::LOCALES)) {
                app()->setLocale($locale);

                break;
            }
        }

        return $next($request);
    }
}
