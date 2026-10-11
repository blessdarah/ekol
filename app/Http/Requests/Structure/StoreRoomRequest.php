<?php

namespace App\Http\Requests\Structure;

use App\Http\Requests\SchoolRequest;
use Illuminate\Validation\Rule;

class StoreRoomRequest extends SchoolRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->role->managesStructure();
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'code' => [
                'required', 'string', 'max:20',
                Rule::unique('rooms')->where('school_id', $this->school()->id),
            ],
            'capacity' => ['required', 'integer', 'min:1', 'max:1000'],
        ];
    }
}
