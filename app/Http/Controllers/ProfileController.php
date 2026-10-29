<?php

namespace App\Http\Controllers;

use App\Http\Requests\Profile\UpdatePasswordRequest;
use App\Http\Requests\Profile\UpdateProfileRequest;
use App\Models\School;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
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
            'schools' => static::schoolsOf($user),
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

    /**
     * Every school on Campus that has a staff account with this person's
     * email, with their role there and where to sign in to it.
     *
     * @return array<int, array{name: string, code: string, role: string, current: bool, login_url: string}>
     */
    public static function schoolsOf(User $user): array
    {
        if ($user->is_platform_admin || ! $user->email) {
            return [];
        }

        $host = (string) parse_url((string) config('app.url'), PHP_URL_HOST);

        return User::where('email', $user->email)
            ->whereNotNull('school_id')
            ->with('school:id,name,code,slug')
            ->get()
            ->filter(fn (User $account) => $account->school instanceof School)
            ->sortBy(fn (User $account) => [$account->id !== $user->id, $account->school?->name])
            ->map(fn (User $account) => [
                'name' => (string) $account->school?->name,
                'code' => (string) $account->school?->code,
                'role' => Str::headline($account->role->value),
                'current' => $account->id === $user->id,
                'login_url' => '//'.$account->school?->slug.'.'.$host.'/login',
            ])
            ->values()
            ->all();
    }

    protected function user(Request $request): User
    {
        $user = $request->user();
        abort_unless($user instanceof User && ! app()->bound('currentPlatformVisit'), 403);

        return $user;
    }
}
