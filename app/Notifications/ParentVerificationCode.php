<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\Log;
use Throwable;
use Undjike\CamooNotificationChannel\CamooChannel;
use Undjike\CamooNotificationChannel\CamooMessage;

/**
 * The one-time code a parent types to open parent services, sent by
 * SMS to the guardian phone the school has. It goes through the queue
 * so the parent's page never waits on the SMS gateway.
 */
class ParentVerificationCode extends Notification implements ShouldQueue
{
    use Queueable;

    /**
     * Tries before giving up; the code expires after 10 minutes anyway.
     */
    public int $tries = 3;

    /**
     * Seconds to wait before each retry.
     *
     * @var array<int, int>
     */
    public array $backoff = [10, 30];

    public function __construct(public string $code, public string $schoolName, public string $schoolId) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return [CamooChannel::class];
    }

    public function toCamoo(object $notifiable): CamooMessage
    {
        return CamooMessage::create(__(':code is your Campus code for :school parent services. It expires in 10 minutes. Never share it.', [
            'code' => $this->code,
            'school' => $this->schoolName,
        ]))->sender((string) config('services.camoo.sender'));
    }

    /**
     * Leave a trace when every try failed. The parent can ask for a new
     * code from the page after a minute.
     */
    public function failed(Throwable $exception): void
    {
        Log::warning('Parent verification SMS failed.', ['school' => $this->schoolId, 'error' => $exception->getMessage()]);
    }
}
