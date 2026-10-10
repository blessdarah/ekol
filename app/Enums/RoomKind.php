<?php

namespace App\Enums;

enum RoomKind: string
{
    case Classroom = 'classroom';
    case Laboratory = 'laboratory';
    case Library = 'library';
    case Hall = 'hall';
    case Office = 'office';
}
