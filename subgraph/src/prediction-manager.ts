import { BigInt, log } from "@graphprotocol/graph-ts";
import {
  FeeConfigurationChanged,
  FeePaid,
  MarketCreated,
  MarketExpired,
  MarketResolved,
  MinStakeAmountChanged,
  RewardClaimed,
  StakeRecorded
} from "../generated/PredictionManager/PredictionManager";
import { GlobalStat, Market, MarketResolution, Prediction, User } from "../generated/schema";

/**
 * Loads or creates the global stats entity
 * @returns The global stats entity
 */
function getGlobalStats(): GlobalStat {
  let stats = GlobalStat.load("global");

  if (stats == null) {
    stats = new GlobalStat("global");
    stats.totalMarkets = BigInt.fromI32(0);
    stats.totalPredictions = BigInt.fromI32(0);
    stats.totalStaked = BigInt.fromI32(0);
    stats.totalUsers = BigInt.fromI32(0);
    stats.totalClaimed = BigInt.fromI32(0);
    stats.totalProtocolFees = BigInt.fromI32(0);
    stats.save();
  }

  return stats;
}

/**
 * Loads or creates a user entity
 * @param address - The user's address
 * @returns The user entity
 */
function getOrCreateUser(address: string): User {
  let user = User.load(address);

  if (user == null) {
    user = new User(address);
    user.address = address;
    user.totalStaked = BigInt.fromI32(0);
    user.totalWon = BigInt.fromI32(0);
    user.totalClaimed = BigInt.fromI32(0);
    user.totalFeesPaid = BigInt.fromI32(0);
    user.save();

    // Update global stats
    let stats = getGlobalStats();
    stats.totalUsers = stats.totalUsers.plus(BigInt.fromI32(1));
    stats.save();
  }

  return user;
}

export function handleMarketCreated(event: MarketCreated): void {
  let marketId = event.params.marketId.toString();
  let market = new Market(marketId);

  market.marketId = event.params.marketId;
  market.name = event.params.name;
  market.assetSymbol = event.params.assetSymbol;
  market.creationTimestamp = event.block.timestamp;
  market.expirationTimestamp = event.params.expirationTime;
  market.priceAggregator = event.params.priceAggregator;
  market.priceThreshold = event.params.priceThreshold;
  market.isResolved = false;
  market.totalStakedOutcome0 = BigInt.fromI32(0);
  market.totalStakedOutcome1 = BigInt.fromI32(0);
  market.totalProtocolFees = BigInt.fromI32(0);

  market.save();

  // Update global stats
  let stats = getGlobalStats();
  stats.totalMarkets = stats.totalMarkets.plus(BigInt.fromI32(1));
  stats.save();

  log.info("Market created: ID {}, Name: {}", [marketId, event.params.name]);
}

/**
 * Handles the StakeRecorded event when a user makes a prediction
 * @param event - The StakeRecorded event containing prediction details
 */
