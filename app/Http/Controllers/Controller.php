<?php

namespace App\Http\Controllers;

use Inertia\Inertia;

abstract class Controller
{
    /**
     * Tell the user what just happened, once, on the page they land on.
     */
    protected function notify(string $message, string $type = 'success'): void
    {
        Inertia::flash('toast', ['type' => $type, 'message' => __($message)]);
    }
}
