<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * A school asking, from the landing page, to be called for a demo.
 * It belongs to no school yet: the school signs up after the call.
 *
 * @property string $id
 * @property string $school_name
 * @property string $role
 * @property string $students
 * @property string $whatsapp
 * @property string $locale
 * @property Carbon|null $handled_at
 */
class DemoRequest extends Model
{
    use HasUuids;

    /**
     * Who is asking, as offered on the form.
     */
    public const array ROLES = ['Principal', 'Proprietor', 'Vice principal', 'Bursar', 'Teacher', 'Other'];

    /**
     * How big the school is, as offered on the form.
     */
    public const array SIZES = ['Under 300', '300–800', '800–1,500', 'Over 1,500'];

    /**
     * The country code the form assumes.
     */
    public const string DIAL_CODE = '+237';

    protected $fillable = [
        'school_name',
        'role',
        'students',
        'whatsapp',
        'locale',
        'handled_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'handled_at' => 'datetime',
        ];
    }
}