export function handlePredictionRecorded(event: StakeRecorded): void {
  const marketId = event.params.marketId.toString();
  const userAddress = event.params.user.toHexString();
  const outcome = event.params.outcome;
  const amount = event.params.amount;
  const tokenId = event.params.tokenId;

  // Load the market - it MUST exist
  let market = Market.load(marketId);

  if (!market) {
    log.error(
        'CRITICAL: Prediction recorded for non-existent market! MarketID: {}, User: {}, TX: {}, Block: {}',
        [marketId, userAddress, event.transaction.hash.toHexString(), event.block.number.toString()]
    );

    // This should not happen in a properly functioning system
    // The contract should prevent predictions on non-existent markets
    // Don't create a fake market - this would hide the real issue
    return;
  }

  // Validate market is in a valid state for predictions
  if (market.isResolved) {
    log.warning('Prediction attempted on resolved market: {}, TX: {}', [
      marketId,
      event.transaction.hash.toHexString()
    ]);
    return;
  }

  // Check if market has expired (though contract should prevent this)
  if (market.expirationTimestamp.gt(BigInt.fromI32(0)) &&
      event.block.timestamp.ge(market.expirationTimestamp)) {
    log.warning('Prediction attempted on expired market: {}, TX: {}', [
      marketId,
      event.transaction.hash.toHexString()
    ]);
    return;
  }

  // Create prediction with tokenId as the primary key (since tokenId is unique)
  const predictionId = tokenId.toString();
  const prediction = new Prediction(predictionId);

  prediction.market = marketId;
  prediction.user = userAddress;
  prediction.outcome = outcome;
  prediction.amount = amount;
  prediction.tokenId = tokenId;
  prediction.timestamp = event.block.timestamp;
  prediction.claimed = false;

  prediction.save();

  // Update market stats
  if (event.params.outcome == 0) {
    market.totalStakedOutcome0 = market.totalStakedOutcome0.plus(event.params.amount);
  } else if (event.params.outcome == 1) {
    market.totalStakedOutcome1 = market.totalStakedOutcome1.plus(event.params.amount);
  }
  market.save();

  // Update user stats
  let user = getOrCreateUser(event.params.user.toHexString());
  user.totalStaked = user.totalStaked.plus(event.params.amount);
  user.save();

  // Update global stats
  let stats = getGlobalStats();
  stats.totalPredictions = stats.totalPredictions.plus(BigInt.fromI32(1));
  stats.totalStaked = stats.totalStaked.plus(event.params.amount);
  stats.save();

  log.info('Prediction recorded - Market: {}, User: {}, TokenId: {}, Amount: {}', [
    marketId,
    userAddress,
    tokenId.toString(),
    amount.toString()
  ]);
}

/**
 * Handles the MarketResolved event when a market is resolved with a final outcome
 * @param event - The MarketResolved event containing resolution details
 */
export function handleMarketResolved(event: MarketResolved): void {
  const marketId = event.params.marketId.toString();
  const winningOutcome = event.params.winningOutcome;
  const finalPrice = event.params.price;

  // Validate the market exists
  const market = Market.load(marketId);
  if (!market) {
    log.error('Market not found when resolving: {}', [marketId]);
    return;
  }

  // Update market resolution status
  market.isResolved = true;
  market.winningOutcome = winningOutcome;
  market.finalPrice = finalPrice;
  market.save();

  // Create market resolution entity
  const resolution = new MarketResolution(marketId);
  resolution.market = marketId;
  resolution.winningOutcome = winningOutcome;
  resolution.finalPrice = finalPrice;
  resolution.resolutionTimestamp = event.block.timestamp;
  resolution.save();

  // Calculate total staked on winning and losing outcomes
  const totalStakedWinning = winningOutcome === 0
      ? market.totalStakedOutcome0
      : market.totalStakedOutcome1;

  const totalStakedLosing = winningOutcome === 0
      ? market.totalStakedOutcome1
      : market.totalStakedOutcome0;

  // Skip reward calculation if no one staked on the winning outcome
  if (totalStakedWinning.isZero()) {
    log.warning('No winning stakers for market: {}', [marketId]);
    return;
  }

  // Load all predictions for this market
  let predictions = market.predictions.load();

  if (!predictions || predictions.length === 0) {
    log.warning("No predictions found for market: {}", [marketId]);
    return;
  }

  // Process each prediction to calculate rewards
  for (let i = 0; i < predictions.length; i++) {
    let prediction = predictions[i];

    if (!prediction) {
      log.warning("Prediction at index {} not found for market {}", [i.toString(), marketId]);
      continue;
    }

    // Only process predictions that match the winning outcome
    if (prediction.outcome === event.params.winningOutcome) {
      // Reward = (prediction amount / total staked on winning outcome) * total staked on losing outcome
      // Plus the original stake amount
      let reward = prediction.amount
          .times(totalStakedLosing)
          .div(totalStakedWinning)
          .plus(prediction.amount);

      prediction.reward = reward;
      prediction.save();

      log.info("Set reward for prediction {}: {}", [prediction.id, reward.toString()]);
    }
  }

  log.info('Market resolved - ID: {}, Winning outcome: {}, Final price: {}', [
    marketId,
    winningOutcome.toString(),
    finalPrice.toString()
  ]);
}

