{{--
    Laid out for incidents: is a server struggling, what is failing and
    where, which schools are affected, then what is slow.
--}}
<x-pulse>
    <livewire:pulse.servers cols="full" />

    <livewire:pulse.exceptions cols="8" />

    <livewire:pulse.school-exceptions cols="4" />

    <livewire:pulse.slow-requests cols="6" />

    <livewire:pulse.queues cols="6" />

    <livewire:pulse.slow-jobs cols="6" />

    <livewire:pulse.slow-outgoing-requests cols="6" />

    <livewire:pulse.slow-queries cols="8" />

    <livewire:pulse.cache cols="4" />

    <livewire:pulse.usage cols="full" />
</x-pulse>
