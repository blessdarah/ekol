<?php

namespace App\Http\Controllers;

use App\Enums\UserRole;
use App\Models\DemoRequest;
use App\Models\DemoSchoolBuilder;
use App\Models\Payment;
use App\Models\PendingRegistration;
use App\Models\School;
use App\Models\SchoolVisit;
use App\Models\Student;
use App\Models\Term;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

class PlatformController extends Controller
{
    public function schools(Request $request): Response
    {
        $data = $request->validate([
            'q' => ['nullable', 'string', 'max:150'],
            'status' => ['nullable', 'in:all,active,quiet,suspended'],
            'school' => ['nullable', 'uuid'],
        ]);
        $schools = School::where('is_demo', false)->withCount('users')
            ->withMax('users', 'last_signed_in_at')->get();
        $schools = $schools->map(function (School $school) {
            $last = $school->getAttribute('users_max_last_signed_in_at');

            return [...$school->only(['id', 'name', 'town', 'slug']),
                'address' => $school->slug.'.'.parse_url((string) config('app.url'), PHP_URL_HOST),
                'staff' => $school->getAttribute('users_count'), 'last_sign_in' => $last,
                'status' => $school->suspended_at ? 'suspended' : ((! $last || now()->parse($last)->lt(now()->subDays(14))) ? 'quiet' : 'active'),
                'students' => 0,
            ];
        });
        $enrolled = Student::whereHas('school', fn ($q) => $q->where('is_demo', false))
            ->whereHas('enrolments', fn ($q) => $q->where('status', 'enrolled')->whereHas('academicYear', fn ($year) => $year->where('status', 'current')))
            ->select('school_id')->selectRaw('count(*) as total')->groupBy('school_id')->pluck('total', 'school_id');
        $schools = $schools->map(fn ($school) => [...$school, 'students' => (int) $enrolled->get($school['id'], 0)]);
        $counts = ['all' => $schools->count(), 'active' => $schools->where('status', 'active')->count(),
            'quiet' => $schools->where('status', 'quiet')->count(), 'suspended' => $schools->where('status', 'suspended')->count()];
        $selected = isset($data['school']) ? School::where('is_demo', false)->whereKey($request->string('school')->toString())->firstOrFail() : null;
        $term = $selected ? Term::where('school_id', $selected->id)->where('is_current', true)->first() : null;
        $activeVisit = SchoolVisit::whereKey($request->session()->get('platform_visit'))
            ->where('user_id', Auth::guard('platform')->id())->whereNull('ended_at')->where('expires_at', '>', now())
            ->with('school:id,name')->first();

        return Inertia::render('platform/schools', [
            ...$this->shared(), 'counts' => $counts, 'students' => $enrolled->sum(),
            'activeVisit' => $activeVisit ? ['school' => $activeVisit->school->name] : null,
            'joined' => School::where('is_demo', false)->where('created_at', '>=', now()->startOfMonth())->count(),
            'activeThisWeek' => $schools->filter(fn ($s) => $s['last_sign_in'] && now()->parse($s['last_sign_in'])->gte(now()->startOfWeek()))->count(),
            'filters' => ['q' => $data['q'] ?? '', 'status' => $data['status'] ?? 'all'],
            'schools' => $schools->filter(fn ($s) => (($data['status'] ?? 'all') === 'all' || $s['status'] === $data['status'])
                && (! ($data['q'] ?? '') || str_contains(mb_strtolower($s['name'].' '.$s['town'].' '.$s['address']), mb_strtolower($data['q']))))
                ->sortByDesc('last_sign_in')->values(),
            'selected' => $selected ? [
                ...$selected->only(['id', 'name', 'slug', 'town', 'region', 'cycle', 'created_at']),
                'administrator' => User::where('school_id', $selected->id)->whereIn('role', [UserRole::Principal, UserRole::Admin])->value('full_name'),
                'term' => $term?->label,
                'fees' => $term ? Payment::whereHas('invoice', fn ($q) => $q->where('term_id', $term->id))->sum('amount') : 0,
                'visits' => SchoolVisit::where('school_id', $selected->id)->with('user:id,full_name')->latest('started_at')->limit(5)->get(),
            ] : null,
        ]);
    }

    public function visit(Request $request, School $school): RedirectResponse
    {
        abort_if($school->is_demo, 404);
        $visit = DB::transaction(function () use ($request, $school) {
            User::whereKey(Auth::guard('platform')->id())->lockForUpdate()->firstOrFail();
            $activeVisit = SchoolVisit::where('user_id', Auth::guard('platform')->id())->whereNull('ended_at')->where('expires_at', '>', now())->first();
            if ($activeVisit) {
                abort_unless($activeVisit->id === $request->session()->get('platform_visit') && $activeVisit->school_id === $school->id, 409, 'End your current school visit first.');

                return $activeVisit;
            }
            $visit = SchoolVisit::create([
                'school_id' => $school->id, 'user_id' => Auth::guard('platform')->id(),
                'started_at' => now(), 'expires_at' => now()->addHour(),
            ]);
            $visit->record('visit.started');

            return $visit;
        });
        $request->session()->put('platform_visit', $visit->id);

        return redirect()->route('dashboard');
    }

