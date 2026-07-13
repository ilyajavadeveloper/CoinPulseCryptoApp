'use client';

import type { ReactNode } from 'react';
import {
    useEffect,
    useRef,
    useState,
    useTransition,
} from 'react';

import {
    CandlestickSeries,
    createChart,
    type IChartApi,
    type ISeriesApi,
} from 'lightweight-charts';

import {
    getCandlestickConfig,
    getChartConfig,
    LIVE_INTERVAL_BUTTONS,
    PERIOD_BUTTONS,
    PERIOD_CONFIG,
} from '@/constants';

import { fetcher } from '@/lib/coingecko.actions';
import { convertOHLCData } from '@/lib/utils';

type Period = keyof typeof PERIOD_CONFIG;

type LiveInterval =
    (typeof LIVE_INTERVAL_BUTTONS)[number]['value'];

type ChartMode = 'historical' | 'live';

interface CandlestickChartProps {
    children?: ReactNode;
    data: OHLCData[];
    coinId: string;
    height?: number;
    initialPeriod?: Period;
    liveOhlcv?: OHLCData | null;
    mode?: ChartMode;
    liveInterval?: LiveInterval;
    setLiveInterval?: (interval: LiveInterval) => void;
}

const CandlestickChart = ({
                              children,
                              data,
                              coinId,
                              height = 360,
                              initialPeriod = 'daily',
                              liveOhlcv = null,
                              mode = 'historical',
                              liveInterval,
                              setLiveInterval,
                          }: CandlestickChartProps) => {
    const chartContainerRef = useRef<HTMLDivElement | null>(
        null,
    );

    const chartRef = useRef<IChartApi | null>(null);

    const candleSeriesRef =
        useRef<ISeriesApi<'Candlestick'> | null>(null);

    const prevOhlcDataLength = useRef<number>(
        data?.length ?? 0,
    );

    const [period, setPeriod] =
        useState<Period>(initialPeriod);

    const [ohlcData, setOhlcData] = useState<OHLCData[]>(
        data ?? [],
    );

    const [isPending, startTransition] = useTransition();

    const fetchOHLCData = async (
        selectedPeriod: Period,
    ): Promise<void> => {
        try {
            const { days } = PERIOD_CONFIG[selectedPeriod];

            const newData = await fetcher<OHLCData[]>(
                `/coins/${coinId}/ohlc`,
                {
                    vs_currency: 'usd',
                    days,
                    precision: 'full',
                },
            );

            startTransition(() => {
                setOhlcData(
                    Array.isArray(newData) ? newData : [],
                );
            });
        } catch (error) {
            console.error(
                'Failed to fetch OHLC data:',
                error instanceof Error
                    ? error.message
                    : error,
            );
        }
    };

    const handlePeriodChange = (
        newPeriod: Period,
    ): void => {
        if (newPeriod === period || isPending) {
            return;
        }

        setPeriod(newPeriod);
        void fetchOHLCData(newPeriod);
    };

    useEffect(() => {
        setOhlcData(data ?? []);
        prevOhlcDataLength.current = data?.length ?? 0;
    }, [data]);

    useEffect(() => {
        const container = chartContainerRef.current;

        if (!container) {
            return;
        }

        const showTime = [
            'daily',
            'weekly',
            'monthly',
        ].includes(period);

        const chart = createChart(container, {
            ...getChartConfig(height, showTime),
            width: container.clientWidth,
        });

        const candleSeries = chart.addSeries(
            CandlestickSeries,
            getCandlestickConfig(),
        );

        const convertedToSeconds = ohlcData.map(
            (item) =>
                [
                    Math.floor(item[0] / 1000),
                    item[1],
                    item[2],
                    item[3],
                    item[4],
                ] as OHLCData,
        );

        candleSeries.setData(
            convertOHLCData(convertedToSeconds),
        );

        chart.timeScale().fitContent();

        chartRef.current = chart;
        candleSeriesRef.current = candleSeries;

        const resizeObserver = new ResizeObserver(
            (entries) => {
                const entry = entries[0];

                if (!entry) {
                    return;
                }

                chart.applyOptions({
                    width: entry.contentRect.width,
                });
            },
        );

        resizeObserver.observe(container);

        return () => {
            resizeObserver.disconnect();
            chart.remove();

            chartRef.current = null;
            candleSeriesRef.current = null;
        };
    }, [height, period]);

    useEffect(() => {
        const candleSeries = candleSeriesRef.current;

        if (!candleSeries) {
            return;
        }

        const convertedToSeconds = ohlcData.map(
            (item) =>
                [
                    Math.floor(item[0] / 1000),
                    item[1],
                    item[2],
                    item[3],
                    item[4],
                ] as OHLCData,
        );

        let mergedData: OHLCData[];

        if (liveOhlcv) {
            const liveTimestamp = liveOhlcv[0];

            const lastHistoricalCandle =
                convertedToSeconds[
                convertedToSeconds.length - 1
                    ];

            if (
                lastHistoricalCandle &&
                lastHistoricalCandle[0] === liveTimestamp
            ) {
                mergedData = [
                    ...convertedToSeconds.slice(0, -1),
                    liveOhlcv,
                ];
            } else {
                mergedData = [
                    ...convertedToSeconds,
                    liveOhlcv,
                ];
            }
        } else {
            mergedData = convertedToSeconds;
        }

        mergedData.sort(
            (firstCandle, secondCandle) =>
                firstCandle[0] - secondCandle[0],
        );

        candleSeries.setData(
            convertOHLCData(mergedData),
        );

        const dataChanged =
            prevOhlcDataLength.current !==
            ohlcData.length;

        if (dataChanged || mode === 'historical') {
            chartRef.current
                ?.timeScale()
                .fitContent();

            prevOhlcDataLength.current =
                ohlcData.length;
        }
    }, [ohlcData, liveOhlcv, mode]);

    return (
        <div id="candlestick-chart">
            <div className="chart-header">
                <div className="flex-1">
                    {children}
                </div>

                <div className="button-group">
                    <span className="mx-2 text-sm font-medium text-purple-100/50">
                        Period:
                    </span>

                    {PERIOD_BUTTONS.map(
                        ({ value, label }) => {
                            const periodValue =
                                value as Period;

                            return (
                                <button
                                    key={value}
                                    type="button"
                                    className={
                                        period ===
                                        periodValue
                                            ? 'config-button-active'
                                            : 'config-button'
                                    }
                                    onClick={() =>
                                        handlePeriodChange(
                                            periodValue,
                                        )
                                    }
                                    disabled={isPending}
                                >
                                    {label}
                                </button>
                            );
                        },
                    )}
                </div>

                {liveInterval && (
                    <div className="button-group">
                        <span className="mx-2 text-sm font-medium text-purple-100/50">
                            Update Frequency:
                        </span>

                        {LIVE_INTERVAL_BUTTONS.map(
                            ({ value, label }) => (
                                <button
                                    key={value}
                                    type="button"
                                    className={
                                        liveInterval ===
                                        value
                                            ? 'config-button-active'
                                            : 'config-button'
                                    }
                                    onClick={() =>
                                        setLiveInterval?.(
                                            value,
                                        )
                                    }
                                    disabled={isPending}
                                >
                                    {label}
                                </button>
                            ),
                        )}
                    </div>
                )}
            </div>

            <div
                ref={chartContainerRef}
                className="chart"
                style={{ height }}
            />
        </div>
    );
};

export default CandlestickChart;