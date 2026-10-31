<?php

namespace App\Http;

use App\Enums\AcademicYearStatus;
use App\Enums\Gender;
use App\Enums\UserRole;
use App\Models\AcademicYear;
use App\Models\School;
use App\Models\User;
use Illuminate\Support\Str;

class StaffPresentation
{
    /**
     * The roster row: who she is at a glance.
     *
     * @return array<string, mixed>
     */
    public static function summary(User $member): array
    {
        return [
            'id' => $member->id,
            'name' => $member->full_name,
            'formal_name' => $member->formalName(),
            'initials' => $member->initials,
            'photo_url' => self::photoUrl($member),
            'role' => $member->role->value,
            'role_label' => $member->role->label(),
            'subjects' => $member->subjects->pluck('name')->all(),
            'gender' => $member->gender?->value,
            'employment_type' => $member->employment_type?->value,
            'email' => $member->email,
            'phone' => $member->phone,
            'has_account' => $member->hasPortalAccount(),
            'invited_on' => $member->invited_at?->toDateString(),
        ];
    }

    /**
     * The seven registered fields, as the form edits them.
     *
     * @return array<string, mixed>
     */
    public static function details(User $member): array
    {
        return [
            'given_name' => $member->given_name ?? Str::beforeLast($member->full_name, ' '),
            'family_name' => $member->family_name ?? Str::afterLast($member->full_name, ' '),
            'gender' => $member->gender?->value,
            'email' => $member->email,
            'phone' => $member->phone,
            'address' => $member->address,
            'qualification' => $member->qualification,
            'employment_type' => $member->employment_type?->value,
        ];
    }

    /**
     * @param  array<int, UserRole>  $roles
     * @return array<int, array{value: string, label: string, summary: string}>
     */
    public static function roleOptions(array $roles): array
    {
        return array_map(fn (UserRole $role) => [
            'value' => $role->value,
            'label' => $role->label(),
            'summary' => $role->portalSummary(),
        ], $roles);
    }

    public static function salutation(User $member): string
    {
        $title = match ($member->gender) {
            Gender::Female => 'Mrs ',
            Gender::Male => 'Mr ',
            default => '',
        };

        return $title.($member->family_name ?? $member->full_name);
    }

    public static function photoUrl(User $member): ?string
    {
        return $member->photo_path ? "/storage/{$member->photo_path}" : null;
    }

    public static function yearLabel(School $school): ?string
    {
        return AcademicYear::where('school_id', $school->id)
            ->where('status', AcademicYearStatus::Current)
            ->value('label');
    }
}
