import { BigInt, Address } from "@graphprotocol/graph-ts";
import {
  PredictionManager,
  MarketCreated,
  StakeRecorded,
  MarketResolved,
  RewardClaimed,
  MarketExpired,
  FeePaid,
  FeeConfigurationChanged,
  MinStakeAmountChanged
} from "../generated/PredictionManager/PredictionManager";
import { Market, Prediction, User, MarketResolution, GlobalStat } from "../generated/schema";

// Helper function to load or create GlobalStat
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

// Helper function to load or create User
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
  
  // Get market details from the contract
  let predictionManager = PredictionManager.bind(event.address);
  
  // Set default values since we can't easily get all market details
  market.expirationTimestamp = BigInt.fromI32(0); // Will be updated later if available
  market.description = "Market #" + event.params.marketId.toString();
  market.isResolved = false;
  market.totalStakedOutcome0 = BigInt.fromI32(0);
  market.totalStakedOutcome1 = BigInt.fromI32(0);
  
  // Try to get oracle details if available
  let oracleResolverAddress = predictionManager.oracleResolverAddress();
  
  market.save();
  
  // Update global stats
  let stats = getGlobalStats();
  stats.totalMarkets = stats.totalMarkets.plus(BigInt.fromI32(1));
  stats.save();
}

export function handlePredictionRecorded(event: StakeRecorded): void {
  let predictionId = event.params.marketId.toString() + "-" + event.params.user.toHexString() + "-" + event.params.outcome.toString();
  let prediction = new Prediction(predictionId);
  
  prediction.market = event.params.marketId.toString();
  prediction.user = event.params.user.toHexString();
  prediction.outcome = event.params.outcome;
  prediction.amount = event.params.stakeAmount;
  prediction.timestamp = event.block.timestamp;
  
  // Get the token ID from the prediction manager if available
  let predictionManager = PredictionManager.bind(event.address);
  // We can't easily get the token ID from the event, so we'll leave it null for now
  
  prediction.claimed = false;
  
  prediction.save();
  
  // Update market stats
  let market = Market.load(event.params.marketId.toString());
  if (market != null) {
    if (event.params.outcome == 0) {
      market.totalStakedOutcome0 = market.totalStakedOutcome0.plus(event.params.stakeAmount);
    } else if (event.params.outcome == 1) {
      market.totalStakedOutcome1 = market.totalStakedOutcome1.plus(event.params.stakeAmount);
    }
    market.save();
  }
  
  // Update user stats
  let user = getOrCreateUser(event.params.user.toHexString());
  user.totalStaked = user.totalStaked.plus(event.params.stakeAmount);
  user.save();
  
  // Update global stats
  let stats = getGlobalStats();
  stats.totalPredictions = stats.totalPredictions.plus(BigInt.fromI32(1));
  stats.totalStaked = stats.totalStaked.plus(event.params.stakeAmount);
  stats.save();
}

export function handleMarketResolved(event: MarketResolved): void {
  let marketId = event.params.marketId.toString();
  let market = Market.load(marketId);
  
  if (market != null) {
    market.isResolved = true;
    market.winningOutcome = event.params.winningOutcome;
    market.finalPrice = event.params.price;
    market.save();
    
    // Create market resolution entity
    let resolution = new MarketResolution(marketId);
    resolution.market = marketId;
    resolution.winningOutcome = event.params.winningOutcome;
    resolution.finalPrice = event.params.price;
    resolution.resolutionTimestamp = event.block.timestamp;
    resolution.save();
  }
}

export function handleRewardClaimed(event: RewardClaimed): void {
  // We need to get the market ID from the token ID
  // For now, we'll use a workaround to find the prediction by user and token ID
  let userAddress = event.params.user.toHexString();
  
  // Get all predictions for this user
  let predictionManager = PredictionManager.bind(event.address);
  
  // Since we can't easily get the market ID from the event, we'll have to update our approach
  // For now, we'll just record the claim based on the user and reward amount
  
  // Update user stats
  let user = getOrCreateUser(userAddress);
  user.totalClaimed = user.totalClaimed.plus(event.params.rewardAmount);
  user.save();
  
  // Update global stats
  let stats = getGlobalStats();
  stats.totalClaimed = stats.totalClaimed.plus(event.params.rewardAmount);
  stats.save();
}

export function handleMarketExpired(event: MarketExpired): void {
  let marketId = event.params.marketId.toString();
  let market = Market.load(marketId);
  
  if (market != null) {
    // Mark the market as expired but not yet resolved
    market.expirationTimestamp = event.params.expirationTime;
    market.save();
  }
}

export function handleFeePaid(event: FeePaid): void {
  // Track fees paid for analytics purposes
  let marketId = event.params.marketId.toString();
  let userAddress = event.params.user.toHexString();
  
  // Update global stats for fees
  let stats = getGlobalStats();
  stats.totalStaked = stats.totalStaked.plus(event.params.feeAmount);
  stats.save();
}

export function handleFeeConfigurationChanged(event: FeeConfigurationChanged): void {
  // This is a protocol-level event, so we don't need to update any specific entity
  // But we could track it for analytics if needed
}

export function handleMinStakeAmountChanged(event: MinStakeAmountChanged): void {
  // This is a protocol-level event, so we don't need to update any specific entity
  // But we could track it for analytics if needed
}
