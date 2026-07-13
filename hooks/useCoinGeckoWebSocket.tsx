'use client';

import { useEffect, useRef, useState } from 'react';

const WS_BASE = `${process.env.NEXT_PUBLIC_COINGECKO_WEBSOCKET_URL}?x_cg_pro_api_key=${process.env.NEXT_PUBLIC_COINGECKO_API_KEY}`;

export const useCoinGeckoWebSocket = ({
                                          coinId,
                                          poolId,
                                          liveInterval,
                                      }: UseCoinGeckoWebSocketProps): UseCoinGeckoWebSocketReturn => {
    const wsRef = useRef<WebSocket | null>(null);

    // В TSX generic указывается именно так
    const subscribed = useRef<Set<string>>(new Set());

    const [price, setPrice] = useState<ExtendedPriceData | null>(null);
    const [trades, setTrades] = useState<Trade[]>([]);
    const [ohlcv, setOhlcv] = useState<OHLCData | null>(null);
    const [isWsReady, setIsWsReady] = useState(false);

    useEffect(() => {

        if (!process.env.NEXT_PUBLIC_COINGECKO_API_KEY) {
            console.error('NEXT_PUBLIC_COINGECKO_API_KEY is not configured');
            return;
        }

        const ws = new WebSocket(WS_BASE);
        wsRef.current = ws;

        const send = (payload: Record<string, unknown>) => {
            if (ws.readyState !== WebSocket.OPEN) return;

            ws.send(JSON.stringify(payload));
        };

        const handleMessage = (event: MessageEvent<string>) => {
            try {
                const msg: WebSocketMessage = JSON.parse(event.data);

                if (msg.type === 'ping') {
                    send({ type: 'pong' });
                    return;
                }

                if (
                    msg.type === 'confirm_subscription' &&
                    msg.identifier
                ) {
                    try {
                        const identifier = JSON.parse(msg.identifier) as {
                            channel?: string;
                        };

                        if (identifier.channel) {
                            subscribed.current.add(identifier.channel);
                        }
                    } catch (error) {
                        console.error(
                            'Invalid subscription identifier:',
                            error,
                        );
                    }

                    return;
                }

                if (msg.c === 'C1') {
                    setPrice({
                        usd: msg.p ?? 0,
                        coin: msg.i,
                        price: msg.p,
                        change24h: msg.pp,
                        marketCap: msg.m,
                        volume24h: msg.v,
                        timestamp: msg.t,
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
                        [newTrade, ...previousTrades].slice(0, 7),
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
            } catch (error) {
                console.error('WebSocket message parsing error:', error);
            }
        };

        ws.onopen = () => {
            setIsWsReady(true);
        };

        ws.onmessage = handleMessage;

        ws.onclose = () => {
            setIsWsReady(false);
            wsRef.current = null;
            subscribed.current.clear();
        };

        ws.onerror = (error) => {
            console.error('CoinGecko WebSocket error:', error);
            setIsWsReady(false);
        };

        return () => {
            subscribed.current.clear();
            wsRef.current = null;
            ws.close();
        };
    }, []);

    useEffect(() => {
        const ws = wsRef.current;

        if (!isWsReady || !ws || ws.readyState !== WebSocket.OPEN) {
            return;
        }

        const send = (payload: Record<string, unknown>) => {
            if (ws.readyState !== WebSocket.OPEN) return;

            ws.send(JSON.stringify(payload));
        };

        const unsubscribeAll = () => {
            subscribed.current.forEach((channel) => {
                send({
                    command: 'unsubscribe',
                    identifier: JSON.stringify({ channel }),
                });
            });

            subscribed.current.clear();
        };

        const subscribe = (
            channel: string,
            data?: Record<string, unknown>,
        ) => {
            if (subscribed.current.has(channel)) return;

            send({
                command: 'subscribe',
                identifier: JSON.stringify({ channel }),
            });

            if (data) {
                send({
                    command: 'message',
                    identifier: JSON.stringify({ channel }),
                    data: JSON.stringify(data),
                });
            }
        };

        setPrice(null);
        setTrades([]);
        setOhlcv(null);

        unsubscribeAll();

        subscribe('CGSimplePrice', {
            coin_id: [coinId],
            action: 'set_tokens',
        });

        const poolAddress = poolId.replace('_', ':');

        if (poolAddress) {
            subscribe('OnchainTrade', {
                'network_id:pool_addresses': [poolAddress],
                action: 'set_pools',
            });

            subscribe('OnchainOHLCV', {
                'network_id:pool_addresses': [poolAddress],
                interval: liveInterval,
                action: 'set_pools',
            });
        }
    }, [coinId, poolId, isWsReady, liveInterval]);

    return {
        price,
        trades,
        ohlcv,
        isConnected: isWsReady,
    };
};