{{ __('Dear :name,', ['name' => $salutation]) }}

{{ __('You have been registered at :school. Set your portal password to open your account:', ['school' => $school->name]) }}

{{ $url }}

{{ __('The link works for seven days. If it has expired, ask the school to send it again.') }}

{{ $sender }}
{{ $school->name }}
