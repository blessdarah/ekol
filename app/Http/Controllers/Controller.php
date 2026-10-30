<?php

namespace App\Http\Controllers;

use App\Http\SchoolContext;
use Inertia\Inertia;

abstract class Controller
{
    public function __construct(protected SchoolContext $schoolContext) {}

    /**
     * Tell the user what just happened, once, on the page they land on.
     */
    protected function notify(string $message, string $type = 'success'): void
    {
        Inertia::flash('toast', ['type' => $type, 'message' => __($message)]);
    }
}
