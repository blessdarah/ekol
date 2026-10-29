<?php

namespace App\Http\Requests\Setup;

use App\Http\Requests\SchoolRequest;
use App\Models\School;
use Illuminate\Validation\Rule;

class UpdateProfileRequest extends SchoolRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        // SVGs carry no raster dimensions; the size rule applies to PNGs only.
        $logoRules = ['sometimes', 'file', 'mimes:png,svg', 'max:2048'];

        if ($this->hasFile('logo')
            && strtolower((string) $this->file('logo')->getClientOriginalExtension()) !== 'svg'
        ) {
            $logoRules[] = Rule::dimensions()->minWidth(256)->minHeight(256)->ratio(1);
        }

        return [
            'name' => ['sometimes', 'string', 'max:255'],
            'motto' => ['sometimes', 'nullable', 'string', 'max:120'],
            'code' => ['sometimes', 'string', 'max:255'],
            'ownership' => ['sometimes', Rule::in(School::OWNERSHIP_OPTIONS)],
            'region' => ['sometimes', 'nullable', Rule::in(School::REGIONS)],
            'town' => ['sometimes', 'nullable', 'string', 'max:255'],
            'subsystem' => ['sometimes', 'nullable', Rule::in(School::SUBSYSTEM_OPTIONS)],
            'currency' => ['sometimes', 'string', 'size:3'],
            'timezone' => ['sometimes', 'string', 'max:255'],
            'locale' => ['sometimes', Rule::in(array_keys(School::LOCALES))],
            'logo' => $logoRules,
        ];
    }
}
