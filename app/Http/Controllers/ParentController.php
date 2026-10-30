<?php

namespace App\Http\Controllers;

use App\Http\Requests\Pay\FindChildRequest;
use App\Http\Requests\Pay\VerifyParentCodeRequest;
use App\Models\Attendance;
use App\Models\MobilePayment;
use App\Models\Money;
use App\Models\School;
use App\Models\Student;
use App\Notifications\ParentVerificationCode;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cookie;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Undjike\CamooNotificationChannel\CamooChannel;

/**
 * Parent services, on the main address so a parent never needs the
 * school's own: find the school, prove the child is theirs with the
 * matricule, the phone the school has and a code sent to that phone,
 * then pay fees or follow attendance. The child chosen is kept in the
 * session, and the device is remembered for the child for a while.
 */
class ParentController extends Controller
{
    /**
     * The services a parent can open, in the order they are listed.
     */
    public const array SERVICES = ['pay', 'attendance', 'announcements'];

    protected const int CODE_MINUTES = 10;

    protected const int CODE_ATTEMPTS = 5;

    protected const int RESEND_AFTER_SECONDS = 60;

    protected const int CODES_PER_HOUR = 5;

    protected const int TRUST_DAYS = 30;

    /**
     * Remembers, on this device, the children whose code was typed.
     */
    protected const string TRUST_COOKIE = 'parent_trust';

    public function show(Request $request): Response|RedirectResponse
    {
        $student = Student::forParentSelection($request->session()->get('parent'));

        if ($student) {
            return redirect()->route('parents.home');
        }

        $slug = $request->query('school');
        $school = is_string($slug) ? School::where('slug', $slug)->first() : null;

        return Inertia::render('parents/start', [
            'school' => $school ? static::schoolCard($school) : null,
            'services' => static::SERVICES,
        ]);
    }

    /**
     * A school's own address sends parents to the main one, with the
     * school already chosen.
     */
    public function fromSchool(): RedirectResponse
    {
        $school = ($this->schoolContext->hasSchool() ? $this->schoolContext->school() : null);
        $query = $school instanceof School ? '?school='.rawurlencode($school->slug) : '';

        return redirect()->away('//'.parse_url((string) config('app.url'), PHP_URL_HOST).'/parents'.$query);
    }

    /**
     * Schools whose name, town or address matches what the parent typed.
     */
    public function schools(Request $request): JsonResponse
    {
        $search = mb_strtolower(trim((string) $request->query('q', '')));

        if (mb_strlen($search) < 2) {
            return response()->json(['schools' => []]);
        }

        $schools = School::query()
            ->where(fn ($query) => $query
                ->whereRaw('LOWER(name) LIKE ?', ["%{$search}%"])
                ->orWhereRaw('LOWER(slug) LIKE ?', ["%{$search}%"])
                ->orWhereRaw('LOWER(code) LIKE ?', ["%{$search}%"])
                ->orWhereRaw('LOWER(town) LIKE ?', ["%{$search}%"]))
            ->orderBy('name')
            ->limit(8)
            ->get();

        return response()->json(['schools' => $schools->map(fn (School $school) => static::schoolCard($school))->values()]);
    }

    public function find(FindChildRequest $request): RedirectResponse
    {
        $data = $request->validated();
        $school = School::where('slug', $data['school'])->firstOrFail();
        $student = Student::where('school_id', $school->id)
            ->whereRaw('UPPER(admission_no) = ?', [mb_strtoupper(trim($data['matricule']))])
            ->with('guardians')
            ->first();
        $phone = MobilePayment::localDigits($data['phone']);
        $phones = $student
            ? collect([$student->guardian_phone, ...$student->guardians->pluck('phone')->all()])
                ->filter()
                ->map(fn ($known) => MobilePayment::localDigits((string) $known))
            : collect();

        if (! $student || $phone === '' || ! $phones->contains($phone)) {
            throw ValidationException::withMessages([
                'matricule' => __('No student matches that matricule and phone number. Check both, or ask the bursar’s office.'),
            ]);
        }

        if (in_array(static::trustKey($student->id, $phone), static::trusted($request), true)) {
            return $this->enter($request, $school->id, $student->id, $phone);
        }

        $this->sendCode($request, $school, $student->id, $phone);

        return redirect()->route('parents.verify');
    }

