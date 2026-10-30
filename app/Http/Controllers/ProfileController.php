<?php

namespace App\Http\Controllers;

use App\Http\Requests\Profile\UpdatePasswordRequest;
use App\Http\Requests\Profile\UpdateProfileRequest;
use App\Models\School;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The signed-in person's own profile: how their name shows, the phone
 * they sign in with, their password and language, and the schools on
 * Campus that know their email. The email itself is set by the school.
 */
class ProfileController extends Controller
{
    public function show(Request $request): Response
    {
        $user = $this->user($request);

        return Inertia::render('profile', [
            'profile' => [
                'given_name' => $user->given_name,
                'family_name' => $user->family_name,
                'full_name' => $user->full_name,
                'initials' => $user->initials,
                'email' => $user->email,
                'phone' => $user->phone,
                'photo_url' => $user->photo_path ? "/storage/{$user->photo_path}" : null,
                'password_changed_on' => $user->password_changed_at?->toDateString(),
            ],
            'schools' => $user->schoolsOf(),
        ]);
    }

    public function update(UpdateProfileRequest $request): RedirectResponse
    {
        $user = $this->user($request);
        $data = $request->validated();
        $given = trim($data['given_name']);
        $family = trim($data['family_name']);
        $fields = [
            'given_name' => $given,
            'family_name' => $family,
            'full_name' => "{$given} {$family}",
            'initials' => mb_strtoupper(mb_substr($given, 0, 1).mb_substr($family, 0, 1)),
            'phone' => trim($data['phone']),
        ];

        if ($request->hasFile('photo')) {
            if ($user->photo_path) {
                Storage::disk('public')->delete($user->photo_path);
            }

            $fields['photo_path'] = $request->file('photo')->store("staff/{$user->school_id}", 'public');
        }

        $user->update($fields);
        $this->notify('Profile saved.');

        return back();
    }

    public function updatePassword(UpdatePasswordRequest $request): RedirectResponse
    {
        $user = $this->user($request);
        $user->forceFill(['password' => $request->validated('password'), 'password_changed_at' => now()])->save();
        $this->notify('Password changed.');

        return back();
    }

    protected function user(Request $request): User
    {
        $user = $request->user();
        abort_unless($user instanceof User && ! app()->bound('currentPlatformVisit'), 403);

        return $user;
    }
}
