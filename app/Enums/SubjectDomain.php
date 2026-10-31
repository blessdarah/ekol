<?php

namespace App\Enums;

enum SubjectDomain: string
{
    case General = 'general';
    case Science = 'science';
    case Arts = 'arts';
    case Commercial = 'commercial';

    public function label(): string
    {
        return ucfirst($this->value);
    }
}