    public function leave(Request $request): RedirectResponse
    {
        $visit = SchoolVisit::whereKey($request->session()->get('platform_visit'))->where('user_id', Auth::guard('platform')->id())->first();
        $visit?->finish();
        $request->session()->forget(['platform_visit', 'school_id']);

        return redirect()->route('platform.schools');
    }

    public function visits(): Response
    {
        return Inertia::render('platform/visits', [...$this->shared(),
            'visits' => SchoolVisit::with(['school:id,name', 'user:id,full_name'])->latest('started_at')->paginate(30),
        ]);
    }

    public function signups(): Response
    {
        return Inertia::render('platform/signups', [...$this->shared(),
            'registrations' => PendingRegistration::whereNull('consumed_at')->latest('created_at')->get()
                ->map(fn ($r) => ['id' => $r->id, 'school' => $r->school_payload['name'] ?? '',
                    'name' => $r->admin_payload['full_name'] ?? '', 'email' => $r->admin_payload['email'] ?? '',
                    'created_at' => $r->created_at, 'expired' => $r->expires_at->isPast()]),
        ]);
    }

    public function demos(Request $request): Response
    {
        $data = $request->validate(['status' => ['nullable', 'in:new,contacted,trying,school,closed'], 'demo' => ['nullable', 'uuid']]);
        $counts = DemoRequest::select('status')->selectRaw('count(*) as total')->groupBy('status')->pluck('total', 'status');
        $selected = isset($data['demo']) ? DemoRequest::whereKey($request->string('demo')->toString())->firstOrFail() : null;
        $school = $selected?->demo_school_id ? School::find($selected->demo_school_id) : null;

        return Inertia::render('platform/demos', [...$this->shared(),
            'counts' => $counts, 'status' => $data['status'] ?? 'new',
            'requests' => DemoRequest::where('status', $data['status'] ?? 'new')->latest()->get(),
            'selected' => $selected ? [...$selected->toArray(), 'school' => $school?->only(['slug', 'demo_expires_at']),
                'link' => $school && $school->demo_expires_at?->isFuture() ? DemoSchoolController::link($selected, $school) : null] : null,
        ]);
    }

    public function updateDemo(Request $request, DemoRequest $demo): RedirectResponse
    {
        $data = $request->validate(['action' => ['required', 'in:contact,close,create,extend']]);
        if ($data['action'] === 'create') {
            try {
                app(DemoSchoolBuilder::class)->create($demo);
            } catch (HttpExceptionInterface $exception) {
                throw $exception;
            } catch (\Throwable $exception) {
                report($exception);
                $this->notify('Demo preparation failed. Please try again.', 'error');

                return back();
            }
            $this->notify('Demo school prepared. Its private sign-in link is ready.');

            return back();
        }
        DB::transaction(function () use ($demo, $data) {
            $demo = DemoRequest::whereKey($demo->id)->lockForUpdate()->firstOrFail();
            if ($data['action'] === 'contact') {
                abort_unless($demo->status === 'new', 409);
                $demo->update(['status' => 'contacted', 'handled_at' => now()]);
            } elseif ($data['action'] === 'close') {
                abort_if($demo->status === 'school', 409);
                $demo->update(['status' => 'closed']);
                if ($demo->demo_school_id) {
                    School::whereKey($demo->demo_school_id)->update(['demo_expires_at' => now()]);
                }
            } else {
                abort_if($demo->extended_at || ! $demo->demo_school_id || $demo->status === 'school', 409);
                $school = School::findOrFail($demo->demo_school_id);
                abort_if($school->demo_expires_at->lt(now()->subWeek()), 409);
                $school->forceFill(['demo_expires_at' => $school->demo_expires_at->max(now())->addWeek()])->save();
                $demo->update(['extended_at' => now(), 'status' => 'trying']);
            }
        });
        $this->notify('Demo request updated.');

        return back();
    }

    public function emailDemo(DemoRequest $demo): RedirectResponse
    {
        abort_unless($demo->email && $demo->demo_school_id && $demo->status === 'trying', 409);
        $school = School::findOrFail($demo->demo_school_id);
        abort_unless($school->demo_expires_at?->isFuture(), 410);
        $link = DemoSchoolController::link($demo, $school);
        Mail::raw(__('Your Campus demo school is ready.').' '.$link, fn ($message) => $message->to($demo->email)->subject(__('Your Campus demo school')));
        $this->notify('Demo link emailed.');

        return back();
    }

    /** @return array{platformUser: array<string, mixed>|null, pendingCount: int} */
    protected function shared(): array
    {
        return ['platformUser' => Auth::guard('platform')->user()?->only(['full_name', 'initials']),
            'pendingCount' => PendingRegistration::whereNull('consumed_at')->where('expires_at', '>', now())->count()];
    }
}
