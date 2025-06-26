/**
 * Configuration object for test fixture generation
 * @property PREDICTIONS_PER_MARKET - Base number of predictions per market
 * @property BATCH_SIZE - Number of predictions to process in parallel
 * @property ADMIN_ACCOUNT_INDEX - Index of the admin account in the test wallets
 * @property PREDICTION_COUNT_VARIABILITY - Random variation in prediction counts
 */
export const CONFIG = {
    PREDICTIONS_PER_MARKET: 8,
    BATCH_SIZE: 2,
    ADMIN_ACCOUNT_INDEX: 0,
    PREDICTION_COUNT_VARIABILITY: 3
};
