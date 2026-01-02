import { Printer, Globe, HelpCircle } from "lucide-react";
import { motion } from "framer-motion";

export function Header() {
    return (
        <motion.header
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="h-16 bg-white/80 backdrop-blur-md border-b border-white/50 z-20 px-6 flex items-center justify-between shrink-0 shadow-sm"
        >
            <div className="flex items-center gap-3">
                <div className="bg-indigo-600 text-white p-2 rounded-lg shadow-lg shadow-indigo-500/30">
                    <Printer className="w-5 h-5" />
                </div>
                <div>
                    <h1 className="font-bold text-lg bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-blue-500">
                        Label Printer
                    </h1>
                    <p className="text-[10px] text-slate-500 font-medium tracking-wide uppercase">Based on PyQt6</p>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <button className="text-slate-500 hover:text-indigo-600 transition-colors p-2 rounded-full hover:bg-slate-100/50">
                    <Globe className="w-5 h-5" />
                </button>
                <button className="text-slate-500 hover:text-indigo-600 transition-colors p-2 rounded-full hover:bg-slate-100/50">
                    <HelpCircle className="w-5 h-5" />
                </button>
            </div>
        </motion.header>
    );
}
