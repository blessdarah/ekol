<?php

namespace App\Pulse\Recorders;

use App\Models\School;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Debug\ExceptionHandler;
use Illuminate\Contracts\Foundation\Application;
use Laravel\Pulse\Pulse;
use Throwable;

/**
 * Counts reported exceptions against the school they happened in, so
 * an incident shows at once whether one school or every school is hit.
 * Errors outside a school (the admin site, the landing page, queued
 * jobs) are not counted here; the Exceptions card has them all.
 */
class SchoolExceptions
{
    public function __construct(protected Pulse $pulse) {}

    public function register(callable $record, Application $app): void
    {
        $listen = function (ExceptionHandler $handler) use ($record): void {
            if (method_exists($handler, 'reportable')) {
                $handler->reportable(fn (Throwable $e) => $record($e));
            }
        };

        $app->afterResolving(ExceptionHandler::class, $listen);

        if ($app->resolved(ExceptionHandler::class)) {
            $listen($app->make(ExceptionHandler::class));
        }
    }

    public function record(Throwable $e): void
    {
        $school = app()->bound('currentSchool') ? app('currentSchool') : null;

        if (! $school instanceof School) {
            return;
        }

        $timestamp = CarbonImmutable::now()->getTimestamp();

        $this->pulse->record(
            type: 'school_exception',
            key: $school->id,
            timestamp: $timestamp,
            value: $timestamp,
        )->max()->count();
    }
}
