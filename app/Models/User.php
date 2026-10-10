<?php

namespace App\Models;

use App\Enums\UserRole;
use App\Models\Concerns\BelongsToSchool;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
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
 * @property string $password
 * @property string|null $remember_token
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property Carbon|null $deleted_at
 */
#[Fillable(['school_id', 'staff_code', 'full_name', 'initials', 'email', 'role', 'phone', 'is_form_master', 'invited_at', 'setup_completed_at', 'password'])]
#[Hidden(['password', 'remember_token'])]
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
        ];
    }
}
