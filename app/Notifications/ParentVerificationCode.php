<?php

namespace App\Notifications;

use Illuminate\Notifications\Notification;
use Undjike\CamooNotificationChannel\CamooChannel;
use Undjike\CamooNotificationChannel\CamooMessage;

/**
 * The one-time code a parent types to open parent services, sent by
 * SMS to the guardian phone the school has.
 */
class ParentVerificationCode extends Notification
{
    public function __construct(public string $code, public string $schoolName) {}

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
}
