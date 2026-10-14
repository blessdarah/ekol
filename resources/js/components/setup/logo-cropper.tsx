import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { t } from '../../lib/i18n';

export const LOGO_MIN_SIDE = 256;

const VIEWPORT = 320;
const OUTPUT_MAX_SIDE = 512;

export function loadImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Unreadable image'));
        image.src = URL.createObjectURL(file);
    });
}

/**
 * Square crop for a logo that is not already square. The image always
 * covers the frame, and zoom stops where the cropped area would fall
 * below the minimum logo size.
 */
export default function LogoCropper({
    image,
    onCancel,
    onCrop,
}: {
    image: HTMLImageElement;
    onCancel: () => void;
    onCrop: (file: File) => void;
}) {
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    const baseScale = VIEWPORT / Math.min(width, height);
    const maxZoom = Math.max(1, Math.min(width, height) / LOGO_MIN_SIDE);

    const [zoom, setZoom] = useState(1);
    const [offset, setOffset] = useState({
        x: (VIEWPORT - width * baseScale) / 2,
        y: (VIEWPORT - height * baseScale) / 2,
    });
    const drag = useRef<{ x: number; y: number } | null>(null);
    const scale = baseScale * zoom;

    function clamp(next: { x: number; y: number }, atScale: number) {
        return {
            x: Math.min(0, Math.max(VIEWPORT - width * atScale, next.x)),
            y: Math.min(0, Math.max(VIEWPORT - height * atScale, next.y)),
        };
    }

    function changeZoom(nextZoom: number) {
        const nextScale = baseScale * nextZoom;
        const centre = VIEWPORT / 2;

        // Keep the point under the frame's centre fixed while zooming.
        setOffset(
            clamp(
                {
                    x: centre - ((centre - offset.x) / scale) * nextScale,
                    y: centre - ((centre - offset.y) / scale) * nextScale,
                },
                nextScale,
            ),
        );
        setZoom(nextZoom);
    }

    function onPointerDown(event: PointerEvent<HTMLDivElement>) {
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = {
            x: event.clientX - offset.x,
            y: event.clientY - offset.y,
        };
    }

    function onPointerMove(event: PointerEvent<HTMLDivElement>) {
        if (!drag.current) {
            return;
        }

        setOffset(
            clamp(
                {
                    x: event.clientX - drag.current.x,
                    y: event.clientY - drag.current.y,
                },
                scale,
            ),
        );
    }

    function nudge(dx: number, dy: number) {
        setOffset(clamp({ x: offset.x + dx, y: offset.y + dy }, scale));
    }

    function crop() {
        const sourceSide = VIEWPORT / scale;
        const side = Math.round(
            Math.max(LOGO_MIN_SIDE, Math.min(OUTPUT_MAX_SIDE, sourceSide)),
        );
        const canvas = document.createElement('canvas');
        canvas.width = side;
        canvas.height = side;
        canvas
            .getContext('2d')
            ?.drawImage(
                image,
                -offset.x / scale,
                -offset.y / scale,
                sourceSide,
                sourceSide,
                0,
                0,
                side,
                side,
            );
        canvas.toBlob((blob) => {
            if (blob) {
                onCrop(new File([blob], 'logo.png', { type: 'image/png' }));
            }
        }, 'image/png');
    }

    useEffect(() => {
        function onKeyDown(event: KeyboardEvent) {
            if (event.key === 'Escape') {
                onCancel();
            }
        }

        document.addEventListener('keydown', onKeyDown);

        return () => document.removeEventListener('keydown', onKeyDown);
    }, [onCancel]);

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label={t('Crop logo')}
            className="fixed inset-0 z-50 flex items-center justify-center bg-text/40 p-4"
        >
            <div className="flex w-full max-w-[368px] flex-col gap-4 rounded-lg bg-white p-6">
                <div className="flex flex-col gap-1">
                    <h2 className="text-[16px] leading-5 font-semibold text-text">
                        {t('Crop logo')}
                    </h2>
                    <p className="text-[13px] leading-[19px] text-text-muted">
                        {t(
                            'Logos must be square. Drag the image and zoom to choose the part to keep.',
                        )}
                    </p>
                </div>
                <div
                    tabIndex={0}
                    aria-label={t(
                        'Crop area. Drag or use the arrow keys to move the image.',
                    )}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={() => (drag.current = null)}
                    onPointerCancel={() => (drag.current = null)}
                    onKeyDown={(event) => {
                        const steps: Record<string, [number, number]> = {
                            ArrowLeft: [10, 0],
                            ArrowRight: [-10, 0],
                            ArrowUp: [0, 10],
                            ArrowDown: [0, -10],
                        };
                        const step = steps[event.key];

                        if (step) {
                            event.preventDefault();
                            nudge(...step);
                        }
                    }}
                    className="relative cursor-grab touch-none self-center overflow-hidden rounded-lg border border-solid border-border bg-surface outline-none select-none focus-visible:border-primary active:cursor-grabbing"
                    style={{
                        width: VIEWPORT,
                        height: VIEWPORT,
                        maxWidth: '100%',
                    }}
                >
                    <img
                        src={image.src}
                        alt=""
                        draggable={false}
                        className="pointer-events-none absolute top-0 left-0 max-w-none"
                        style={{
                            width: width * scale,
                            height: height * scale,
                            transform: `translate(${offset.x}px, ${offset.y}px)`,
                        }}
                    />
                </div>
                <label className="flex items-center gap-3 text-[13px] leading-4 font-medium text-text">
                    {t('Zoom')}
                    <input
                        type="range"
                        min={1}
                        max={maxZoom}
                        step={0.01}
                        value={zoom}
                        disabled={maxZoom <= 1}
                        onChange={(e) => changeZoom(Number(e.target.value))}
                        className="flex-1 accent-primary"
                    />
                </label>
                <div className="flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="h-9 rounded-md border border-solid border-border px-4 text-[14px] font-medium text-text hover:bg-surface"
                    >
                        {t('Cancel')}
                    </button>
                    <button
                        type="button"
                        onClick={crop}
                        className="h-9 rounded-md bg-primary px-4 text-[14px] font-medium text-white hover:bg-primary-hover"
                    >
                        {t('Use this crop')}
                    </button>
                </div>
            </div>
        </div>
    );
}
