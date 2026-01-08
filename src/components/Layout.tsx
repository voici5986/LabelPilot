import type { ReactNode } from "react";

export function Layout({ children }: { children: ReactNode }) {
    return (
        <div className="h-screen w-screen flex flex-col overflow-hidden bg-surface transition-colors duration-300 font-sans text-text-main">
            {children}
        </div>
    );
}
