{{ __('Your :school workspace is live.', ['school' => $school->name]) }}

{{ __('Address: :address', ['address' => $address]) }}
{{ __('Administrator: :name (:email)', ['name' => $administrator->full_name, 'email' => $administrator->email]) }}

{{ __('Staff will sign in at the address above.') }}
