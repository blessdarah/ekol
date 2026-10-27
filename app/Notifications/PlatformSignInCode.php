<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class PlatformSignInCode extends Notification
{
    public function __construct(public string $code) {}

    /** @return list<string> */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)->subject('Campus platform sign-in code')
            ->line("Your sign-in code is {$this->code}.")
            ->line('It expires in 10 minutes. Never share this code.');
    }
}