export function handleRewardClaimed(event: RewardClaimed): void {
  const userAddress = event.params.user.toHexString();
  const tokenId = event.params.tokenId;
  const rewardAmount = event.params.rewardAmount;

  // Find prediction directly by tokenId (which is now the prediction ID)
  const prediction = Prediction.load(tokenId.toString());

  if (!prediction) {
    log.error('Prediction not found for tokenId: {}', [tokenId.toString()]);
    return;
  }

  // Update prediction status
  prediction.claimed = true;
  prediction.reward = rewardAmount;
  prediction.save();

  // Update user stats
  const user = getOrCreateUser(userAddress);
  user.totalClaimed = user.totalClaimed.plus(rewardAmount);
  user.totalWon = user.totalWon.plus(rewardAmount);
  user.save();

  // Update global stats
  const stats = getGlobalStats();
  stats.totalClaimed = stats.totalClaimed.plus(rewardAmount);
  stats.save();

  log.info('Reward claimed - User: {}, TokenId: {}, Amount: {}, PredictionId: {}', [
    userAddress,
    tokenId.toString(),
    rewardAmount.toString(),
    prediction.id
  ]);
}

/**
 * Handles the MarketExpired event
 * @param event - The MarketExpired event
 */
export function handleMarketExpired(event: MarketExpired): void {
  const marketId = event.params.marketId.toString();
  const market = Market.load(marketId);

  if (!market) {
    log.warning('Market not found when processing expiration: {}', [marketId]);
    return;
  }

  market.expirationTimestamp = event.params.expirationTimestamp;
  market.save();

  log.info('Market expired: {}', [marketId]);
}

/**
 * Handles the FeePaid event when protocol fees are collected
 * @param event - The FeePaid event containing fee details
 */
export function handleFeePaid(event: FeePaid): void {
  const marketId = event.params.marketId.toString();
  const userAddress = event.params.user.toHexString();
  const protocolFee = event.params.protocolFee;

  // Update market fee statistics
  const market = Market.load(marketId);
  if (market) {
    market.totalProtocolFees = market.totalProtocolFees.plus(protocolFee);
    market.save();
    log.debug('Updated protocol fees for market: {}, amount: {}', [marketId, protocolFee.toString()]);
  } else {
    log.warning('Market not found when processing fee payment: {}', [marketId]);
  }

  // Update user's total fees paid
  const user = getOrCreateUser(userAddress);
  user.totalFeesPaid = user.totalFeesPaid.plus(protocolFee);
  user.save();

  // Update global stats
  const stats = getGlobalStats();
  stats.totalProtocolFees = stats.totalProtocolFees.plus(protocolFee);
  stats.save();

  log.debug('Processed fee payment - User: {}, Market: {}, Amount: {}', [
    userAddress,
    marketId,
    protocolFee.toString()
  ]);
}

/**
 * Handles the FeeConfigurationChanged event when protocol fee settings are updated
 * @param event - The FeeConfigurationChanged event
 */
export function handleFeeConfigurationChanged(event: FeeConfigurationChanged): void {
  const newTreasuryAddress = event.params.newTreasuryAddress.toHexString();
  const newFeeBasisPoints = event.params.newFeeBasisPoints;

  log.info('Fee configuration updated - Treasury: {}, Fee: {} bips', [
    newTreasuryAddress,
    newFeeBasisPoints.toString()
  ]);

  // Consider creating a FeeConfiguration entity to track historical changes
}

/**
 * Handles the MinStakeAmountChanged event
 * @param event - The MinStakeAmountChanged event
 */
export function handleMinStakeAmountChanged(event: MinStakeAmountChanged): void {
  log.info('Minimum stake amount changed to: {}', [event.params.newMinStakeAmount.toString()]);

  // Consider creating a ProtocolConfiguration entity to track these changes
}
