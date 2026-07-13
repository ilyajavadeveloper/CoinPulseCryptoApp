'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import SearchModal from '@/components/SearchModal';
import { cn } from '@/lib/utils';

const Header = () => {
    const pathname = usePathname();

    const [isSearchOpen, setIsSearchOpen] =
        useState(false);

    const openSearchModal = () => {
        setIsSearchOpen(true);
    };

    const closeSearchModal = () => {
        setIsSearchOpen(false);
    };

    return (
        <>
            <header>
                <div className="main-container inner">
                    <Link
                        href="/"
                        aria-label="CoinPulse home"
                    >
                        <Image
                            src="/logo.svg"
                            alt="CoinPulse logo"
                            width={132}
                            height={40}
                            priority
                        />
                    </Link>

                    <nav>
                        <Link
                            href="/"
                            className={cn('nav-link', {
                                'is-active':
                                    pathname === '/',
                                'is-home': true,
                            })}
                        >
                            Home
                        </Link>

                        <button
                            type="button"
                            className="nav-link search-trigger"
                            onClick={openSearchModal}
                            aria-label="Open coin search"
                            aria-haspopup="dialog"
                            aria-expanded={isSearchOpen}
                        >
                            <Search size={17} />
                            <span>Search</span>
                        </button>

                        <Link
                            href="/coins"
                            className={cn('nav-link', {
                                'is-active':
                                    pathname === '/coins' ||
                                    pathname.startsWith(
                                        '/coins/',
                                    ),
                            })}
                        >
                            All Coins
                        </Link>
                    </nav>
                </div>
            </header>

            <SearchModal
                isOpen={isSearchOpen}
                onClose={closeSearchModal}
            />
        </>
    );
};

export default Header;