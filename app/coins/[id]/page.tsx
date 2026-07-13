import React from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { fetcher, getPools } from "@/lib/coingecko.actions";
import { formatCurrency } from "@/lib/utils";

import LiveDataWrapper from "@/components/LiveDataWrapper";
import Converter from "@/components/Converter";

const getNetworkFromGeckoTerminalUrl = (
    geckoTerminalUrl?: string | null,
): string | null => {
    if (!geckoTerminalUrl) {
        return null;
    }

    try {
        const url = new URL(geckoTerminalUrl);

        const pathnameParts = url.pathname
            .split("/")
            .filter(Boolean);

        const networksIndex = pathnameParts.indexOf("networks");

        if (
            networksIndex !== -1 &&
            pathnameParts[networksIndex + 1]
        ) {
            return pathnameParts[networksIndex + 1];
        }

        return pathnameParts[0] ?? null;
    } catch {
        return null;
    }
};

const Page = async ({ params }: NextPageProps) => {
    const { id } = await params;

    const [coinData, coinOHLCData] = await Promise.all([
        fetcher<CoinDetailsData>(`/coins/${id}`, {
            dex_pair_format: "contract_address",
        }),

        fetcher<OHLCData[]>(`/coins/${id}/ohlc`, {
            vs_currency: "usd",
            days: 1,
            precision: "full",
        }),
    ]);

    const platform = coinData.asset_platform_id
        ? coinData.detail_platforms?.[
            coinData.asset_platform_id
            ]
        : null;

    const network = getNetworkFromGeckoTerminalUrl(
        platform?.geckoterminal_url,
    );

    const contractAddress =
        platform?.contract_address ?? null;

    const pool =
        network && contractAddress
            ? await getPools(
                id,
                network,
                contractAddress,
            )
            : null;

    const poolId = pool?.id ?? "";

    const coinDetails = [
        {
            label: "Market Cap",
            value: formatCurrency(
                coinData.market_data.market_cap.usd,
            ),
        },
        {
            label: "Market Cap Rank",
            value: coinData.market_cap_rank
                ? `#${coinData.market_cap_rank}`
                : "N/A",
        },
        {
            label: "Total Volume",
            value: formatCurrency(
                coinData.market_data.total_volume.usd,
            ),
        },
        {
            label: "Website",
            value: "-",
            link:
                coinData.links.homepage.find(
                    (homepage) => homepage.length > 0,
                ) ?? "",
            linkText: "Homepage",
        },
        {
            label: "Explorer",
            value: "-",
            link:
                coinData.links.blockchain_site.find(
                    (blockchainSite) =>
                        blockchainSite.length > 0,
                ) ?? "",
            linkText: "Explorer",
        },
        {
            label: "Community",
            value: "-",
            link: coinData.links.subreddit_url ?? "",
            linkText: "Community",
        },
    ];

    return (
        <main id="coin-details-page">
            <section className="primary">
                <LiveDataWrapper
                    coinId={id}
                    poolId={poolId}
                    coin={coinData}
                    coinOHLCData={coinOHLCData}
                >
                    <h4>Exchange Listings</h4>
                </LiveDataWrapper>
            </section>

            <section className="secondary">
                <Converter
                    symbol={coinData.symbol}
                    icon={coinData.image.small}
                    priceList={
                        coinData.market_data.current_price
                    }
                />

                <div className="details">
                    <h4>Coin Details</h4>

                    <ul className="details-grid">
                        {coinDetails.map(
                            (
                                {
                                    label,
                                    value,
                                    link,
                                    linkText,
                                },
                                index,
                            ) => (
                                <li key={`${label}-${index}`}>
                                    <p className={label}>
                                        {label}
                                    </p>

                                    {link ? (
                                        <div className="link">
                                            <Link
                                                href={link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                {linkText ||
                                                    label}
                                            </Link>

                                            <ArrowUpRight
                                                size={16}
                                            />
                                        </div>
                                    ) : (
                                        <p className="text-base font-medium">
                                            {value}
                                        </p>
                                    )}
                                </li>
                            ),
                        )}
                    </ul>
                </div>
            </section>
        </main>
    );
};

export default Page;