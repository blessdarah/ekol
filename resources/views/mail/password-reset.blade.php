{{ __('Dear :name,', ['name' => $salutation]) }}

{{ __('Someone asked to reset your password for :school. Choose a new one here:', ['school' => $school->name]) }}

{{ $url }}

{{ __('The link works for :minutes minutes and only once. If you did not ask for this, ignore this email: your password stays the same.', ['minutes' => $minutes]) }}

{{ $school->name }}
