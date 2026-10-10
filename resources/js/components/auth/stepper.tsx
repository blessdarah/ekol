export interface Step {
    title: string;
    sub: string;
}

export default function Stepper({
    steps,
    active,
}: {
    steps: Step[];
    active: number;
}) {
    return (
        <ol className="flex flex-col">
            {steps.map((step, index) => {
                const isActive = index === active;
                const isDone = index < active;
                const isLast = index === steps.length - 1;

                return (
                    <li key={step.title} className="flex gap-4">
                        <span className="flex w-7 shrink-0 flex-col items-center">
                            <span
                                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs leading-4 font-semibold ${
                                    isActive
                                        ? 'bg-primary text-white'
                                        : isDone
                                          ? 'bg-primary-tint text-primary'
                                          : 'border border-solid border-border bg-white text-text-muted'
                                }`}
                            >
                                {index + 1}
                            </span>
                            {!isLast && (
                                <span className="flex py-[6px]">
                                    <span className="h-[28px] w-px shrink-0 bg-border" />
                                </span>
                            )}
                        </span>
                        <span className="flex flex-col gap-[2px] pt-[5px]">
                            <span
                                className={`text-base leading-[18px] ${
                                    isActive
                                        ? 'font-semibold text-text'
                                        : 'font-medium text-text-muted'
                                }`}
                            >
                                {step.title}
                            </span>
                            <span className="text-sm leading-[18px] text-text-muted">
                                {step.sub}
                            </span>
                        </span>
                    </li>
                );
            })}
        </ol>
    );
}
