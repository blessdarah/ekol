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
            self::Classroom => __('Classroom'),
            self::Laboratory => __('Laboratory'),
            self::Computer => __('Computer room'),
            self::Library => __('Library'),
            self::Hall => __('Hall'),
            self::Office => __('Office'),
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
