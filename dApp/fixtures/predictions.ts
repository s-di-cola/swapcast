/**
 * Prediction Generation
 *
 * Creates predictions for markets
 */

import { type Address, formatEther, parseEther, createPublicClient, http } from 'viem';
import { anvil } from 'viem/chains';
import { CONTRACT_ADDRESSES } from './utils/wallets';
import { getPredictionManager } from '../src/generated/types/PredictionManager';
import chalk from 'chalk';
import { type MarketCreationResult } from './markets';

// Constants for prediction outcomes
const OUTCOME_BEARISH = 0;
const OUTCOME_BULLISH = 1;

/**
 * Generates a random boolean value
 */
function getRandomBoolean(): boolean {
  return Math.random() > 0.5;
}

/**
 * Generates a random stake amount that meets minimum requirements
 */
async function getRandomStakeAmount(userAddress: Address, minStakeAmount: bigint): Promise<bigint> {
  // Create a public client for reading from the blockchain
  const publicClient = createPublicClient({
    chain: anvil,
    transport: http(anvil.rpcUrls.default.http[0])
  });
  
  // Get user's ETH balance
  const balance = await publicClient.getBalance({ address: userAddress });
  
  // Make sure the amount is at least the minimum stake amount
  // but not more than 10% of the user's balance
  const maxAmount = balance / 10n;
  const baseAmount = minStakeAmount * 2n;
  
  // Use the larger of the two as our base
  const effectiveBase = baseAmount > minStakeAmount ? baseAmount : minStakeAmount;
  
  // Generate a random amount between effectiveBase and maxAmount
  // but ensure it's at least the minimum stake amount
  const randomFactor = BigInt(Math.floor(Math.random() * 5) + 1); // 1-5x multiplier
  const amount = effectiveBase * randomFactor;
  
  // Cap at maxAmount to ensure user has enough funds
  return amount > maxAmount ? maxAmount : amount;
}

/**
 * Generates predictions for a market
 */
export async function generatePredictions(
  market: MarketCreationResult,
  userAccounts: any[],
  count: number
): Promise<number> {
  console.log(chalk.yellow(`Generating ${count} predictions for market ${market.id} (${market.name})`));
  
  // Shuffle user accounts to randomize which users make predictions
  const shuffledUsers = [...userAccounts].sort(() => Math.random() - 0.5);
  
  // Get the PredictionManager contract
  const predictionManager = getPredictionManager({
    address: CONTRACT_ADDRESSES.PREDICTION_MANAGER as Address,
    chain: anvil,
    transport: http(anvil.rpcUrls.default.http[0])
  });
  
  // Verify market exists before generating predictions
  try {
    console.log(chalk.blue(`Verifying market ${market.id} exists...`));
    
    // Convert string marketId to bigint if it's not already
    const marketIdBigInt = typeof market.id === 'string' && market.id.startsWith('0x') 
      ? BigInt(market.id) 
      : BigInt(market.id);
    
    // Check if the market exists by trying to get its pool key
    // If the market doesn't exist, this will throw an error
    try {
      const poolKey = await predictionManager.read.marketIdToPoolKey([marketIdBigInt]);
      console.log(chalk.green(`Market ${market.id} exists with pool key: ${JSON.stringify(poolKey)}`));
    } catch (error) {
      console.log(chalk.red(`Market ${market.id} does not exist! Cannot generate predictions.`));
      return 0;
    }
    
    // Check if the market has expired using the expiration time from the market object
    const currentTimestamp = BigInt(Math.floor(Date.now() / 1000));
    
    if (market.expirationTime <= currentTimestamp) {
      console.log(chalk.red(`Market ${market.id} has expired! Cannot generate predictions.`));
      return 0;
    }
    
    console.log(chalk.green(`Market ${market.id} exists and has not expired. Proceeding with predictions.`));
  } catch (error) {
    console.error(chalk.red(`Error verifying market ${market.id}:`), error);
    return 0;
  }
  
  // Get protocol fee basis points from the contract once for all predictions
  const protocolFeeBasisPoints = await predictionManager.read.protocolFeeBasisPoints();
  console.log(chalk.blue(`Protocol fee basis points: ${protocolFeeBasisPoints}`));
  
  // Get minimum stake amount from the contract
  const minStakeAmount = await predictionManager.read.minStakeAmount();
  console.log(chalk.blue(`Minimum stake amount: ${formatEther(minStakeAmount)} ETH`));
  
  // Track successful predictions
  let successfulPredictions = 0;
  
  // Make sure we don't use more users than we have available
  const actualCount = Math.min(count, shuffledUsers.length);
  console.log(chalk.yellow(`Using ${actualCount} users for predictions (limited by available user accounts)`));
  
  // Process predictions one by one to avoid transaction conflicts
  for (let i = 0; i < actualCount; i++) {
    // Get a unique user account for each prediction to avoid AlreadyPredicted error
    const userAccount = shuffledUsers[i];
    
    // Generate random outcome (0 for Bearish, 1 for Bullish)
    const outcome = getRandomBoolean() ? OUTCOME_BULLISH : OUTCOME_BEARISH;
    
    try {
      // Generate random stake amount that meets minimum requirements
      const convictionStake = await getRandomStakeAmount(userAccount.address as Address, minStakeAmount);
      
      // Calculate protocol fee
      const protocolFee = (convictionStake * BigInt(protocolFeeBasisPoints)) / 10000n;
      
      // Total amount to send = stake + fee
      const totalAmount = convictionStake + protocolFee;
      
      console.log(chalk.blue(`User ${userAccount.address} predicting outcome ${outcome === OUTCOME_BULLISH ? 'Bullish' : 'Bearish'}`));
      console.log(chalk.blue(`Conviction stake: ${formatEther(convictionStake)} ETH`));
      console.log(chalk.blue(`Protocol fee: ${formatEther(protocolFee)} ETH`));
      console.log(chalk.blue(`Total amount: ${formatEther(totalAmount)} ETH`));
      
      // Record the prediction
      const hash = await predictionManager.write.recordPrediction(
        [userAccount.address, BigInt(market.id), outcome, convictionStake],
        {
          account: userAccount.address,
          chain: anvil,
          value: totalAmount
        }
      );
      
      console.log(chalk.green(`Prediction recorded successfully with hash: ${hash}`));
      successfulPredictions++;
    } catch (error: any) {
      console.error(chalk.red(`Failed to record prediction for user ${userAccount.address}:`), error.message);
      
      // Log more detailed error information
      if (error.cause) {
        console.error(chalk.red('Error cause:'), error.cause);
      }
    }
  }
  
  console.log(chalk.green(`Successfully recorded ${successfulPredictions}/${actualCount} predictions for market ${market.id}`));
  return successfulPredictions;
}
