import { router, usePage } from '@inertiajs/react';
import { useContext, useState } from 'react';
import { updateProfile } from '@/actions/App/Http/Controllers/SetupController';
import LogoCropper, { LOGO_MIN_SIDE, loadImage } from './logo-cropper';
import { t } from '../../lib/i18n';
import {
    type SchoolProp,
    SaveContext,
    useAutosave,
    Zone,
    ZoneError,
} from './shared';

export function ProfileZone({ school }: { school: SchoolProp }) {
    const report = useContext(SaveContext);
    const { data, save, error } = useAutosave(
        updateProfile.url(),
        { name: school.name, motto: school.motto ?? '' },
        (props) => ({
            name: props.school.name,
            motto: props.school.motto ?? '',
        }),
    );
    const [preview, setPreview] = useState<string | null>(null);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [cropping, setCropping] = useState<HTMLImageElement | null>(null);
    const logo = preview ?? school.logo_url;
    const locales = (usePage().props.locales ?? {}) as Record<string, string>;

    /**
     * SVGs and already-square images upload as they are; any other
     * image that is large enough goes through the cropper first.
     */
    async function chooseLogo(file: File) {
        setUploadError(null);

        if (file.name.toLowerCase().endsWith('.svg')) {
            uploadLogo(file);

            return;
        }

        try {
            const image = await loadImage(file);
            const shortest = Math.min(image.naturalWidth, image.naturalHeight);

            if (shortest < LOGO_MIN_SIDE) {
                setUploadError(
                    t(
                        'Logo must be at least :logo_min_sidepx on its shortest side.',
                        { logo_min_side: LOGO_MIN_SIDE },
                    ),
                );
            } else if (image.naturalWidth === image.naturalHeight) {
                uploadLogo(file);
            } else {
                setCropping(image);
            }
        } catch {
            setUploadError(t('That file could not be read. Use a PNG or SVG.'));
        }
    }

    function uploadLogo(file: File) {
        if (file.size > 2 * 1024 * 1024) {
            setUploadError(t('Logo must be smaller than 2 MB.'));

            return;
        }

        setPreview(URL.createObjectURL(file));
        setUploadError(null);
        setUploading(true);
        report('saving');

        // Multipart bodies only parse on POST, so the PATCH is spoofed.
        router.post(
            updateProfile.url(),
            { _method: 'patch', logo: file },
            {
                async: true,
                preserveState: true,
                preserveScroll: true,
                onSuccess: () => report('saved'),
                onError: (failed) => {
                    setUploadError(
                        failed.logo ??
                            t('Upload failed. Use a square PNG or SVG.'),
                    );
                    setPreview(null);
                    report('error');
                },
                onFinish: () => setUploading(false),
            },
        );
    }

    return (
        <Zone
            title={t('School profile')}
            desc={t('Shown on report cards, receipts and the login page.')}
        >
            <div className="flex items-center gap-5">
                <span className="flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary font-display text-[24px] leading-[30px] font-extrabold tracking-[-0.02em] text-white">
                    {logo ? (
                        <img
                            src={logo}
                            alt=""
                            className="h-full w-full bg-white object-cover"
                        />
                    ) : (
                        school.code.slice(0, 2).toUpperCase()
                    )}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <input
                        type="text"
                        aria-label={t('School name')}
                        value={data.name}
                        onChange={(e) =>
                            save({ ...data, name: e.target.value })
                        }
                        className="w-full border-b border-solid border-transparent bg-transparent text-[16px] leading-5 font-semibold text-text outline-none hover:border-border focus:border-primary"
                    />
                    <input
                        type="text"
                        aria-label={t('School motto')}
                        placeholder={t('School motto, printed under the name')}
                        maxLength={120}
                        value={data.motto}
                        onChange={(e) =>
                            save({ ...data, motto: e.target.value })
                        }
                        className="w-full border-b border-solid border-transparent bg-transparent text-[13px] leading-4 text-text italic outline-none placeholder:text-text-muted placeholder:not-italic hover:border-border focus:border-primary"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                        <label
                            className={`inline-flex h-8 items-center rounded-md border border-solid border-border px-3 text-[13px] leading-4 font-medium text-text hover:bg-surface ${uploading ? 'cursor-wait opacity-50' : 'cursor-pointer'}`}
                        >
                            {uploading ? t('Uploading…') : t('Upload logo')}
                            <input
                                type="file"
                                accept=".png,.svg"
                                className="hidden"
                                disabled={uploading}
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        void chooseLogo(file);
                                    }
                                    e.target.value = '';
                                }}
                            />
                        </label>
                        <span className="text-[12px] leading-4 text-text-muted">
                            {t('PNG or SVG, square, at least 256px')}
                        </span>
                    </div>
                    <ZoneError message={uploadError ?? error} />
                </div>
            </div>
            <label className="flex flex-wrap items-center gap-3 border-t border-solid border-border pt-4 text-[13px] leading-4 font-medium text-text">
                {t('School language')}
                <select
                    value={school.locale}
                    onChange={(e) =>
                        router.patch(
                            updateProfile.url(),
                            { locale: e.target.value },
                            { preserveScroll: true, preserveState: true },
                        )
                    }
                    className="h-9 rounded-md border border-solid border-border bg-white px-2 text-[13px] leading-4 font-normal text-text outline-none focus:border-primary"
                >
                    {Object.entries(locales).map(([code, name]) => (
                        <option key={code} value={code}>
                            {name}
                        </option>
                    ))}
                </select>
                <span className="font-normal text-text-muted">
                    {t(
                        'What people see until they choose their own language, and the language of sign-in for your school.',
                    )}
                </span>
            </label>
            {cropping && (
                <LogoCropper
                    image={cropping}
                    onCancel={() => setCropping(null)}
                    onCrop={(file) => {
                        setCropping(null);
                        uploadLogo(file);
                    }}
                />
            )}
        </Zone>
    );
}
