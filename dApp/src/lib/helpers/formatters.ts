/**
 * Utility functions for formatting values in the UI
 */

/**
 * Formats a number as currency with $ symbol and 2 decimal places by default
 * @param value - The number to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted currency string
 */
export function formatCurrency(value: number | string | undefined | null, decimals: number = 2): string {
  if (value === undefined || value === null) return '$0.00';
  
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(numValue)) return '$0.00';
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(numValue);
}

/**
 * Formats a number with the specified number of decimal places
 * @param value - The number to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted number string
 */
export function formatNumber(value: number | undefined | null, decimals: number = 2): string {
  if (value === undefined || value === null) return '0';
  
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

/**
 * Formats an Ethereum value from wei to ETH with the specified number of decimal places
 * @param weiValue - The wei value as string, number, or bigint
 * @param decimals - Number of decimal places (default: 4)
 * @returns Formatted ETH value
 */
export function formatEther(weiValue: string | number | bigint | undefined | null, decimals: number = 4): string {
  if (weiValue === undefined || weiValue === null) return '0';
  
  // Convert to number and divide by 10^18 (wei to ETH)
  const ethValue = Number(weiValue) / 1e18;
  
  return formatNumber(ethValue, decimals);
}

/**
 * Formats a percentage value with the specified number of decimal places
 * @param value - The percentage value (0-100)
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted percentage string with % symbol
 */
export function formatPercentage(value: number | undefined | null, decimals: number = 1): string {
  if (value === undefined || value === null) return '0%';
  
  return `${formatNumber(value, decimals)}%`;
}

/**
 * Formats an address to show only the first and last few characters
 * @param address - The address to format
 * @param chars - Number of characters to show at start and end (default: 6)
 * @returns Formatted address string
 */
export function formatAddress(address: string | undefined | null, chars: number = 6): string {
  if (!address) return '';
  
  if (address.length <= chars * 2) return address;
  
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

/**
 * Formats a timestamp to a human-readable date string
 * @param timestamp - Unix timestamp in seconds
 * @param includeTime - Whether to include time in the output (default: false)
 * @returns Formatted date string
 */
export function formatDate(timestamp: number | string | undefined | null, includeTime: boolean = false): string {
  if (!timestamp) return '';
  
  const date = new Date(Number(timestamp) * 1000);
  
  if (includeTime) {
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
  
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Formats a relative time string (e.g., "2 hours ago", "in 3 days")
 * @param timestamp - Unix timestamp in seconds
 * @returns Formatted relative time string
 */
export function formatRelativeTime(timestamp: number | string | undefined | null): string {
  if (!timestamp) return '';
  
  const now = Date.now() / 1000;
  const diff = Number(timestamp) - now;
  const absDiff = Math.abs(diff);
  
  const units = [
    { name: 'year', seconds: 31536000 },
    { name: 'month', seconds: 2592000 },
    { name: 'week', seconds: 604800 },
    { name: 'day', seconds: 86400 },
    { name: 'hour', seconds: 3600 },
    { name: 'minute', seconds: 60 },
    { name: 'second', seconds: 1 }
  ];
  
  for (const unit of units) {
    const value = Math.floor(absDiff / unit.seconds);
    if (value >= 1) {
      const plural = value === 1 ? '' : 's';
      return diff < 0 
        ? `${value} ${unit.name}${plural} ago`
        : `in ${value} ${unit.name}${plural}`;
    }
  }
  
  return 'just now';
}

/**
 * Formats a large number with K, M, B suffixes
 * @param value - The number to format
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted number string with suffix
 */
export function formatCompactNumber(value: number | undefined | null, decimals: number = 1): string {
  if (value === undefined || value === null) return '0';
  
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  
  if (absValue >= 1e9) {
    return `${sign}${formatNumber(absValue / 1e9, decimals)}B`;
  } else if (absValue >= 1e6) {
    return `${sign}${formatNumber(absValue / 1e6, decimals)}M`;
  } else if (absValue >= 1e3) {
    return `${sign}${formatNumber(absValue / 1e3, decimals)}K`;
  }
  
  return `${sign}${formatNumber(absValue, decimals)}`;
}
