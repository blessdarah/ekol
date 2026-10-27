<?php

namespace App\Http\Requests\Schemes;

use App\Http\Requests\SchoolRequest;

/**
 * A teacher moving a sub-topic to a week, or back to the unplaced list.
 */
class PlaceSchemeItemRequest extends SchoolRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'week' => ['nullable', 'integer', 'min:1', 'max:20'],
        ];
    }
}