    /**
     * The page to type the code sent by SMS.
     */
    public function verification(Request $request): Response|RedirectResponse
    {
        $pending = static::pending($request);
        $school = $pending ? School::whereKey($pending['school_id'])->first() : null;

        if (! $pending || ! $school) {
            return redirect()->route('parents');
        }

        return Inertia::render('parents/verify', [
            'issuer' => $school->issuer(),
            'phone' => static::maskedPhone($pending['phone']),
            'expiresAt' => Carbon::createFromTimestamp($pending['expires_at'])->toIso8601String(),
            'resendAt' => Carbon::createFromTimestamp($pending['sent_at'] + static::RESEND_AFTER_SECONDS)->toIso8601String(),
        ]);
    }

    /**
     * Check the code. The right one opens parent services and remembers
     * this phone for the child, so the next visit needs no code.
     */
    public function verify(VerifyParentCodeRequest $request): RedirectResponse
    {
        $pending = static::pending($request);

        if (! $pending) {
            return redirect()->route('parents');
        }

        if ($pending['expires_at'] < now()->getTimestamp()) {
            throw ValidationException::withMessages(['code' => __('This code has expired. Request a new one.')]);
        }

        if ($pending['attempts'] >= static::CODE_ATTEMPTS) {
            throw ValidationException::withMessages(['code' => __('Too many attempts. Request a new code.')]);
        }

        if (! hash_equals($pending['code_hash'], hash('sha256', (string) $request->validated('code')))) {
            $request->session()->put('parent_pending.attempts', $pending['attempts'] + 1);

            throw ValidationException::withMessages(['code' => __('That code is not right. Check the SMS and try again.')]);
        }

        $request->session()->forget('parent_pending');
        $trusted = array_slice(array_values(array_unique([static::trustKey($pending['student_id'], $pending['phone']), ...static::trusted($request)])), 0, 10);
        Cookie::queue(static::TRUST_COOKIE, (string) json_encode($trusted), static::TRUST_DAYS * 24 * 60);

        return $this->enter($request, $pending['school_id'], $pending['student_id'], $pending['phone']);
    }

    /**
     * Send a fresh code, a minute after the last one at the earliest.
     */
    public function resend(Request $request): RedirectResponse
    {
        $pending = static::pending($request);
        $school = $pending ? School::whereKey($pending['school_id'])->first() : null;

        if (! $pending || ! $school) {
            return redirect()->route('parents');
        }

        if (now()->getTimestamp() < $pending['sent_at'] + static::RESEND_AFTER_SECONDS) {
            throw ValidationException::withMessages(['code' => __('Wait a minute before asking for another code.')]);
        }

        $this->sendCode($request, $school, $pending['student_id'], $pending['phone'], 'code');
        $this->notify('A new code is on its way.');

        return redirect()->route('parents.verify');
    }

    /**
     * The child's page: what is owed, how attendance looks this term,
     * and the services to open.
     */
    public function home(Request $request): Response|RedirectResponse
    {
        $student = Student::forParentSelection($request->session()->get('parent'));

        if (! $student) {
            return redirect()->route('parents');
        }

        $school = $student->school;

        $invoice = $student->openInvoice();
        $ledger = $invoice?->ledgerMinor();
        $next = collect($ledger['installments'] ?? [])->first(fn (array $row) => $row['state'] !== 'paid');
        $term = $school->terms()->current()->first();
        $attendance = Attendance::summary($student, $term);

        return Inertia::render('parents/home', [
            'issuer' => $school->issuer(),
            'student' => $student->parentCard(),
            'fees' => [
                'balance' => $ledger ? Money::number($ledger['balance']) : 0,
                'overdue' => $ledger ? Money::number($ledger['overdue']) : 0,
                'next' => $next ? ['label' => $next['label'], 'due_on' => $next['due_on']] : null,
            ],
            'attendance' => [
                'term' => $term?->label,
                'rate' => $attendance['stats']['rate'],
                'absent' => $attendance['stats']['absent'],
                'late' => $attendance['stats']['late'],
            ],
            'services' => static::SERVICES,
        ]);
    }

