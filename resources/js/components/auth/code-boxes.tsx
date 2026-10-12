import { useT } from '../../lib/i18n';
import { useEffect, useRef, useState } from 'react';

export function useCountdown(expiresAt: string) {
    const calc = () =>
        Math.max(
            0,
            Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000),
        );
    const [left, setLeft] = useState(calc);

    useEffect(() => {
        if (left <= 0) {
            return;
        }
        const timer = setInterval(() => setLeft(calc()), 1000);

        return () => clearInterval(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [expiresAt, left <= 0]);

    const label = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;

    return { left, expired: left <= 0, label };
}

export default function CodeBoxes({
    name = 'code',
    length = 6,
}: {
    name?: string;
    length?: number;
}) {
    const t = useT();
    const [digits, setDigits] = useState<string[]>(Array(length).fill(''));
    const [focused, setFocused] = useState(0);
    const refs = useRef<(HTMLInputElement | null)[]>([]);

    function focus(index: number) {
        const clamped = Math.max(0, Math.min(length - 1, index));
        refs.current[clamped]?.focus();
        setFocused(clamped);
    }

    function setDigit(index: number, char: string) {
        const next = [...digits];
        next[index] = char.replace(/\D/g, '').slice(-1);
        setDigits(next);

        if (next[index] !== '' && index < length - 1) {
            focus(index + 1);
        }
    }

    function onKeyDown(index: number, key: string) {
        if (key === 'Backspace' && digits[index] === '' && index > 0) {
            focus(index - 1);
        }
    }

    function onPaste(index: number, text: string) {
        const chars = text.replace(/\D/g, '').slice(0, length - index).split('');

        if (chars.length === 0) {
            return;
        }

        const next = [...digits];
        chars.forEach((char, offset) => {
            next[index + offset] = char;
        });
        setDigits(next);
        focus(index + chars.length);
    }

    const groups =
        length === 6
            ? [
                  [0, 1, 2],
                  [3, 4, 5],
              ]
            : [Array.from({ length }, (_, i) => i)];

    return (
        <div className="flex items-center gap-5">
            <input type="hidden" name={name} value={digits.join('')} />
            {groups.map((group, gi) => (
                <div key={gi} className="flex gap-2">
                    {group.map((index) => (
                        <input
                            key={index}
                            ref={(el) => {
                                refs.current[index] = el;
                            }}
                            type="text"
                            inputMode="numeric"
                            maxLength={1}
                            autoComplete="one-time-code"
                            value={digits[index]}
                            onChange={(e) => setDigit(index, e.target.value)}
                            onKeyDown={(e) => onKeyDown(index, e.key)}
                            onPaste={(e) => {
                                e.preventDefault();
                                onPaste(
                                    index,
                                    e.clipboardData.getData('text'),
                                );
                            }}
                            onFocus={() => setFocused(index)}
                            aria-label={t('Digit :n', { n: index + 1 })}
                            className={`h-16 w-14 rounded-lg border border-solid text-center font-mono text-xl text-text outline-none ${
                                focused === index
                                    ? 'border-2 border-primary'
                                    : 'border-border'
                            }`}
                        />
                    ))}
                </div>
            ))}
        </div>
    );
}
