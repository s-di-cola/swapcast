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
  market.creationTimestamp = event.block.timestamp;
  
  // Set default values that will be used if we can't get market details
  market.description = "Market #" + event.params.marketId.toString();
  market.expirationTimestamp = BigInt.fromI32(0);
  market.isResolved = false;
  market.totalStakedOutcome0 = BigInt.fromI32(0);
  market.totalStakedOutcome1 = BigInt.fromI32(0);
  
  market.save();
  
  // Update global stats
  let stats = getGlobalStats();
  stats.totalMarkets = stats.totalMarkets.plus(BigInt.fromI32(1));
  stats.save();
  
  log.info("Market created: ID {}", [marketId]);
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
  
  // Load or create the market
  let market = Market.load(marketId);
  
  if (!market) {
    log.warning(
      'Prediction recorded for market not yet indexed. MarketID: {}, User: {}, TX: {}',
      [marketId, userAddress, event.transaction.hash.toHexString()]
    );
    
    // Create a new market with default values
    market = new Market(marketId);
    market.marketId = event.params.marketId;
    market.creationTimestamp = event.block.timestamp;
    market.description = `Market #${marketId}`;
    market.expirationTimestamp = BigInt.fromI32(0);
    market.isResolved = false;
    market.totalStakedOutcome0 = BigInt.fromI32(0);
    market.totalStakedOutcome1 = BigInt.fromI32(0);
    market.totalProtocolFees = BigInt.fromI32(0);
    market.save();
    
    // Update global stats
    const stats = getGlobalStats();
    stats.totalMarkets = stats.totalMarkets.plus(BigInt.fromI32(1));
    stats.save();
    
    log.info('Created new market with ID: {}', [marketId]);
  }
  
  // Create the prediction with reference to the market
  const predictionId = `${marketId}-${userAddress}-${outcome}-${tokenId}`;
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
  // The @derivedFrom field creates a PredictionLoader that we can use
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
}

export function handleRewardClaimed(event: RewardClaimed): void {
  const userAddress = event.params.user.toHexString();
  const tokenId = event.params.tokenId;
  const rewardAmount = event.params.rewardAmount;
  
  // Load the prediction by tokenId
  const predictionId = tokenId.toString();
  const prediction = Prediction.load(predictionId);
  
  if (!prediction) {
    log.warning('Prediction not found for tokenId: {}', [predictionId]);
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
  
  log.info('Reward claimed - user: {}, tokenId: {}, amount: {}', [
    userAddress,
    predictionId,
    rewardAmount.toString()
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
    log.info('Updated protocol fees for market: {}, amount: {}', [marketId, protocolFee.toString()]);
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
  
  log.debug('Processed fee payment - user: {}, market: {}, amount: {}', [
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
  // This is a protocol-level event, so we don't need to update any specific entity
  // But we track it for analytics and logging purposes
  const newFeeBasisPoints = event.params.newFeeBasisPoints;
  
  log.info('Fee configuration updated - new fee: {} bips', [
    newFeeBasisPoints.toString()
  ]);
  
  // In a future version, we might want to track historical fee changes
  // by creating a new entity type for FeeConfigurationHistory
}

/**
 * Handles the MinStakeAmountChanged event
 * @param event - The MinStakeAmountChanged event
 */
export function handleMinStakeAmountChanged(event: MinStakeAmountChanged): void {
  // This is a protocol-level event, no specific entity to update
  log.info('Minimum stake amount changed to: {}', [event.params.newMinStakeAmount.toString()]);
  // But we could track it for analytics if needed
}
