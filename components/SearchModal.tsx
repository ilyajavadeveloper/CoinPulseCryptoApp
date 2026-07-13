'use client';

import {
    LoaderCircle,
    Search,
    X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
    useEffect,
    useRef,
    useState,
} from 'react';
import { createPortal } from 'react-dom';

interface SearchModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface SearchCoin {
    id: string;
    name: string;
    symbol: string;
    market_cap_rank: number | null;
    thumb: string;
}

interface SearchResponse {
    coins: SearchCoin[];
}

const MIN_QUERY_LENGTH = 2;
const SEARCH_DELAY = 350;

const SearchModal = ({
                         isOpen,
                         onClose,
                     }: SearchModalProps) => {
    const router = useRouter();

    const inputRef =
        useRef<HTMLInputElement | null>(null);

    const [isMounted, setIsMounted] =
        useState(false);

    const [query, setQuery] = useState('');
    const [coins, setCoins] = useState<SearchCoin[]>(
        [],
    );

    const [isLoading, setIsLoading] =
        useState(false);

    const [error, setError] = useState<
        string | null
    >(null);

    const normalizedQuery = query.trim();

    const closeModal = () => {
        setQuery('');
        setCoins([]);
        setError(null);
        setIsLoading(false);

        onClose();
    };

    const handleCoinSelect = (coinId: string) => {
        closeModal();
        router.push(`/coins/${coinId}`);
    };

    useEffect(() => {
        setIsMounted(true);
    }, []);

    useEffect(() => {
        if (!isOpen) return;

        const previousOverflow =
            document.body.style.overflow;

        document.body.style.overflow = 'hidden';

        const handleKeyDown = (
            event: KeyboardEvent,
        ) => {
            if (event.key === 'Escape') {
                closeModal();
            }
        };

        window.addEventListener(
            'keydown',
            handleKeyDown,
        );

        const focusTimer = window.setTimeout(() => {
            inputRef.current?.focus();
        }, 50);

        return () => {
            document.body.style.overflow =
                previousOverflow;

            window.removeEventListener(
                'keydown',
                handleKeyDown,
            );

            window.clearTimeout(focusTimer);
        };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;

        if (
            normalizedQuery.length <
            MIN_QUERY_LENGTH
        ) {
            setCoins([]);
            setError(null);
            setIsLoading(false);

            return;
        }

        const controller = new AbortController();

        const searchTimer = window.setTimeout(
            async () => {
                setIsLoading(true);
                setError(null);

                try {
                    const response = await fetch(
                        `/api/search?q=${encodeURIComponent(
                            normalizedQuery,
                        )}`,
                        {
                            method: 'GET',
                            signal: controller.signal,
                        },
                    );

                    if (!response.ok) {
                        throw new Error(
                            'Search request failed',
                        );
                    }

                    const data =
                        (await response.json()) as SearchResponse;

                    setCoins(
                        Array.isArray(data.coins)
                            ? data.coins.slice(0, 10)
                            : [],
                    );
                } catch (requestError) {
                    if (
                        requestError instanceof
                        DOMException &&
                        requestError.name ===
                        'AbortError'
                    ) {
                        return;
                    }

                    setCoins([]);
                    setError(
                        'Could not search coins.',
                    );
                } finally {
                    if (!controller.signal.aborted) {
                        setIsLoading(false);
                    }
                }
            },
            SEARCH_DELAY,
        );

        return () => {
            window.clearTimeout(searchTimer);
            controller.abort();
        };
    }, [isOpen, normalizedQuery]);

    if (!isMounted || !isOpen) {
        return null;
    }

    return createPortal(
        <div
            role="presentation"
            onMouseDown={closeModal}
            className="
                fixed inset-0 z-[99999]
                flex items-start justify-center
                overflow-y-auto
                bg-black/80
                px-3 pb-5 pt-20
                backdrop-blur-xl
                sm:px-5 sm:pt-24
            "
        >
            <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="coin-search-title"
                onMouseDown={(event) =>
                    event.stopPropagation()
                }
                className="
                    relative
                    flex w-full max-w-[680px]
                    flex-col overflow-hidden
                    rounded-[22px]
                    border border-white/10
                    bg-[#0d0a18]
                    shadow-[0_35px_100px_rgba(0,0,0,0.75)]
                    max-h-[calc(100dvh-110px)]
                "
            >
                <div
                    className="
                        pointer-events-none
                        absolute right-[-100px] top-[-130px]
                        h-[320px] w-[320px]
                        rounded-full
                        bg-purple-600/20
                        blur-[100px]
                    "
                />

                <div
                    className="
                        pointer-events-none
                        absolute bottom-[-150px] left-[-100px]
                        h-[280px] w-[280px]
                        rounded-full
                        bg-violet-900/20
                        blur-[100px]
                    "
                />

                <div
                    className="
                        relative z-10
                        flex items-start justify-between
                        gap-5 px-5 pb-5 pt-6
                        sm:px-7 sm:pt-7
                    "
                >
                    <div>
                        <p
                            className="
                                m-0
                                text-[11px] font-bold
                                uppercase tracking-[0.18em]
                                text-purple-300/60
                            "
                        >
                            CoinPulse
                        </p>

                        <h2
                            id="coin-search-title"
                            className="
                                mt-1
                                text-2xl font-bold
                                tracking-[-0.03em]
                                text-white
                                sm:text-[32px]
                            "
                        >
                            Search coins
                        </h2>
                    </div>

                    <button
                        type="button"
                        onClick={closeModal}
                        aria-label="Close search modal"
                        className="
                            flex h-10 w-10
                            shrink-0 items-center justify-center
                            rounded-xl
                            border border-white/10
                            bg-white/[0.05]
                            text-white/60
                            transition
                            hover:rotate-3
                            hover:border-white/20
                            hover:bg-white/10
                            hover:text-white
                            focus:outline-none
                            focus:ring-2
                            focus:ring-purple-500/70
                        "
                    >
                        <X size={20} />
                    </button>
                </div>

                <div
                    className="
                        relative z-10
                        mx-5 mb-4
                        sm:mx-7 sm:mb-5
                    "
                >
                    <Search
                        size={20}
                        className="
                            pointer-events-none
                            absolute left-4 top-1/2
                            -translate-y-1/2
                            text-white/35
                        "
                    />

                    <input
                        ref={inputRef}
                        type="search"
                        value={query}
                        onChange={(event) =>
                            setQuery(
                                event.target.value,
                            )
                        }
                        placeholder="Bitcoin, Ethereum, Solana..."
                        autoComplete="off"
                        spellCheck={false}
                        className="
                            h-[58px] w-full
                            rounded-2xl
                            border border-white/10
                            bg-white/[0.055]
                            px-12
                            text-[15px] font-medium
                            text-white
                            caret-purple-400
                            outline-none
                            transition
                            placeholder:text-white/30
                            hover:border-white/20
                            focus:border-purple-400/70
                            focus:bg-white/[0.075]
                            focus:ring-4
                            focus:ring-purple-500/10
                            [&::-webkit-search-cancel-button]:hidden
                        "
                    />

                    {query.length > 0 && (
                        <button
                            type="button"
                            onClick={() => setQuery('')}
                            aria-label="Clear search"
                            className="
                                absolute right-4 top-1/2
                                flex h-8 w-8
                                -translate-y-1/2
                                items-center justify-center
                                rounded-lg
                                border-0
                                bg-transparent
                                text-white/45
                                transition
                                hover:bg-white/10
                                hover:text-white
                            "
                        >
                            <X size={17} />
                        </button>
                    )}
                </div>

                <div
                    className="
                        relative z-10
                        min-h-[260px]
                        overflow-x-hidden
                        overflow-y-auto
                        px-3 pb-4
                        [scrollbar-color:rgba(255,255,255,0.16)_transparent]
                        [scrollbar-width:thin]
                    "
                >
                    {normalizedQuery.length <
                    MIN_QUERY_LENGTH ? (
                        <div
                            className="
                                flex min-h-[260px]
                                flex-col items-center
                                justify-center gap-4
                                px-8 text-center
                                text-white/40
                            "
                        >
                            <div
                                className="
                                    flex h-14 w-14
                                    items-center justify-center
                                    rounded-2xl
                                    border border-purple-400/15
                                    bg-purple-500/10
                                    text-purple-300/70
                                "
                            >
                                <Search size={27} />
                            </div>

                            <div>
                                <p
                                    className="
                                        text-sm font-medium
                                        text-white/55
                                    "
                                >
                                    Search the crypto market
                                </p>

                                <p
                                    className="
                                        mt-1 text-xs
                                        text-white/30
                                    "
                                >
                                    Enter at least two
                                    characters
                                </p>
                            </div>
                        </div>
                    ) : isLoading ? (
                        <div
                            className="
                                flex min-h-[260px]
                                flex-col items-center
                                justify-center gap-4
                                text-white/40
                            "
                        >
                            <LoaderCircle
                                size={30}
                                className="
                                    animate-spin
                                    text-purple-400
                                "
                            />

                            <p className="text-sm">
                                Searching coins...
                            </p>
                        </div>
                    ) : error ? (
                        <div
                            className="
                                flex min-h-[260px]
                                items-center justify-center
                                px-8 text-center
                            "
                        >
                            <p
                                className="
                                    rounded-xl
                                    border border-red-400/15
                                    bg-red-400/10
                                    px-5 py-3
                                    text-sm text-red-300
                                "
                            >
                                {error}
                            </p>
                        </div>
                    ) : coins.length === 0 ? (
                        <div
                            className="
                                flex min-h-[260px]
                                flex-col items-center
                                justify-center gap-3
                                px-8 text-center
                                text-white/40
                            "
                        >
                            <Search
                                size={28}
                                className="text-white/25"
                            />

                            <p className="text-sm">
                                No coins found for{' '}
                                <span className="text-white/70">
                                    &ldquo;
                                    {normalizedQuery}
                                    &rdquo;
                                </span>
                            </p>
                        </div>
                    ) : (
                        <ul
                            className="
                                m-0 flex
                                list-none flex-col gap-1
                                p-0
                            "
                        >
                            {coins.map((coin) => (
                                <li
                                    key={coin.id}
                                    className="m-0 p-0"
                                >
                                    <button
                                        type="button"
                                        onClick={() =>
                                            handleCoinSelect(
                                                coin.id,
                                            )
                                        }
                                        className="
                                            group
                                            flex w-full
                                            items-center
                                            justify-between
                                            gap-4
                                            rounded-2xl
                                            border
                                            border-transparent
                                            bg-transparent
                                            px-3 py-3
                                            text-left
                                            transition
                                            hover:translate-x-1
                                            hover:border-purple-400/20
                                            hover:bg-purple-500/10
                                            focus:outline-none
                                            focus:ring-2
                                            focus:ring-purple-500/50
                                        "
                                    >
                                        <span
                                            className="
                                                flex min-w-0
                                                items-center
                                                gap-3
                                            "
                                        >
                                            <span
                                                className="
                                                    flex h-11 w-11
                                                    shrink-0
                                                    items-center
                                                    justify-center
                                                    overflow-hidden
                                                    rounded-full
                                                    border border-white/10
                                                    bg-white/[0.06]
                                                "
                                            >
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                    src={
                                                        coin.thumb
                                                    }
                                                    alt={`${coin.name} icon`}
                                                    width={44}
                                                    height={44}
                                                    className="
                                                        h-full w-full
                                                        object-cover
                                                    "
                                                />
                                            </span>

                                            <span
                                                className="
                                                    flex min-w-0
                                                    flex-col
                                                    items-start
                                                    gap-1
                                                "
                                            >
                                                <strong
                                                    className="
                                                        max-w-[180px]
                                                        truncate
                                                        text-sm
                                                        font-semibold
                                                        text-white/95
                                                        sm:max-w-[400px]
                                                        sm:text-[15px]
                                                    "
                                                >
                                                    {coin.name}
                                                </strong>

                                                <span
                                                    className="
                                                        text-[11px]
                                                        font-bold
                                                        uppercase
                                                        tracking-[0.1em]
                                                        text-white/35
                                                    "
                                                >
                                                    {coin.symbol}
                                                </span>
                                            </span>
                                        </span>

                                        <span
                                            className="
                                                min-w-10
                                                shrink-0
                                                rounded-lg
                                                border border-white/[0.07]
                                                bg-white/[0.04]
                                                px-2 py-1.5
                                                text-center
                                                text-[11px]
                                                font-semibold
                                                text-white/40
                                                transition
                                                group-hover:border-purple-400/20
                                                group-hover:text-purple-200/70
                                            "
                                        >
                                            {coin.market_cap_rank
                                                ? `#${coin.market_cap_rank}`
                                                : '—'}
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <footer
                    className="
                        relative z-10
                        flex items-center
                        justify-between gap-4
                        border-t border-white/[0.07]
                        bg-black/10
                        px-5 py-3.5
                        text-[11px]
                        text-white/25
                        sm:px-7
                    "
                >
                    <span className="hidden sm:inline">
                        Press Esc to close
                    </span>

                    <span>
                        Powered by CoinGecko
                    </span>
                </footer>
            </section>
        </div>,
        document.body,
    );
};

export default SearchModal;