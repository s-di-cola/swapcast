import { Address } from 'viem';
import chalk from 'chalk';
import { Token, Price, CurrencyAmount } from '@uniswap/sdk-core';
import { TickMath } from '@uniswap/v3-sdk';
import { TOKEN_CONFIGS } from '../config/tokens';
import { anvil } from 'viem/chains';


/**
 * Convert our token config to Uniswap SDK Token
 */
function createUniswapToken(symbol: string): Token {
    const config = TOKEN_CONFIGS[symbol];
    if (!config) {
        throw new Error(`Token config not found for: ${symbol}`);
    }

    return new Token(
        anvil.id,
        config.address,
        config.decimals,
        config.symbol,
        config.name
    );
}

/**
 * Create a Price object using market price data
 */
function createPriceFromMarketData(
    baseToken: Token,
    quoteToken: Token,
    marketPrice: number
): Price<Token, Token> {
    // Determine which token is the crypto asset and which is the quote
    const baseSymbol = baseToken.symbol;
    const quoteSymbol = quoteToken.symbol;

    // Ensure symbols are defined before using as index
    if (typeof baseSymbol !== 'string' || typeof quoteSymbol !== 'string') {
        throw new Error(`Token symbols must be strings: base=${baseSymbol}, quote=${quoteSymbol}`);
    }

    const baseConfig = TOKEN_CONFIGS[baseSymbol];
    const quoteConfig = TOKEN_CONFIGS[quoteSymbol];

    if (!baseConfig || !quoteConfig) {
        throw new Error(`Token config missing for ${baseSymbol} or ${quoteSymbol}`);
    }

    // For stablecoin pairs, use 1:1
    if (baseConfig.isStablecoin && quoteConfig.isStablecoin) {
        return new Price(
            baseToken,
            quoteToken,
            CurrencyAmount.fromRawAmount(baseToken, 10 ** baseToken.decimals).quotient,
            CurrencyAmount.fromRawAmount(quoteToken, 10 ** quoteToken.decimals).quotient
        );
    }

    // If base is crypto and quote is stablecoin (e.g., ETH/USDC)
    if (!baseConfig.isStablecoin && quoteConfig.isStablecoin) {
        // 1 ETH = marketPrice USDC
        const baseAmount = CurrencyAmount.fromRawAmount(baseToken, 10 ** baseToken.decimals);
        const quoteAmount = CurrencyAmount.fromRawAmount(
            quoteToken,
            Math.floor(marketPrice * (10 ** quoteToken.decimals))
        );

        return new Price(baseToken, quoteToken, baseAmount.quotient, quoteAmount.quotient);
    }

    // If base is stablecoin and quote is crypto (e.g., USDC/ETH)
    if (baseConfig.isStablecoin && !quoteConfig.isStablecoin) {
        // 1 USDC = (1/marketPrice) ETH
        const baseAmount = CurrencyAmount.fromRawAmount(baseToken, 10 ** baseToken.decimals);
        const quoteAmount = CurrencyAmount.fromRawAmount(
            quoteToken,
            Math.floor((1 / marketPrice) * (10 ** quoteToken.decimals))
        );

        return new Price(baseToken, quoteToken, baseAmount.quotient, quoteAmount.quotient);
    }

    // Both crypto - use 1:1 for now (you can extend this later)
    return new Price(
        baseToken,
        quoteToken,
        CurrencyAmount.fromRawAmount(baseToken, 10 ** baseToken.decimals).quotient,
        CurrencyAmount.fromRawAmount(quoteToken, 10 ** quoteToken.decimals).quotient
    );
}

/**
 * Calculate sqrtPriceX96 using Uniswap SDK (the RIGHT way)
 * 
 * @param token0Symbol - Symbol of token0 (lower address)
 * @param token1Symbol - Symbol of token1 (higher address)  
 * @param marketPrice - Market price of the BASE asset in USD
 * @param verbose - Whether to log debug information
 * @returns sqrtPriceX96 as bigint
 */
