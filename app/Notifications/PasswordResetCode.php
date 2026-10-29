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
 * The code a staff member types to reset their password when they asked
 * by phone. Queued, so the page never waits on the SMS gateway.
 */
class PasswordResetCode extends Notification implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    /**
     * @var array<int, int>
     */
    public array $backoff = [10, 30];

    public function __construct(public string $code, public string $schoolName, public string $userId) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return [CamooChannel::class];
    }

    public function toCamoo(object $notifiable): CamooMessage
    {
        return CamooMessage::create(__(':code is your code to reset your :school password on Campus. It expires in 15 minutes. Never share it.', [
            'code' => $this->code,
            'school' => $this->schoolName,
        ]))->sender((string) config('services.camoo.sender'));
    }

    public function failed(Throwable $exception): void
    {
        Log::warning('Password reset SMS failed.', ['user' => $this->userId, 'error' => $exception->getMessage()]);
    }
}
