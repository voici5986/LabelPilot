import { ReactNode } from "react";

export function Layout({ children }: { children: ReactNode }) {
    return (
        <div className="h-screen w-screen flex flex-col overflow-hidden bg-gradient-to-br from-slate-50 to-blue-50/50 font-sans text-slate-800">
            {children}
        </div>
    );
}
