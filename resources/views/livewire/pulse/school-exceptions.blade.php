<x-pulse::card :cols="$cols" :rows="$rows" :class="$class">
    <x-pulse::card-header
        name="Schools with errors"
        x-bind:title="`Time: {{ number_format($time) }}ms; Run at: ${formatDate('{{ $runAt }}')};`"
        details="past {{ $this->periodForHumans() }}"
    >
        <x-slot:icon>
            <x-pulse::icons.bug-ant />
        </x-slot:icon>
    </x-pulse::card-header>

    <x-pulse::scroll :expand="$expand" wire:poll.5s="">
        @if ($schools->isEmpty())
            <x-pulse::no-results />
        @else
            <x-pulse::table>
                <colgroup>
                    <col width="100%" />
                    <col width="0%" />
                    <col width="0%" />
                </colgroup>
                <x-pulse::thead>
                    <tr>
                        <x-pulse::th>School</x-pulse::th>
                        <x-pulse::th class="text-right">Latest</x-pulse::th>
                        <x-pulse::th class="text-right">Errors</x-pulse::th>
                    </tr>
                </x-pulse::thead>
                <tbody>
                    @foreach ($schools->take(100) as $school)
                        <tr wire:key="{{ $school->slug ?? $loop->index }}-spacer" class="h-2 first:h-0"></tr>
                        <tr wire:key="{{ $school->slug ?? $loop->index }}-row">
                            <x-pulse::td class="max-w-[1px]">
                                <span class="block text-sm text-gray-900 dark:text-gray-100 truncate" title="{{ $school->name }}">
                                    {{ $school->name }}
                                </span>
                                @if ($school->slug)
                                    <p class="mt-1 text-xs text-gray-500 dark:text-gray-400 truncate">{{ $school->slug }}</p>
                                @endif
                            </x-pulse::td>
                            <x-pulse::td numeric class="text-gray-700 dark:text-gray-300 font-bold">
                                {{ $school->latest->ago(syntax: Carbon\CarbonInterface::DIFF_ABSOLUTE, short: true) }}
                            </x-pulse::td>
                            <x-pulse::td numeric class="text-gray-700 dark:text-gray-300 font-bold">
                                {{ number_format($school->count) }}
                            </x-pulse::td>
                        </tr>
                    @endforeach
                </tbody>
            </x-pulse::table>
        @endif
    </x-pulse::scroll>
</x-pulse::card>
