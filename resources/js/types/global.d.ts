import type { Auth } from '@/types/auth';

declare module 'react' {
    interface InputHTMLAttributes<T> {
        passwordrules?: string;
    }
}

declare module '@inertiajs/core' {
    export interface InertiaConfig {
        sharedPageProps: {
            name: string;
            auth: Auth;
            /** What the signed-in person may do, by ability. */
            can: Record<
                | 'manage-structure'
                | 'manage-students'
                | 'see-private-student-details'
                | 'manage-assessments'
                | 'manage-schemes'
                | 'follow-schemes'
                | 'manage-fees'
                | 'read-student-fees'
                | 'manage-staff',
                boolean
            >;
            sidebarOpen: boolean;
            [key: string]: unknown;
        };
        flashDataType: {
            toast?: { type: 'success' | 'error' | 'info'; message: string };
        };
    }
}
