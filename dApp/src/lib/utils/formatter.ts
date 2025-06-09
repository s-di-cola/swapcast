/**
 * Number and Currency Formatting Utilities
 * 
 * Comprehensive formatting functions for displaying numbers, currencies, and crypto values
 */

/**
 * Formats a number with appropriate decimal places and thousands separators
 * 
 * @param value - The number to format
 * @param decimals - Number of decimal places (default: auto-detect)
 * @param options - Additional formatting options
 * @returns Formatted number string
 */
export function formatNumber(
    value: number | string | null | undefined, 
    decimals?: number,
    options: {
        compact?: boolean;
        currency?: string;
        minimumFractionDigits?: number;
        maximumFractionDigits?: number;
    } = {}
): string {
    // Handle null/undefined/empty values
    if (value === null || value === undefined || value === '') {
        return '0';
    }

    // Convert to number if it's a string
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    
    // Handle invalid numbers
    if (isNaN(numValue)) {
        return '0';
    }

    const { compact = false, currency, minimumFractionDigits, maximumFractionDigits } = options;

    // Auto-detect decimal places if not specified
    let finalDecimals = decimals;
    if (finalDecimals === undefined) {
        if (numValue === 0) {
            finalDecimals = 0;
        } else if (numValue >= 1000) {
            finalDecimals = 0;
        } else if (numValue >= 10) {
            finalDecimals = 2;
        } else if (numValue >= 1) {
            finalDecimals = 3;
        } else if (numValue >= 0.01) {
            finalDecimals = 4;
        } else {
            finalDecimals = 6;
        }
    }

    const formatOptions: Intl.NumberFormatOptions = {
        minimumFractionDigits: minimumFractionDigits ?? 0,
        maximumFractionDigits: maximumFractionDigits ?? finalDecimals,
        useGrouping: true
    };

    if (compact && numValue >= 1000) {
        formatOptions.notation = 'compact';
        formatOptions.compactDisplay = 'short';
    }

    if (currency) {
        formatOptions.style = 'currency';
        formatOptions.currency = currency;
    }

    try {
        return new Intl.NumberFormat('en-US', formatOptions).format(numValue);
    } catch (error) {
        console.error('Error formatting number:', error);
        return numValue.toString();
    }
}

/**
 * Formats a number as USD currency
 * 
 * @param value - The value to format
 * @param decimals - Number of decimal places
 * @returns Formatted currency string (e.g., "$1,234.56")
 */
export function formatCurrency(
    value: number | string | null | undefined, 
    decimals?: number
): string {
    if (value === null || value === undefined || value === '') {
        return '$0.00';
    }

    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    
    if (isNaN(numValue)) {
        return '$0.00';
    }

    // Auto-detect decimals for currency
    let finalDecimals = decimals;
    if (finalDecimals === undefined) {
        if (numValue >= 1000) {
            finalDecimals = 0;
        } else if (numValue >= 1) {
            finalDecimals = 2;
        } else {
            finalDecimals = 4;
        }
    }

    return formatNumber(numValue, finalDecimals, { 
        currency: 'USD',
        minimumFractionDigits: numValue >= 1 ? 2 : 0
    });
}

/**
 * Formats ETH amounts with appropriate precision
 * 
 * @param value - ETH amount (can be in wei as bigint/string or ETH as number)
 * @param options - Formatting options
 * @returns Formatted ETH string
 */
export function formatEth(
    value: number | string | bigint | null | undefined,
    options: {
        fromWei?: boolean;
        showSymbol?: boolean;
        decimals?: number;
        compact?: boolean;
    } = {}
): string {
    const { fromWei = false, showSymbol = true, decimals, compact = false } = options;

    if (value === null || value === undefined || value === '') {
        return showSymbol ? '0 ETH' : '0';
    }

    let ethValue: number;

    if (fromWei) {
        // Convert from wei to ETH
        if (typeof value === 'bigint') {
            ethValue = Number(value) / 1e18;
        } else if (typeof value === 'string') {
            ethValue = Number(value) / 1e18;
        } else {
            ethValue = value / 1e18;
        }
    } else {
        // Already in ETH
        ethValue = typeof value === 'string' ? parseFloat(value) : Number(value);
    }

    if (isNaN(ethValue)) {
        return showSymbol ? '0 ETH' : '0';
    }

    const formatted = formatNumber(ethValue, decimals, { compact });
    return showSymbol ? `${formatted} ETH` : formatted;
}

