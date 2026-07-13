import {
    NextRequest,
    NextResponse,
} from 'next/server';

interface CoinGeckoSearchCoin {
    id: string;
    name: string;
    symbol: string;
    market_cap_rank: number | null;
    thumb: string;
}

interface CoinGeckoSearchResponse {
    coins?: CoinGeckoSearchCoin[];
}

export async function GET(
    request: NextRequest,
) {
    const query =
        request.nextUrl.searchParams
            .get('q')
            ?.trim() ?? '';

    if (query.length < 2) {
        return NextResponse.json({
            coins: [],
        });
    }

    const rawBaseUrl =
        process.env.COINGECKO_BASE_URL;

    const apiKey =
        process.env.COINGECKO_API_KEY;

    if (!rawBaseUrl || !apiKey) {
        return NextResponse.json(
            {
                coins: [],
                error:
                    'CoinGecko is not configured.',
            },
            {
                status: 500,
            },
        );
    }

    const baseUrl = rawBaseUrl.replace(
        /\/+$/,
        '',
    );

    const url = new URL(
        `${baseUrl}/search`,
    );

    url.searchParams.set('query', query);

    try {
        const response = await fetch(
            url.toString(),
            {
                method: 'GET',
                headers: {
                    Accept: 'application/json',
                    'x-cg-demo-api-key': apiKey,
                },
                next: {
                    revalidate: 30,
                },
            },
        );

        if (!response.ok) {
            return NextResponse.json(
                {
                    coins: [],
                    error:
                        'CoinGecko search failed.',
                },
                {
                    status: response.status,
                },
            );
        }

        const data =
            (await response.json()) as CoinGeckoSearchResponse;

        return NextResponse.json({
            coins: Array.isArray(data.coins)
                ? data.coins.slice(0, 10)
                : [],
        });
    } catch {
        return NextResponse.json(
            {
                coins: [],
                error:
                    'CoinGecko search is unavailable.',
            },
            {
                status: 500,
            },
        );
    }
}