<?php

namespace App\Http\Requests\Auth;

use App\Models\School;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreSchoolStepRequest extends FormRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255', 'unique:schools,name'],
            'code' => ['required', 'string', 'max:255'],
            'slug' => [
                'required', 'string', 'max:255', 'lowercase', 'alpha_dash',
                Rule::notIn(School::RESERVED_SLUGS),
                'unique:schools,slug',
            ],
            'ownership' => ['required', Rule::in(School::OWNERSHIP_OPTIONS)],
            'region' => ['nullable', Rule::in(School::REGIONS)],
            'town' => ['nullable', 'string', 'max:255'],
            'subsystem' => ['nullable', Rule::in(School::SUBSYSTEM_OPTIONS)],
            'locale' => ['sometimes', Rule::in(array_keys(School::LOCALES))],
        ];
    }
}
