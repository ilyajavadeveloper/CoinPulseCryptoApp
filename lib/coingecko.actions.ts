'use server';

import qs from 'query-string';

type CoinGeckoQueryValue =
    | string
    | number
    | boolean
    | string[]
    | number[]
    | boolean[]
    | null
    | undefined;

type CoinGeckoQueryParams = Record<string, CoinGeckoQueryValue>;

interface CoinGeckoApiError {
    error?: string;
    error_code?: number;
    error_message?: string;
    status?: {
        error_code?: number;
        error_message?: string;
    };
}

const rawBaseUrl = process.env.COINGECKO_BASE_URL;
const rawApiKey = process.env.COINGECKO_API_KEY;

if (!rawBaseUrl) {
    throw new Error(
        'COINGECKO_BASE_URL is missing in .env.local',
    );
}

if (!rawApiKey) {
    throw new Error(
        'COINGECKO_API_KEY is missing in .env.local',
    );
}

// После проверок TypeScript точно знает, что здесь string.
const BASE_URL: string = rawBaseUrl.replace(/\/+$/, '');
const API_KEY: string = rawApiKey;

export async function fetcher<T>(
    endpoint: string,
    params: CoinGeckoQueryParams = {},
    revalidate = 60,
): Promise<T> {
    const normalizedEndpoint = endpoint.startsWith('/')
        ? endpoint
        : `/${endpoint}`;

    const url = qs.stringifyUrl(
        {
            url: `${BASE_URL}${normalizedEndpoint}`,
            query: params,
        },
        {
            skipEmptyString: true,
            skipNull: true,
            arrayFormat: 'comma',
        },
    );

    const headers: Record<string, string> = {
        Accept: 'application/json',
        'x-cg-demo-api-key': API_KEY,
    };

    const response = await fetch(url, {
        method: 'GET',
        headers,
        next: {
            revalidate,
        },
    });

    const responseText = await response.text();

    let responseBody: unknown = null;

    if (responseText) {
        try {
            responseBody = JSON.parse(responseText);
        } catch {
            responseBody = responseText;
        }
    }

    if (!response.ok) {
        const errorBody =
            typeof responseBody === 'object' &&
            responseBody !== null
                ? (responseBody as CoinGeckoApiError)
                : null;

        const errorMessage =
            errorBody?.status?.error_message ??
            errorBody?.error_message ??
            errorBody?.error ??
            responseText ??
            response.statusText;

        const errorCode =
            errorBody?.status?.error_code ??
            errorBody?.error_code;

        console.error('CoinGecko API request failed:', {
            url,
            status: response.status,
            errorCode,
            errorMessage,
        });

        throw new Error(
            `CoinGecko API Error ${response.status}${
                errorCode ? ` (${errorCode})` : ''
            }: ${errorMessage}`,
        );
    }

    return responseBody as T;
}

export async function getPools(
    id: string,
    network?: string | null,
    contractAddress?: string | null,
): Promise<PoolData> {
    const fallback: PoolData = {
        id: '',
        address: '',
        name: '',
        network: '',
    };

    if (network && contractAddress) {
        try {
            const poolData = await fetcher<{
                data: PoolData[];
            }>(
                `/onchain/networks/${network}/tokens/${contractAddress}/pools`,
            );

            return poolData.data?.[0] ?? fallback;
        } catch (error) {
            console.error(
                'Failed to fetch pool by contract:',
                error,
            );

            return fallback;
        }
    }

    try {
        const poolData = await fetcher<{
            data: PoolData[];
        }>('/onchain/search/pools', {
            query: id,
        });

        return poolData.data?.[0] ?? fallback;
    } catch (error) {
        console.error(
            'Failed to search pools:',
            error,
        );

        return fallback;
    }
}