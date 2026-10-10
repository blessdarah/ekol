<?php

namespace App\Mail;

use App\Models\School;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class StaffInvitationMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public School $school,
        public string $salutation,
        public string $sender,
        public string $url,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: "Set your {$this->school->name} portal password");
    }

    public function content(): Content
    {
        return new Content(text: 'mail.staff-invitation');
    }
}
