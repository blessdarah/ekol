<?php

namespace App\Models;

use App\Enums\EmploymentType;
use App\Enums\Gender;
use App\Enums\UserRole;
use App\Models\Concerns\BelongsToSchool;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Carbon;

/**
 * Single auth table absorbing ERD `staff` (Option A merge).
 *
 * @property string $id
 * @property string|null $school_id
 * @property string $staff_code
 * @property string $full_name
 * @property string $initials
 * @property string $email
 * @property UserRole $role
 * @property string $phone
 * @property bool $is_form_master
 * @property Carbon|null $invited_at
 * @property Carbon|null $setup_completed_at
 * @property Carbon|null $email_verified_at
 * @property string|null $password
 * @property string|null $given_name
 * @property string|null $family_name
 * @property Gender|null $gender
 * @property string|null $address
 * @property string|null $qualification
 * @property EmploymentType|null $employment_type
 * @property string|null $photo_path
 * @property Carbon|null $joined_on
 * @property int|null $teaching_days
 * @property int|null $max_periods_week
 * @property int|null $max_periods_day
 * @property array<int, array{weekday: int, from: string, to: string, reason: string|null}>|null $unavailable_times
 * @property string|null $invitation_token_hash
 * @property string|null $invitation_channel
 * @property Carbon|null $invitation_expires_at
 * @property string|null $remember_token
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property Carbon|null $deleted_at
 */
#[Fillable(['school_id', 'staff_code', 'full_name', 'initials', 'email', 'role', 'phone', 'is_form_master', 'invited_at', 'setup_completed_at', 'password', 'given_name', 'family_name', 'gender', 'address', 'qualification', 'employment_type', 'photo_path', 'joined_on', 'teaching_days', 'max_periods_week', 'max_periods_day', 'unavailable_times', 'invitation_token_hash', 'invitation_channel', 'invitation_expires_at'])]
#[Hidden(['password', 'remember_token', 'invitation_token_hash'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use BelongsToSchool, HasFactory, HasUuids, Notifiable, SoftDeletes;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'role' => UserRole::class,
            'is_form_master' => 'boolean',
            'invited_at' => 'datetime',
            'setup_completed_at' => 'datetime',
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'gender' => Gender::class,
            'employment_type' => EmploymentType::class,
            'joined_on' => 'date',
            'unavailable_times' => 'array',
            'invitation_expires_at' => 'datetime',
        ];
    }

    /**
     * A person is on the roster from registration; the portal account
     * only exists once she has chosen a password.
     */
    public function hasPortalAccount(): bool
    {
        return $this->password !== null;
    }

    /**
     * Family name first, as registers and report cards print it.
     */
    public function formalName(): string
    {
        return $this->family_name
            ? mb_strtoupper($this->family_name).' '.$this->given_name
            : $this->full_name;
    }

    /**
     * Subjects she teaches, in any class.
     *
     * @return BelongsToMany<Subject, $this>
     */
    public function subjects(): BelongsToMany
    {
        return $this->belongsToMany(Subject::class, 'class_subjects', 'staff_id', 'subject_id')
            ->distinct()
            ->orderBy('name');
    }
}
