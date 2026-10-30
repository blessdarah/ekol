<?php

use App\Mail\PasswordResetMail;
use App\Mail\StaffInvitationMail;
use App\Mail\VerificationCodeMail;
use App\Mail\WorkspaceReadyMail;
use App\Models\School;
use App\Models\User;
use Illuminate\Contracts\Mail\Factory;
use Illuminate\Mail\SendQueuedMailable;
use Illuminate\Mail\Transport\ArrayTransport;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;

test('transactional mail is delivered by the worker in its original language', function (string $kind, string $subject) {
    config(['mail.default' => 'array']);
    Queue::fake();
    $school = School::create(['name' => 'Academy', 'slug' => 'maila', 'code' => 'MA', 'currency' => 'XAF', 'timezone' => 'Africa/Douala']);
    $user = User::factory()->create(['school_id' => $school->id]);
    $mail = match ($kind) {
        'invitation' => new StaffInvitationMail($school, 'Ada', 'Principal', 'https://maila.ekol.test/invitation/token'),
        'reset' => new PasswordResetMail($school, 'Ada', 'https://maila.ekol.test/reset-password/token', 60),
        'ready' => new WorkspaceReadyMail($school, $user, 'https://maila.ekol.test'),
        'verification' => new VerificationCodeMail('123456', 10),
    };

    Mail::to('ada@example.com')->locale('fr')->send($mail);

    $transport = Mail::mailer()->getSymfonyTransport();
    expect($transport)->toBeInstanceOf(ArrayTransport::class)
        ->and($transport->messages())->toBeEmpty();
    $job = null;
    Queue::assertPushed(SendQueuedMailable::class, function (SendQueuedMailable $queued) use (&$job) {
        $job = $queued;

        return $queued->tries === 3 && $queued->backoff() === [10, 30] && $queued->afterCommit === true;
    });

    $restored = unserialize(serialize($job));
    app()->setLocale('en');
    $restored->handle(app(Factory::class));

    expect($transport->messages())->toHaveCount(1)
        ->and($transport->messages()->sole()->getOriginalMessage()->getSubject())->toBe($subject)
        ->and(app()->getLocale())->toBe('en');
})->with([
    ['invitation', 'Définissez votre mot de passe du portail Academy'],
    ['reset', 'Réinitialisez votre mot de passe du portail Academy'],
    ['ready', 'L’espace Academy est prêt'],
    ['verification', 'Votre code de vérification Ekol'],
]);

test('queued mail waits for its transaction to commit', function () {
    config(['queue.default' => 'database', 'mail.default' => 'array']);

    DB::transaction(function () {
        Mail::to('ada@example.com')->send(new VerificationCodeMail('123456', 10));

        expect(DB::table('jobs')->count())->toBe(0);
    });

    expect(DB::table('jobs')->count())->toBe(1);
});

test('rolling back a transaction discards its queued mail', function () {
    config(['queue.default' => 'database', 'mail.default' => 'array']);

    expect(fn () => DB::transaction(function () {
        Mail::to('ada@example.com')->send(new VerificationCodeMail('123456', 10));

        throw new RuntimeException('Cancel registration');
    }))->toThrow(RuntimeException::class, 'Cancel registration');

    expect(DB::table('jobs')->count())->toBe(0);
});