/**
 * Formats a percentage value
 * 
 * @param value - Percentage value (0-100)
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted percentage string
 */
export function formatPercentage(
    value: number | string | null | undefined, 
    decimals: number = 1
): string {
    if (value === null || value === undefined || value === '') {
        return '0%';
    }

    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    
    if (isNaN(numValue)) {
        return '0%';
    }

    return `${formatNumber(numValue, decimals)}%`;
}

/**
 * Formats large numbers with compact notation (K, M, B, T)
 * 
 * @param value - Number to format
 * @param decimals - Number of decimal places
 * @returns Formatted compact number string
 */
export function formatCompact(
    value: number | string | null | undefined, 
    decimals: number = 1
): string {
    return formatNumber(value, decimals, { compact: true });
}

/**
 * Formats a price with appropriate precision based on the value
 * 
 * @param value - Price value
 * @param currency - Currency symbol (default: USD)
 * @returns Formatted price string
 */
export function formatPrice(
    value: number | string | null | undefined,
    currency: string = 'USD'
): string {
    if (value === null || value === undefined || value === '') {
        return currency === 'USD' ? '$0.00' : `0 ${currency}`;
    }

    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    
    if (isNaN(numValue)) {
        return currency === 'USD' ? '$0.00' : `0 ${currency}`;
    }

    if (currency === 'USD') {
        return formatCurrency(numValue);
    }

    // For other currencies, just format as number with symbol
    return `${formatNumber(numValue)} ${currency}`;
}

/**
 * Formats time remaining in human-readable format
 * 
 * @param seconds - Seconds remaining
 * @returns Formatted time string (e.g., "2d 3h", "45m", "Expired")
 */
export function formatTimeRemaining(seconds: number): string {
    if (seconds <= 0) {
        return 'Expired';
    }

    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) {
        return `${days}d ${hours}h`;
    } else if (hours > 0) {
        return `${hours}h ${minutes}m`;
    } else {
        return `${minutes}m`;
    }
}

/**
 * Abbreviates long addresses or transaction hashes
 * 
 * @param address - Address or hash to abbreviate
 * @param startLength - Number of characters to show at start (default: 6)
 * @param endLength - Number of characters to show at end (default: 4)
 * @returns Abbreviated string
 */
export function formatAddress(
    address: string | null | undefined,
    startLength: number = 6,
    endLength: number = 4
): string {
    if (!address || typeof address !== 'string') {
        return '';
    }

    if (address.length <= startLength + endLength) {
        return address;
    }

    return `${address.slice(0, startLength)}...${address.slice(-endLength)}`;
}

/**
 * Formats a transaction hash for display
 * 
 * @param hash - Transaction hash
 * @returns Formatted hash string
 */
export function formatTxHash(hash: string | null | undefined): string {
    return formatAddress(hash, 8, 6);
}

/**
 * Utility to safely convert various input types to number
 * 
 * @param value - Value to convert
 * @param defaultValue - Default value if conversion fails
 * @returns Converted number or default
 */
export function safeToNumber(
    value: number | string | bigint | null | undefined,
    defaultValue: number = 0
): number {
    if (value === null || value === undefined) {
        return defaultValue;
    }

    if (typeof value === 'number') {
        return isNaN(value) ? defaultValue : value;
    }

    if (typeof value === 'bigint') {
        return Number(value);
    }

    if (typeof value === 'string') {
        const parsed = parseFloat(value);
        return isNaN(parsed) ? defaultValue : parsed;
    }

    return defaultValue;
}