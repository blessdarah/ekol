import { usePage } from '@inertiajs/react';
import type { ComponentType, ReactNode } from 'react';
import Sidebar, {
    type ShellSchool,
    type ShellTerm,
    type ShellUser,
} from '../components/shell/sidebar';
import Toasts from '../components/shell/toasts';

export interface ShellSharedProps {
    school: ShellSchool | null;
    term: ShellTerm | null;
    shellUser: ShellUser | null;
    feeBadge: number | null;
    [key: string]: unknown;
}

export function withAppShell<P extends object>(
    Component: ComponentType<P>,
): ComponentType<P> & { layout: (page: ReactNode) => ReactNode } {
    const Wrapped = Component as ComponentType<P> & {
        layout?: (page: ReactNode) => ReactNode;
    };
    Wrapped.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;

    return Wrapped as ComponentType<P> & {
        layout: (page: ReactNode) => ReactNode;
    };
}

export default function AppLayout({ children }: { children: ReactNode }) {
    const { props } = usePage<ShellSharedProps>();

    return (
        <div className="flex min-h-screen bg-white text-text antialiased">
            <Sidebar
                school={props.school ?? null}
                term={props.term ?? null}
                user={props.shellUser ?? null}
                feeBadge={props.feeBadge ?? null}
            />
            <main className="font-auth flex flex-1 justify-center px-10 py-7">
                <div className="w-full max-w-[1112px]">{children}</div>
            </main>
            <Toasts />
        </div>
    );
}
