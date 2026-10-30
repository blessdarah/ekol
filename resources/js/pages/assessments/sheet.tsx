import { Head } from '@inertiajs/react';
import { MarkTable } from '../../components/assessments/sheet/mark-table';
import {
    type SheetProps,
    useMarkSheet,
} from '../../components/assessments/sheet/model';
import { NextBar } from '../../components/assessments/sheet/next-bar';
import { SheetFooter } from '../../components/assessments/sheet/sheet-footer';
import { SheetHeader } from '../../components/assessments/sheet/sheet-header';
import { SheetStats } from '../../components/assessments/sheet/sheet-stats';
import { withAppShell } from '../../layouts/app-layout';

function Sheet(props: SheetProps) {
    const model = useMarkSheet(props);
    const { sheet, plan, next, dirty, backHref, sheetHref } = model;

    return (
        <div className="flex flex-col gap-5">
            <Head title={`${sheet.subject} · ${sheet.class}`} />
            <SheetHeader model={model} />
            <SheetStats model={model} />
            <MarkTable model={model} />
            {sheet.submitted_on && !dirty && (
                <NextBar
                    next={next}
                    subject={sheet.subject}
                    className_={sheet.class}
                    plan={plan.name}
                    backHref={backHref}
                    sheetHref={sheetHref}
                />
            )}
            <SheetFooter model={model} />
        </div>
    );
}

export default withAppShell(Sheet);
