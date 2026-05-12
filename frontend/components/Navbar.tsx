'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { ThemeToggle } from './ThemeToggle';

export default function Navbar() {
    const pathname = usePathname();

    const links = [
        { name: 'Catalog', href: '/courses' },
        { name: 'Degree Audit', href: '/audit' },
        { name: 'Schedule Builder', href: '/schedule' },
    ];

    return (
        <nav className="fixed top-0 left-0 right-0 z-[100] px-6 md:px-10 py-5 bg-white/80 dark:bg-black/60 backdrop-blur-xl border-b border-black/5 dark:border-white/[0.04] transition-colors duration-300">
            <div className="max-w-7xl mx-auto flex justify-between items-center">
                <div className="flex items-center gap-8">
                    <Link href="/" className="text-black dark:text-white text-base font-semibold tracking-tight transition-colors">
                        Schedula
                    </Link>
                    <div className="hidden md:flex items-center gap-6 text-[10px] uppercase tracking-[0.18em] font-medium">
                        {links.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                className={`${pathname === link.href ? 'text-black dark:text-white' : 'text-neutral-500 hover:text-black dark:text-white/60 dark:hover:text-white'
                                    } transition-colors`}
                            >
                                {link.name}
                            </Link>
                        ))}
                    </div>
                </div>
                <div className="flex items-center gap-6">
                    <div className="hidden md:block text-[10px] uppercase tracking-widest text-neutral-400 dark:text-white/40 font-medium">
                        University Park
                    </div>
                    <ThemeToggle />
                </div>
            </div>
        </nav>
    );
}