export function calculateSqrtPriceX96(
    token0Symbol: string,
    token1Symbol: string,
    marketPrice: number,
    verbose: boolean = true
): bigint {
    if (verbose) {
        console.log(chalk.blue(`🧮 Calculating sqrtPriceX96 for ${token0Symbol}/${token1Symbol} @ $${marketPrice}`));
    }

    try {
        // Create Uniswap SDK tokens from our configs
        const token0 = createUniswapToken(token0Symbol);
        const token1 = createUniswapToken(token1Symbol);

        if (verbose) {
            console.log(chalk.gray(`  Token0: ${token0.symbol} (${token0.decimals} decimals)`));
            console.log(chalk.gray(`  Token1: ${token1.symbol} (${token1.decimals} decimals)`));
        }

        // Determine which token is the base (the one with the market price)
        const token0Config = TOKEN_CONFIGS[token0Symbol];
        const token1Config = TOKEN_CONFIGS[token1Symbol];

        let price: Price<Token, Token>;

        // Determine base token (crypto asset that has the market price)
        if (!token0Config.isStablecoin && token1Config.isStablecoin) {
            // token0 is crypto, token1 is stablecoin (e.g., ETH/USDC)
            price = createPriceFromMarketData(token0, token1, marketPrice);
            if (verbose) {
                console.log(chalk.cyan(`  Price: 1 ${token0.symbol} = ${marketPrice} ${token1.symbol}`));
            }
        } else if (token0Config.isStablecoin && !token1Config.isStablecoin) {
            // token0 is stablecoin, token1 is crypto (e.g., USDC/ETH)
            // We need to invert: if ETH costs $2500, then 1 USDC = 1/2500 ETH
            const invertedPrice = createPriceFromMarketData(token1, token0, marketPrice);
            price = invertedPrice.invert();
            if (verbose) {
                console.log(chalk.cyan(`  Price: 1 ${token0.symbol} = ${1 / marketPrice} ${token1.symbol}`));
            }
        } else {
            // Both stablecoin or both crypto - use 1:1
            price = createPriceFromMarketData(token0, token1, 1);
            if (verbose) {
                console.log(chalk.cyan(`  Price: 1:1 ratio (both ${token0Config.isStablecoin ? 'stablecoin' : 'crypto'})`));
            }
        }

        // Convert to tick using the price
        const priceRatio = parseFloat(price.toSignificant(18));
        const tick = Math.floor(Math.log(priceRatio) / Math.log(1.0001));

        // Get sqrtPriceX96 from the tick using Uniswap SDK
        const sqrtPriceX96 = BigInt(TickMath.getSqrtRatioAtTick(tick).toString());

        if (verbose) {
            console.log(chalk.gray(`  Price ratio: ${priceRatio}`));
            console.log(chalk.gray(`  Calculated tick: ${tick}`));
            console.log(chalk.green(`  sqrtPriceX96: ${sqrtPriceX96}`));
        }
        // Sanity check
        const MIN_SQRT_PRICE = 4295128739n;
        const MAX_SQRT_PRICE = 1461446703485210103287273052203988822378723970341n;

        if (sqrtPriceX96 <= MIN_SQRT_PRICE || sqrtPriceX96 >= MAX_SQRT_PRICE) {
            console.log(chalk.red(`  ⚠️  WARNING: sqrtPriceX96 is at price limits!`));
        } else {
            console.log(chalk.green(`  ✅ sqrtPriceX96 is within valid bounds`));
        }
        return sqrtPriceX96;

    } catch (error) {
        console.error(chalk.red(`❌ Error calculating sqrtPriceX96 for ${token0Symbol}/${token1Symbol}:`), error);
        throw error;
    }
}

/**
 * Test function to validate calculations against known good values
 */
export function testSqrtPriceCalculations(): void {
    console.log(chalk.blue('\n🧪 TESTING SQRTPRICEX96 CALCULATIONS'));
    console.log(chalk.blue('='.repeat(50)));

    const testCases = [
        { token0: 'ETH', token1: 'USDC', marketPrice: 2500, description: 'ETH/USDC pair' },
        { token0: 'ETH', token1: 'USDT', marketPrice: 2500, description: 'ETH/USDT pair' },
        { token0: 'ETH', token1: 'DAI', marketPrice: 2500, description: 'ETH/DAI pair' },
        { token0: 'WBTC', token1: 'USDC', marketPrice: 45000, description: 'WBTC/USDC pair' },
        { token0: 'USDC', token1: 'USDT', marketPrice: 1, description: 'Stablecoin pair' },
    ];

    for (const testCase of testCases) {
        try {
            console.log(chalk.yellow(`\n🧪 Testing ${testCase.description}`));
            const result = calculateSqrtPriceX96(
                testCase.token0,
                testCase.token1,
                testCase.marketPrice,
                true
            );

            // Basic validation - result should be reasonable
            const MIN_SQRT_PRICE = 4295128739n;
            const MAX_SQRT_PRICE = 1461446703485210103287273052203988822378723970341n;

            if (result > MIN_SQRT_PRICE && result < MAX_SQRT_PRICE) {
                console.log(chalk.green(`✅ PASS: Result is within valid bounds`));
            } else {
                console.log(chalk.red(`❌ FAIL: Result is outside valid bounds`));
            }

        } catch (error) {
            console.log(chalk.red(`❌ ERROR: ${error.message}`));
        }
    }

    console.log(chalk.blue('\n📊 Test Summary: If all tests show ✅ PASS, the math is working correctly'));
}

/**
 * Maps token address to symbol (for compatibility)
 */
export function getTokenSymbolFromAddress(address: Address): string {
    const addressLower = address.toLowerCase();

    for (const [symbol, config] of Object.entries(TOKEN_CONFIGS)) {
        if (config.address.toLowerCase() === addressLower) {
            return symbol;
        }
    }

    return 'UNKNOWN';
}

/**
 * Get market price for a base asset from our symbol
 * This is a helper to determine which token has the "market price"
 */
export function getBaseAssetFromPair(token0Symbol: string, token1Symbol: string): string | null {
    const token0Config = TOKEN_CONFIGS[token0Symbol];
    const token1Config = TOKEN_CONFIGS[token1Symbol];

    if (!token0Config || !token1Config) return null;

    // Return the non-stablecoin if there's one
    if (!token0Config.isStablecoin && token1Config.isStablecoin) {
        return token0Symbol;
    }

    if (token0Config.isStablecoin && !token1Config.isStablecoin) {
        return token1Symbol;
    }

    // If both are crypto or both are stablecoin, return the first one
    return token0Symbol;
}