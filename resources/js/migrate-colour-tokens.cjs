const fs = require('node:fs');
const path = require('node:path');
process.chdir(path.resolve(__dirname, '../..'));
const check = process.argv.includes('--check');
const changed = [];
const read = (file) => fs.readFileSync(file, 'utf8');
const write = (file, text) => {
    if (read(file) === text) return;
    changed.push(file);
    if (!check) fs.writeFileSync(file, text);
};
const palette = {
    '#8A5A12': 'warning-text',
    '#56625C': 'text-muted',
    '#0E4D3A': 'primary',
    '#101915': 'text',
    '#FFFFFF': 'bg',
    '#FFF': 'bg',
    '#F4F7F5': 'surface',
    '#DDE3E0': 'border',
    '#0A3A2C': 'primary-hover',
    '#1E7F4F': 'success',
    '#B42318': 'danger',
    '#B7791F': 'warning',
    '#FBF1DF': 'warning-tint',
    '#8A3B6B': 'arts',
    '#2A5DA8': 'science',
    '#EAF2EC': 'primary-soft',
    '#8FA89A': 'primary-muted',
    '#7BD8A6': 'brand-accent',
    '#22382E': 'brand-border',
    '#1E3329': 'brand-surface',
    '#0B1712': 'brand-bg',
    '#5F7A6C': 'brand-muted',
    '#12221B': 'brand-raised',
    '#F2A99F': 'danger-on-dark',
    '#8FE3B5': 'success-on-dark',
    '#163A2C': 'brand-highlight',
    '#C9D9CF': 'brand-text',
    '#2E5E49': 'brand-active',
    '#B9D8C9': 'brand-detail',
    '#E8B35A': 'warning-on-dark',
    '#B8C2BD': 'text-disabled',
    '#BFD8CC': 'primary-border',
    '#8FB79B': 'grading-pass',
    '#D2B55B': 'grading-borderline',
    '#D9B979': 'warning-line',
    '#E9C98F': 'warning-border',
    '#CFE3D8': 'primary-outline',
    '#EDF4F0': 'primary-faint',
    '#F1D5D1': 'danger-border',
    '#FDF6F5': 'danger-faint',
    '#EFDDBB': 'warning-outline',
    '#FDFAF3': 'warning-faint',
    '#F3F7F5': 'surface-raised',
    '#C9DED4': 'primary-divider',
    '#C3CCC8': 'neutral-outline',
    '#EDF1EF': 'chart-track',
    '#C9D1CD': 'chart-muted',
    '#0E2E24': 'print-ink',
    '#B08D3C': 'print-gold',
    '#FCFBF6': 'print-paper',
    '#F3E7C4': 'print-cream',
    '#E6DFC9': 'print-divider',
    '#D8CFB4': 'print-border',
    '#9A6516': 'print-amber',
    '#6B5A2E': 'print-heading',
    '#C9A54E': 'print-accent',
    '#8A7A4E': 'print-muted',
    '#6E470D': 'print-amber-deep',
    '#E2C07A': 'print-amber-gold',
    '#FFF4DC': 'print-amber-light',
    '#F0D28E': 'print-amber-accent',
    '#4A5550': 'print-neutral',
    '#333C38': 'print-neutral-deep',
    '#B9C2BD': 'print-neutral-gold',
    '#F1F4F2': 'print-neutral-light',
    '#D3DAD6': 'print-neutral-accent',
    '#1F3B6B': 'print-blue',
    '#152A4E': 'print-blue-deep',
    '#E0C27A': 'print-blue-gold',
    '#C9A15A': 'print-blue-accent',
    '#5D8C7A': 'print-line',
    '#8A8F86': 'print-subtle',
    '#ECE6D3': 'print-rule',
    '#222222': 'document-text',
    '#333333': 'document-border',
    '#555555': 'document-muted',
    '#EEF1EF': 'document-canvas',
    '#FFCC00': 'mtn',
    '#1A1A1A': 'mtn-ink',
    '#FF7900': 'orange-money',
    '#4B5563': 'progress-indicator',
};
function filesIn(dir) {
    return fs
        .readdirSync(dir, { withFileTypes: true })
        .flatMap((e) =>
            e.isDirectory()
                ? filesIn(path.join(dir, e.name))
                : [path.join(dir, e.name)],
        );
}
function colours() {
    const cssFile = 'resources/css/app.css';
    let css = read(cssFile),
        add = [];
    const unique = new Map();
    for (const [hex, name] of Object.entries(palette))
        if (!unique.has(name))
            unique.set(
                name,
                hex.length === 4
                    ? '#' +
                          hex
                              .slice(1)
                              .split('')
                              .map((c) => c + c)
                              .join('')
                    : hex,
            );
    for (const [name, hex] of unique)
        if (!css.includes(`--color-${name}:`))
            add.push(`    --color-${name}: ${hex.toLowerCase()};`);
    if (add.length)
        write(
            cssFile,
            css.replace(
                '    --radius-sm:',
                add.join('\n') + '\n\n    --radius-sm:',
            ),
        );
    const colourValue = (hex) => {
        const full = hex.toUpperCase(),
            base = full.slice(0, 7),
            name = palette[full] ?? palette[base];
        if (!name) return hex;
        if (full.length === 9) {
            const opacity =
                Math.round((parseInt(full.slice(7), 16) / 255) * 10000) / 100;
            return `color-mix(in_srgb,var(--color-${name})_${opacity}%,transparent)`;
        }
        return `var(--color-${name})`;
    };
    for (const f of filesIn('resources/js').filter(
        (f) =>
            /\.tsx?$/.test(f) &&
            !f.includes('/actions/') &&
            !f.includes('/routes/') &&
            !f.includes('/wayfinder/'),
    )) {
        let s = read(f);
        s = s.replace(
            /(text|bg|border|stroke|fill|outline|ring|accent|decoration)-\[(#[a-fA-F\d]{3,8})\]/g,
            (match, prefix, hex) => {
                const full = hex.toUpperCase(),
                    name = palette[full] ?? palette[full.slice(0, 7)];
                if (!name) return match;
                if (full.length === 9) return `${prefix}-[${colourValue(hex)}]`;
                return `${prefix}-${name}`;
            },
        );
        s = s.replace(/#[a-fA-F\d]{3,8}\b/g, (hex) => colourValue(hex));
        if (s !== read(f)) write(f, s);
    }
}
colours();
if (changed.length) {
    console.log(
        (check ? 'Would update ' : 'Updated ') + changed.length + ' files.',
    );
    if (check) process.exitCode = 1;
} else {
    console.log('Palette token migration is up to date.');
}
