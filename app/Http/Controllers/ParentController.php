<?php

namespace App\Http\Controllers;

use App\Enums\EnrolmentStatus;
use App\Http\Requests\Pay\FindChildRequest;
use App\Models\Enrolment;
use App\Models\FeeItem;
use App\Models\Invoice;
use App\Models\MobilePayment;
use App\Models\School;
use App\Models\Student;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Parent services, on the main address so a parent never needs the
 * school's own: find the school, prove the child is theirs with the
 * matricule and the phone the school has, then pay fees or follow
 * attendance. The child chosen is kept in the session.
 */
class ParentController extends Controller
{
    /**
     * The services a parent can open, in the order they are listed.
     */
    public const array SERVICES = ['pay', 'attendance', 'announcements'];

    public function show(Request $request): Response|RedirectResponse
    {
        [, $student] = static::child($request);

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
        $school = app()->bound('currentSchool') ? app('currentSchool') : null;
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

        $request->session()->regenerate();
        $request->session()->put('parent', ['school_id' => $school->id, 'student_id' => $student->id, 'phone' => $phone]);

        return redirect()->route('parents.home');
    }

    /**
     * The child's page: what is owed, how attendance looks this term,
     * and the services to open.
     */
    public function home(Request $request): Response|RedirectResponse
    {
        [$school, $student] = static::child($request);

        if (! $school || ! $student) {
            return redirect()->route('parents');
        }

        $invoice = static::openInvoice($student);
        $ledger = $invoice?->ledger();
        $next = collect($ledger['installments'] ?? [])->first(fn (array $row) => $row['state'] !== 'paid');
        $term = StudentController::currentTerm($school);
        $attendance = StudentAttendanceController::summary($student, $term);

        return Inertia::render('parents/home', [
            'issuer' => static::issuer($school),
            'student' => static::studentCard($student),
            'fees' => [
                'balance' => $ledger ? (int) round($ledger['balance']) : 0,
                'overdue' => $ledger ? (int) round($ledger['overdue']) : 0,
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
        [$school, $student] = static::child($request);

        if (! $school || ! $student) {
            return redirect()->route('parents');
        }

        $term = StudentController::currentTerm($school);
        $summary = StudentAttendanceController::summary($student, $term);

        return Inertia::render('parents/attendance', [
            'issuer' => static::issuer($school),
            'student' => static::studentCard($student),
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

    /**
     * The school and child the parent proved are theirs.
     *
     * @return array{0: School|null, 1: Student|null}
     */
    public static function child(Request $request): array
    {
        $chosen = $request->session()->get('parent');

        if (! is_array($chosen) || ! is_string($chosen['school_id'] ?? null) || ! is_string($chosen['student_id'] ?? null)) {
            return [null, null];
        }

        $school = School::whereKey($chosen['school_id'])->first();
        $student = $school ? Student::where('school_id', $school->id)->whereKey($chosen['student_id'])->first() : null;

        return $student ? [$school, $student] : [null, null];
    }

    /**
     * The child's oldest invoice with something still owed.
     */
    public static function openInvoice(Student $student): ?Invoice
    {
        return Invoice::where('student_id', $student->id)
            ->with(['installments', 'lines', 'payments', 'exemption'])
            ->orderBy('issued_on')
            ->get()
            ->first(fn (Invoice $candidate) => $candidate->ledger()['balance'] > 0);
    }

    /**
     * @return array{name: string, code: string}
     */
    public static function issuer(School $school): array
    {
        return ['name' => $school->name, 'code' => $school->code];
    }

    /**
     * @return array{name: string, matricule: string, class: string|null, year: string|null, line: string}
     */
    public static function studentCard(Student $student): array
    {
        $year = StructureController::currentYear(School::whereKey($student->school_id)->firstOrFail());
        $class = $year
            ? Enrolment::where('student_id', $student->id)
                ->where('academic_year_id', $year->id)
                ->where('status', '!=', EnrolmentStatus::Left)
                ->with('schoolClass:id,name')
                ->first()?->schoolClass?->name
            : null;

        return [
            'name' => $student->full_name,
            'matricule' => $student->admission_no,
            'class' => $class,
            'year' => $year?->label,
            'line' => FeeItem::TUITION,
        ];
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
