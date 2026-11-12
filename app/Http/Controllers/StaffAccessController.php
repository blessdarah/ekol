<?php

namespace App\Http\Controllers;

use App\Actions\Staff\InviteStaffMember;
use App\Actions\Staff\SaveStaffAccess;
use App\Enums\UserRole;
use App\Http\Requests\Staff\SaveStaffAccessRequest;
use App\Http\StaffPresentation;
use App\Models\School;
use App\Models\Term;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class StaffAccessController extends Controller
{
    protected function member(School $school, string $id): User
    {
        return User::where('school_id', $school->id)->where('id', $id)->firstOrFail();
    }

    public function access(Request $request, string $staff): Response
    {
        $school = $this->schoolContext->school();
        $member = $this->member($school, $staff);
        $term = Term::where('school_id', $school->id)->where('is_current', true)->first();

        return Inertia::render('staff/access', [
            'yearLabel' => StaffPresentation::yearLabel($school),
            'member' => [
                'id' => $member->id,
                'formal_name' => $member->formalName(),
                'salutation' => StaffPresentation::salutation($member),
                'gender' => $member->gender?->value,
                'role' => $member->role->value,
                'email' => $member->email,
                'phone' => $member->phone,
                'has_account' => $member->hasPortalAccount(),
                'channel' => $member->invitation_channel ?? 'email',
            ],
            'roles' => StaffPresentation::roleOptions(UserRole::assignable()),
            'schoolName' => $school->name,
            'termLabel' => $term?->label,
        ]);
    }

    public function saveAccess(SaveStaffAccessRequest $request, SaveStaffAccess $saveAccess, string $staff): RedirectResponse
    {
        $school = $this->schoolContext->school();
        $member = $saveAccess->handle($school, $this->member($school, $staff), $request->user(), $request->accessData());

        $this->notify('Portal access saved.');

        return redirect()->route('staff.show', $member->id);
    }

    public function remind(Request $request, InviteStaffMember $invite, string $staff): RedirectResponse
    {
        $school = $this->schoolContext->school();
        $invite->handle($school, $this->member($school, $staff), $request->user());

        $this->notify('Invitation sent again.');

        return back();
    }
}
