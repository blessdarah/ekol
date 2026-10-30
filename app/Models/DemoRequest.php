<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\URL;

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
 * @property string|null $contact_name
 * @property string|null $email
 * @property string $status
 * @property string|null $demo_school_id
 * @property string|null $demo_user_id
 * @property string|null $converted_school_id
 * @property Carbon|null $extended_at
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
        'contact_name',
        'email',
        'status',
        'demo_school_id',
        'demo_user_id',
        'extended_at',
        'converted_school_id',
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
            'extended_at' => 'datetime',
            'handled_at' => 'datetime',
        ];
    }

    public function accessLink(School $school): string
    {
        abort_unless($school->is_demo && $school->demo_expires_at !== null, 404);
        $path = URL::temporarySignedRoute('demo-school.show', $school->demo_expires_at, ['demo' => $this->id], absolute: false);
        $parent = parse_url((string) config('app.url'));
        abort_unless(is_array($parent) && isset($parent['host']), 500);

        return ($parent['scheme'] ?? 'https').'://'.$school->slug.'.'.$parent['host'].(isset($parent['port']) ? ':'.$parent['port'] : '').$path;
    }
}
