<?php

namespace App\Enums;

enum RoomKind: string
{
    case Classroom = 'classroom';
    case Laboratory = 'laboratory';
    case Computer = 'computer';
    case Library = 'library';
    case Hall = 'hall';
    case Office = 'office';

    public function label(): string
    {
        return match ($this) {
            self::Classroom => 'Classroom',
            self::Laboratory => 'Laboratory',
            self::Computer => 'Computer room',
            self::Library => 'Library',
            self::Hall => 'Hall',
            self::Office => 'Office',
        };
    }

    /**
     * Kinds a subject can require; other lessons use the home room.
     *
     * @return list<self>
     */
    public static function special(): array
    {
        return [self::Laboratory, self::Computer];
    }
}
