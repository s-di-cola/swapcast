<script lang="ts">
    interface Props {
        marketCount?: number;
        openMarketsCount?: number;
        totalStake?: number;
        loading?: boolean;
    }
    
    interface CardConfig {
        title: string;
        value: number | string;
        subtitle: string;
        icon: string;
        iconColor: string;
        bgColor: string;
    }
    
    let {
        marketCount = 0,
        openMarketsCount = 0,
        totalStake = 0,
        loading = false
    }: Props = $props();
    
    const ICONS = {
        chart: 'M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z',
        check: 'M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z',
        dollar: 'M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z'
    } as const;
    
    const UI_TEXT = {
        loading: 'Fetching data...',
        loadingValue: '--',
        loadingCurrency: '$--',
        totalMarkets: 'Total Markets',
        marketsCreated: 'Markets created',
        activeMarkets: 'Active Markets',
        currentlyOpen: 'Currently open',
        totalVolume: 'Total Volume',
        totalStakeAcross: 'Total stake across all markets'
    } as const;
    
    function formatCurrency(value: string | number): string {
        const num = typeof value === 'string' ? parseFloat(value) : value;
        if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`;
        if (num >= 1_000) return `$${(num / 1_000).toFixed(2)}K`;
        return `$${num.toFixed(2)}`;
    }
    
    const cards: CardConfig[] = $derived([
        {
            title: UI_TEXT.totalMarkets,
            value: loading ? UI_TEXT.loadingValue : marketCount,
            subtitle: loading ? UI_TEXT.loading : UI_TEXT.marketsCreated,
            icon: ICONS.chart,
            iconColor: 'text-indigo-500',
            bgColor: 'bg-indigo-100'
        },
        {
            title: UI_TEXT.activeMarkets,
            value: loading ? UI_TEXT.loadingValue : openMarketsCount,
            subtitle: loading ? UI_TEXT.loading : UI_TEXT.currentlyOpen,
            icon: ICONS.check,
            iconColor: 'text-green-500',
            bgColor: 'bg-green-100'
        },
        {
            title: UI_TEXT.totalVolume,
            value: loading ? UI_TEXT.loadingCurrency : formatCurrency(totalStake),
            subtitle: loading ? UI_TEXT.loading : UI_TEXT.totalStakeAcross,
            icon: ICONS.dollar,
            iconColor: 'text-purple-500',
            bgColor: 'bg-purple-100'
        }
    ]);
    </script>
    
    <section class="mb-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {#each cards as card}
            <div class="rounded-lg border border-gray-100 bg-white p-6 shadow-sm">
                <div class="mb-2 flex items-center justify-between">
                    <h2 class="text-sm font-semibold tracking-wider text-gray-600 uppercase">
                        {card.title}
                    </h2>
                    <div class="rounded-full p-2 {card.bgColor}">
                        <svg
                            class="h-5 w-5 {card.iconColor}"
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            aria-hidden="true"
                        >
                            <path
                                fill-rule="evenodd"
                                d={card.icon}
                                clip-rule="evenodd"
                            />
                        </svg>
                    </div>
                </div>
                <p class="text-3xl font-bold text-gray-900">{card.value}</p>
                <p class="mt-1 text-sm text-gray-500">{card.subtitle}</p>
            </div>
        {/each}
    </section>