<?php

namespace App\Mail;

use App\Models\School;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class WorkspaceReadyMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public School $school,
        public User $administrator,
        public string $address,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: "{$this->school->name} workspace is ready");
    }

    public function content(): Content
    {
        return new Content(text: 'mail.workspace-ready');
    }
}
