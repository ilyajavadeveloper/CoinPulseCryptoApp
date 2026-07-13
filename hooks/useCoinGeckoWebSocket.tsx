'use client';

import { useEffect, useRef, useState } from 'react';

import { fetcher } from '@/lib/coingecko.actions';

/**
 * У тебя CoinGecko Demo API.
 * WebSocket для него недоступен, поэтому используем REST polling.
 *
 * Когда появится платный CoinGecko Analyst+,
 * можно переключить значение на true.
 */
const ENABLE_COINGECKO_WEBSOCKET = false;

const PRICE_POLL_INTERVAL = 15_000;

interface SimplePriceData {
    usd?: number;
    usd_24h_change?: number;
    usd_market_cap?: number;
    usd_24h_vol?: number;
    last_updated_at?: number;
}

type SimplePriceResponse = Record<
    string,
    SimplePriceData | undefined
>;

export const useCoinGeckoWebSocket = ({
                                          coinId,
                                          poolId,
                                          liveInterval,
                                      }: UseCoinGeckoWebSocketProps): UseCoinGeckoWebSocketReturn => {
    const wsRef = useRef<WebSocket | null>(null);
    const subscribed = useRef<Set<string>>(new Set());

    const [price, setPrice] =
        useState<ExtendedPriceData | null>(null);

    const [trades, setTrades] = useState<Trade[]>([]);
    const [ohlcv, setOhlcv] = useState<OHLCData | null>(null);

    const [isWsReady, setIsWsReady] = useState(false);
    const [isPollingReady, setIsPollingReady] = useState(false);

    /**
     * REST fallback.
     *
     * Обновляет цену без CoinGecko WebSocket.
     * Работает с твоим текущим COINGECKO_API_KEY.
     */
    useEffect(() => {
        let isActive = true;

        const fetchCurrentPrice = async (): Promise<void> => {
            try {
                const response =
                    await fetcher<SimplePriceResponse>(
                        '/simple/price',
                        {
                            ids: coinId,
                            vs_currencies: 'usd',
                            include_24hr_change: true,
                            include_market_cap: true,
                            include_24hr_vol: true,
                            include_last_updated_at: true,
                        },
                        0,
                    );

                if (!isActive) return;

                const coinPrice = response?.[coinId];

                if (!coinPrice) {
                    setIsPollingReady(false);
                    return;
                }

                const currentPrice = coinPrice.usd ?? 0;

                setPrice({
                    usd: currentPrice,
                    coin: coinId,
                    price: currentPrice,
                    change24h:
                        coinPrice.usd_24h_change ?? 0,
                    marketCap:
                        coinPrice.usd_market_cap ?? 0,
                    volume24h:
                        coinPrice.usd_24h_vol ?? 0,
                    timestamp:
                        coinPrice.last_updated_at ??
                        Math.floor(Date.now() / 1000),
                });

                setIsPollingReady(true);
            } catch {
                if (!isActive) return;

                setIsPollingReady(false);
            }
        };

        setPrice(null);
        setIsPollingReady(false);

        void fetchCurrentPrice();

        const pollingInterval = window.setInterval(() => {
            void fetchCurrentPrice();
        }, PRICE_POLL_INTERVAL);

        return () => {
            isActive = false;
            window.clearInterval(pollingInterval);
        };
    }, [coinId]);

    /**
     * CoinGecko WebSocket.
     *
     * Сейчас отключён, потому что Demo API key
     * не имеет доступа к WebSocket.
     */
    useEffect(() => {
        if (!ENABLE_COINGECKO_WEBSOCKET) {
            setIsWsReady(false);
            return;
        }

        const websocketBaseUrl =
            process.env
                .NEXT_PUBLIC_COINGECKO_WEBSOCKET_URL;

        const websocketApiKey =
            process.env.NEXT_PUBLIC_COINGECKO_API_KEY;

        if (!websocketBaseUrl || !websocketApiKey) {
            setIsWsReady(false);
            return;
        }

        let isActive = true;

        const separator = websocketBaseUrl.includes('?')
            ? '&'
            : '?';

        const websocketUrl =
            `${websocketBaseUrl}${separator}` +
            `x_cg_pro_api_key=${encodeURIComponent(
                websocketApiKey,
            )}`;

        let ws: WebSocket;

        try {
            ws = new WebSocket(websocketUrl);
        } catch {
            setIsWsReady(false);
            return;
        }

        wsRef.current = ws;

        const send = (
            payload: Record<string, unknown>,
        ): void => {
            if (
                !isActive ||
                ws.readyState !== WebSocket.OPEN
            ) {
                return;
            }

            try {
                ws.send(JSON.stringify(payload));
            } catch {
                // Соединение уже могло закрыться.
            }
        };

        const handleMessage = (
            event: MessageEvent<string>,
        ): void => {
            if (!isActive) return;

            try {
                const msg: WebSocketMessage =
                    JSON.parse(event.data);

                if (msg.type === 'ping') {
                    send({ type: 'pong' });
                    return;
                }

                if (
                    msg.type ===
                    'confirm_subscription' &&
                    msg.identifier
                ) {
                    try {
                        const identifier = JSON.parse(
                            msg.identifier,
                        ) as {
                            channel?: string;
                        };

                        if (identifier.channel) {
                            subscribed.current.add(
                                identifier.channel,
                            );
                        }
                    } catch {
                        // Некорректный identifier игнорируем.
                    }

                    return;
                }

                if (msg.c === 'C1') {
                    setPrice({
                        usd: msg.p ?? 0,
                        coin: msg.i,
                        price: msg.p ?? 0,
                        change24h: msg.pp ?? 0,
                        marketCap: msg.m ?? 0,
                        volume24h: msg.v ?? 0,
                        timestamp:
                            msg.t ??
                            Math.floor(
                                Date.now() / 1000,
                            ),
                    });

                    return;
                }

                if (msg.c === 'G2') {
                    const newTrade: Trade = {
                        price: msg.pu,
                        value: msg.vo,
                        timestamp: msg.t ?? 0,
                        type: msg.ty,
                        amount: msg.to,
                    };

                    setTrades((previousTrades) =>
                        [
                            newTrade,
                            ...previousTrades,
                        ].slice(0, 7),
                    );

                    return;
                }

                if (msg.ch === 'G3') {
                    const candle: OHLCData = [
                        msg.t ?? 0,
                        Number(msg.o ?? 0),
                        Number(msg.h ?? 0),
                        Number(msg.l ?? 0),
                        Number(msg.c ?? 0),
                    ];

                    setOhlcv(candle);
                }
            } catch {
                // Некорректные сообщения не ломают приложение.
            }
        };

        ws.onopen = () => {
            if (!isActive) return;

            setIsWsReady(true);
        };

        ws.onmessage = handleMessage;

        ws.onerror = () => {
            if (!isActive) return;

            setIsWsReady(false);

            try {
                ws.close();
            } catch {
                // Сокет уже мог быть закрыт.
            }
        };

        ws.onclose = () => {
            if (!isActive) return;

            setIsWsReady(false);
            wsRef.current = null;
            subscribed.current.clear();
        };

        return () => {
            isActive = false;

            subscribed.current.clear();
            setIsWsReady(false);

            ws.onopen = null;
            ws.onmessage = null;
            ws.onerror = null;
            ws.onclose = null;

            if (
                ws.readyState === WebSocket.OPEN ||
                ws.readyState === WebSocket.CONNECTING
            ) {
                try {
                    ws.close();
                } catch {
                    // Ничего не делаем.
                }
            }

            wsRef.current = null;
        };
    }, []);

    /**
     * Подписки WebSocket.
     *
     * Этот effect начнёт работать только когда
     * ENABLE_COINGECKO_WEBSOCKET станет true
     * и соединение успешно откроется.
     */
    useEffect(() => {
        const ws = wsRef.current;

        if (
            !ENABLE_COINGECKO_WEBSOCKET ||
            !isWsReady ||
            !ws ||
            ws.readyState !== WebSocket.OPEN
        ) {
            return;
        }

        const send = (
            payload: Record<string, unknown>,
        ): void => {
            if (ws.readyState !== WebSocket.OPEN) {
                return;
            }

            try {
                ws.send(JSON.stringify(payload));
            } catch {
                // Игнорируем закрытие соединения.
            }
        };

        const unsubscribeAll = (): void => {
            subscribed.current.forEach((channel) => {
                send({
                    command: 'unsubscribe',
                    identifier: JSON.stringify({
                        channel,
                    }),
                });
            });

            subscribed.current.clear();
        };

        const subscribe = (
            channel: string,
            data?: Record<string, unknown>,
        ): void => {
            if (subscribed.current.has(channel)) {
                return;
            }

            send({
                command: 'subscribe',
                identifier: JSON.stringify({
                    channel,
                }),
            });

            if (data) {
                send({
                    command: 'message',
                    identifier: JSON.stringify({
                        channel,
                    }),
                    data: JSON.stringify(data),
                });
            }
        };

        setTrades([]);
        setOhlcv(null);

        unsubscribeAll();

        subscribe('CGSimplePrice', {
            coin_id: [coinId],
            vs_currencies: ['usd'],
            action: 'set_tokens',
        });

        const poolAddress = poolId.replace('_', ':');

        if (!poolAddress) return;

        subscribe('OnchainTrade', {
            'network_id:pool_addresses': [
                poolAddress,
            ],
            action: 'set_pools',
        });

        subscribe('OnchainOHLCV', {
            'network_id:pool_addresses': [
                poolAddress,
            ],
            interval: liveInterval,
            action: 'set_pools',
        });
    }, [
        coinId,
        poolId,
        isWsReady,
        liveInterval,
    ]);

    return {
        price,
        trades,
        ohlcv,
        isConnected:
            isWsReady || isPollingReady,
    };
};