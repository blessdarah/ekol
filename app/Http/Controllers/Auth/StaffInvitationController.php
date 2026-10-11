<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\AcceptInvitationRequest;
use App\Models\School;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class StaffInvitationController extends Controller
{
    protected function school(): School
    {
        $school = app()->bound('currentSchool') ? app('currentSchool') : null;

        if (! $school instanceof School) {
            abort(404);
        }

        return $school;
    }

    /**
     * The invited person behind a link that is still open: right school,
     * not expired, and no password chosen yet.
     */
    protected function invited(School $school, string $token): ?User
    {
        return User::where('school_id', $school->id)
            ->where('invitation_token_hash', hash('sha256', $token))
            ->where('invitation_expires_at', '>', now())
            ->whereNull('password')
            ->first();
    }

    public function show(string $token): Response
    {
        $school = $this->school();
        $member = $this->invited($school, $token)?->load('subjects:id,name');

        return Inertia::render('auth/set-password', [
            'token' => $token,
            'schoolName' => $school->name,
            'member' => $member ? [
                'formal_name' => $member->formalName(),
                'role_label' => $member->role->label(),
                'subjects' => $member->subjects->pluck('name')->all(),
            ] : null,
        ]);
    }

    public function store(AcceptInvitationRequest $request, string $token): RedirectResponse
    {
        $school = $this->school();
        $member = $this->invited($school, $token);

        if (! $member) {
            return redirect()->route('invitation.show', $token);
        }

        $data = $request->validated();

        $member->forceFill([
            'password' => $data['password'],
            'invitation_token_hash' => null,
            'invitation_expires_at' => null,
            'email_verified_at' => $member->email_verified_at ?? now(),
        ])->save();

        Auth::login($member);
        $request->session()->regenerate();
        $request->session()->put('school_id', $school->id);

        return redirect()->route('dashboard');
    }
}
