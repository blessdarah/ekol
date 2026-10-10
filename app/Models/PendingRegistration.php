<?php

namespace App\Models;

use App\Enums\AcademicYearStatus;
use App\Mail\VerificationCodeMail;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\ValidationException;

/**
 * Staged school registration. Domain rows (school, user, year, terms)
 * are created only when the verification code is accepted.
 *
 * @property string $id
 * @property array<string, mixed> $school_payload
 * @property array<string, mixed> $admin_payload
 * @property string $code_hash
 * @property string $channel
 * @property int $attempts
 * @property Carbon $expires_at
 * @property Carbon|null $consumed_at
 * @property Carbon $created_at
 */
class PendingRegistration extends Model
{
    use HasUuids;

    public $timestamps = false;

    public const int MAX_ATTEMPTS = 5;

    public const int CODE_TTL_MINUTES = 10;

    protected $fillable = [
        'school_payload',
        'admin_payload',
        'code_hash',
        'channel',
        'attempts',
        'expires_at',
        'consumed_at',
        'created_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'school_payload' => 'array',
            'admin_payload' => 'array',
            'expires_at' => 'datetime',
            'consumed_at' => 'datetime',
            'created_at' => 'datetime',
        ];
    }

    /**
     * Stage a registration and return the pending row plus the plain
     * verification code.
     *
     * @param  array<string, mixed>  $school
     * @param  array<string, mixed>  $admin
     * @return array{0: PendingRegistration, 1: string}
     */
    public static function stage(array $school, array $admin): array
    {
        $admin['password'] = Hash::make($admin['password']);
        $code = (string) random_int(100000, 999999);

        $pending = static::create([
            'school_payload' => $school,
            'admin_payload' => $admin,
            'code_hash' => hash('sha256', $code),
            'expires_at' => now()->addMinutes(static::CODE_TTL_MINUTES),
        ]);

        $pending->sendCode($code);

        return [$pending, $code];
    }

    /**
     * Issue a fresh code, resetting attempts and expiry.
     */
    public function reissue(): string
    {
        $code = (string) random_int(100000, 999999);

        $this->update([
            'code_hash' => hash('sha256', $code),
            'attempts' => 0,
            'expires_at' => now()->addMinutes(static::CODE_TTL_MINUTES),
        ]);

        $this->sendCode($code);

        return $code;
    }

    /**
     * Throw when this row can no longer accept a code.
     */
    public function assertVerifiable(): void
    {
        $this->assertNotConsumed();

        if (now()->greaterThan($this->expires_at)) {
            throw ValidationException::withMessages(['code' => 'This code has expired. Request a new one.']);
        }

        if ($this->attempts >= static::MAX_ATTEMPTS) {
            throw ValidationException::withMessages(['code' => 'Too many attempts. Request a new code.']);
        }
    }

    /**
     * Throw when this registration is already completed. Expired and
     * locked-out rows stay resendable — that is the recovery path.
     */
    public function assertNotConsumed(): void
    {
        if ($this->consumed_at) {
            throw ValidationException::withMessages(['code' => 'This registration has already been completed.']);
        }
    }

    /**
     * Check a submitted code, counting the attempt on mismatch.
     */
    public function attempt(string $code): bool
    {
        $this->assertVerifiable();

        if (! hash_equals($this->code_hash, hash('sha256', $code))) {
            $this->increment('attempts');

            return false;
        }

        return true;
    }

    /**
     * Create the school, its academic year + seeded terms, and the
     * administrator, atomically. Marks this row consumed.
     */
    public function bootstrap(): User
    {
        return DB::transaction(function () {
            $schoolData = $this->school_payload;
            $adminData = $this->admin_payload;

            $school = School::create([
                'name' => $schoolData['name'],
                'code' => $schoolData['code'],
                'slug' => $schoolData['slug'],
                'ownership' => $schoolData['ownership'] ?? 'government',
                'region' => $schoolData['region'] ?? null,
                'town' => $schoolData['town'] ?? null,
                'cycle' => $schoolData['cycle'] ?? null,
                'subsystem' => $schoolData['subsystem'] ?? null,
                'currency' => $schoolData['currency'] ?? 'XAF',
                'timezone' => $schoolData['timezone'] ?? 'Africa/Douala',
            ]);

            $year = $this->seedAcademicYear($school);

            $parts = preg_split('/\s+/', trim($adminData['full_name'])) ?: [];
            $initials = strtoupper(
                substr($parts[0] ?? '', 0, 1).substr(end($parts) ?: '', 0, 1)
            );

            $user = User::create([
                'school_id' => $school->id,
                'staff_code' => $this->nextStaffCode($school),
                'full_name' => $adminData['full_name'],
                'initials' => $initials !== '' ? $initials : 'AD',
                'email' => $adminData['email'],
                'role' => $adminData['role'],
                'phone' => $adminData['phone'],
                'invited_at' => now(),
                'password' => $adminData['password'],
            ]);

            $this->update(['consumed_at' => now()]);

            return $user->setRelation('school', $school);
        });
    }

    /**
     * Seed the first academic year plus three terms derived from today.
     */
    protected function seedAcademicYear(School $school): AcademicYear
    {
        $today = today();
        $startYear = $today->month >= 9 ? $today->year : $today->year - 1;

        $year = AcademicYear::create([
            'school_id' => $school->id,
            'label' => $startYear.'/'.substr((string) ($startYear + 1), -2),
            'starts_on' => Carbon::create($startYear, 9, 1),
            'ends_on' => Carbon::create($startYear + 1, 7, 31),
            'status' => AcademicYearStatus::Current,
        ]);

        $spans = [
            ['Term 1', Carbon::create($startYear, 9, 1)->startOfDay(), Carbon::create($startYear, 12, 31)->startOfDay()],
            ['Term 2', Carbon::create($startYear + 1, 1, 1)->startOfDay(), Carbon::create($startYear + 1, 3, 31)->startOfDay()],
            ['Term 3', Carbon::create($startYear + 1, 4, 1)->startOfDay(), Carbon::create($startYear + 1, 7, 31)->startOfDay()],
        ];

        foreach ($spans as $sequence => [$label, $startsOn, $endsOn]) {
            Term::create([
                'school_id' => $school->id,
                'academic_year_id' => $year->id,
                'label' => $label,
                'sequence' => $sequence + 1,
                'starts_on' => $startsOn,
                'ends_on' => $endsOn,
                'week_count' => (int) ceil($startsOn->diffInDays($endsOn) / 7),
                'is_current' => $today->between($startsOn, $endsOn),
            ]);
        }

        return $year;
    }

    protected function nextStaffCode(School $school): string
    {
        $count = User::where('school_id', $school->id)->count() + 1;

        return 'STF-'.str_pad((string) $count, 4, '0', STR_PAD_LEFT);
    }

    protected function sendCode(string $code): void
    {
        $email = $this->admin_payload['email'] ?? null;

        try {
            Mail::to($email)->send(new VerificationCodeMail($code, static::CODE_TTL_MINUTES));
        } catch (\Throwable $exception) {
            $this->update(['channel' => 'sms']);

            Log::warning('Registration email failed; SMS fallback pending.', [
                'registration_id' => $this->id,
                'error' => $exception->getMessage(),
            ]);
        }
    }

    /**
     * Delete expired, unconsumed rows.
     */
    public static function pruneExpired(): int
    {
        return static::whereNull('consumed_at')
            ->where('expires_at', '<', now())
            ->delete();
    }
}
