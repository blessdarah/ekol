<?php

namespace App\Mail;

use App\Models\School;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * The link to choose a new password for one school's portal.
 */
class PasswordResetMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public School $school,
        public string $salutation,
        public string $url,
        public int $minutes,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: __('Reset your :school portal password', ['school' => $this->school->name]));
    }

    public function content(): Content
    {
        return new Content(text: 'mail.password-reset');
    }
}