    /**
     * The child's term so far: the days counted and every absence or
     * late arrival, newest first.
     */
    public function attendance(Request $request): Response|RedirectResponse
    {
        $student = Student::forParentSelection($request->session()->get('parent'));

        if (! $student) {
            return redirect()->route('parents');
        }

        $school = $student->school;

        $term = $school->terms()->current()->first();
        $summary = Attendance::summary($student, $term);

        return Inertia::render('parents/attendance', [
            'issuer' => $school->issuer(),
            'student' => $student->parentCard(),
            'termLabel' => $term?->label,
            'stats' => $summary['stats'],
            'events' => array_map(fn (array $event) => [
                'id' => $event['id'],
                'on' => $event['on'],
                'status' => $event['status'],
                'lesson' => $event['lesson'],
                'note' => $event['note'],
            ], $summary['events']),
        ]);
    }

    /**
     * Forget the child, to look up another one or leave a shared phone.
     */
    public function leave(Request $request): RedirectResponse
    {
        $request->session()->forget('parent');

        return redirect()->route('parents');
    }

    protected function enter(Request $request, string $schoolId, string $studentId, string $phone): RedirectResponse
    {
        $request->session()->regenerate();
        $request->session()->put('parent', ['school_id' => $schoolId, 'student_id' => $studentId, 'phone' => $phone]);

        return redirect()->route('parents.home');
    }

    /**
     * Queue a new code for the guardian phone and keep its hash in the
     * session, so the page answers without waiting on the SMS gateway.
     * A number gets a few codes an hour at most.
     */
    protected function sendCode(Request $request, School $school, string $studentId, string $phone, string $errorField = 'matricule'): void
    {
        $limit = 'parent-code:'.$phone;

        if (RateLimiter::tooManyAttempts($limit, static::CODES_PER_HOUR)) {
            throw ValidationException::withMessages([$errorField => __('Too many codes were sent to this number. Try again in :minutes minutes.', [
                'minutes' => max(1, (int) ceil(RateLimiter::availableIn($limit) / 60)),
            ])]);
        }

        $code = (string) random_int(100000, 999999);

        Notification::route(CamooChannel::class, '+237'.$phone)
            ->notify((new ParentVerificationCode($code, $school->name, $school->id))->locale(app()->getLocale()));

        RateLimiter::hit($limit, 3600);
        $request->session()->put('parent_pending', [
            'school_id' => $school->id,
            'student_id' => $studentId,
            'phone' => $phone,
            'code_hash' => hash('sha256', $code),
            'expires_at' => now()->addMinutes(static::CODE_MINUTES)->getTimestamp(),
            'attempts' => 0,
            'sent_at' => now()->getTimestamp(),
        ]);
    }

    /**
     * The code waiting to be typed, if any.
     *
     * @return array{school_id: string, student_id: string, phone: string, code_hash: string, expires_at: int, attempts: int, sent_at: int}|null
     */
    protected static function pending(Request $request): ?array
    {
        $pending = $request->session()->get('parent_pending');

        return is_array($pending) && isset($pending['school_id'], $pending['student_id'], $pending['phone'], $pending['code_hash'], $pending['expires_at'], $pending['attempts'], $pending['sent_at'])
            ? $pending
            : null;
    }

    /**
     * The children this device has already proved, as hashed keys.
     *
     * @return list<string>
     */
    protected static function trusted(Request $request): array
    {
        $cookie = $request->cookie(static::TRUST_COOKIE);
        $keys = is_string($cookie) ? json_decode($cookie, true) : [];

        return is_array($keys) ? array_values(array_filter($keys, 'is_string')) : [];
    }

    protected static function trustKey(string $studentId, string $phone): string
    {
        return hash('sha256', $studentId.'|'.$phone);
    }

    /**
     * "6•• ••• •56": enough for the parent to recognise their number.
     */
    protected static function maskedPhone(string $phone): string
    {
        return substr($phone, 0, 1).'•• ••• •'.substr($phone, -2);
    }

    /**
     * @return array{slug: string, name: string, place: string|null}
     */
    protected static function schoolCard(School $school): array
    {
        return [
            'slug' => $school->slug,
            'name' => $school->name,
            'place' => collect([$school->town, $school->region])->filter()->join(', ') ?: null,
        ];
    }
}
