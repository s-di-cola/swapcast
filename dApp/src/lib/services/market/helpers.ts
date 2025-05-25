// Uniswap v4 FeeAmount and TickSpacing constants and utility
// See: https://docs.uniswap.org/sdk/v4/reference/constants

export const FeeAmount = {
  LOWEST: 100,
  LOW: 500,
  MEDIUM: 3000,
  HIGH: 10000
} as const;

export const TickSpacing = {
  LOWEST: 1,
  LOW: 10,
  MEDIUM: 60,
  HIGH: 200
} as const;

export function getTickSpacing(fee: number): number {
  switch (fee) {
    case FeeAmount.LOWEST:
      return TickSpacing.LOWEST;
    case FeeAmount.LOW:
      return TickSpacing.LOW;
    case FeeAmount.MEDIUM:
      return TickSpacing.MEDIUM;
    case FeeAmount.HIGH:
      return TickSpacing.HIGH;
    default:
      throw new Error(`Unsupported fee tier: ${fee}`);
  }
}
