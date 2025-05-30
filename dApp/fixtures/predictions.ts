/**
 * Prediction Generation
 *
 * Creates predictions for markets
 */

import { type Address, formatEther, parseEther, createPublicClient, http, encodeFunctionData } from 'viem';
import { anvil } from 'viem/chains';
import { CONTRACT_ADDRESSES, WHALE_ADDRESSES } from './utils/wallets';
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
 * Determines if an address is a whale account
 */
function isWhaleAccount(address: Address): boolean {
  // Check if the address is in the WHALE_ADDRESSES object
  // Convert both to lowercase strings for comparison to avoid type issues
  const addressLower = address.toLowerCase();
  return Object.values(WHALE_ADDRESSES)
    .map(addr => addr.toLowerCase())
    .includes(addressLower as any);
}

/**
 * Generates a random stake amount that meets minimum requirements
 * Whale accounts will make much larger stakes (millions of dollars worth)
 */
async function getRandomStakeAmount(userAddress: Address, minStakeAmount: bigint): Promise<bigint> {
  // Create a public client for reading from the blockchain
  const publicClient = createPublicClient({
    chain: anvil,
    transport: http(anvil.rpcUrls.default.http[0])
  });
  
  // Get user's ETH balance
  const balance = await publicClient.getBalance({ address: userAddress });
  
  // Check if this is a whale account
  const isWhale = isWhaleAccount(userAddress);
  
  if (isWhale) {
    // Whales make massive predictions in the order of millions of dollars
    // Generate between 100-500 ETH for whale accounts (worth millions at current ETH prices)
    const minWhaleEth = 100;
    const maxWhaleEth = 500;
    const randomWhaleEth = minWhaleEth + Math.random() * (maxWhaleEth - minWhaleEth);
    
    // Convert to Wei with precise decimal places
    const whaleAmount = parseEther(randomWhaleEth.toFixed(4));
    console.log(chalk.magenta(`🐋 Whale account ${userAddress} making a massive prediction of ${formatEther(whaleAmount)} ETH!`));
    return whaleAmount;
  } else if (balance >= parseEther("500")) {
    // For regular Anvil accounts with lots of ETH (1000 ETH each), use larger amounts too
    // Generate between 10-50 ETH for regular accounts
    const minRegularEth = 10;
    const maxRegularEth = 50;
    const randomRegularEth = minRegularEth + Math.random() * (maxRegularEth - minRegularEth);
    
    // Convert to Wei with precise decimal places
    const regularAmount = parseEther(randomRegularEth.toFixed(4));
    return regularAmount;
  } else {
    // For accounts with less balance, use more modest amounts
    // Generate between 1-5 ETH
    const minEth = 1;
    const maxEth = 5;
    const randomEth = minEth + Math.random() * (maxEth - minEth);
    
    // Convert to Wei with precise decimal places
    const amount = parseEther(randomEth.toFixed(4));
    
    // Ensure it's at least the minimum stake amount
    if (amount < minStakeAmount) {
      return minStakeAmount * 10n; // 10x minimum if somehow our random amount is too small
    }
    
    return amount;
  }
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
      // Check if this is a regular account or an impersonated whale account
      // For impersonated accounts, we need to use a different approach
      let hash;
      
      // If the account has a privateKey, it's a regular account
      if ('privateKey' in userAccount && userAccount.privateKey) {
        // Regular account - use standard approach
        hash = await predictionManager.write.recordPrediction(
          [userAccount.address, BigInt(market.id), outcome, convictionStake],
          {
            account: userAccount.address,
            chain: anvil,
            value: totalAmount
          }
        );
      } else {
        // This is likely an impersonated account - use a different approach
        // First, create a public client to send the transaction
        const publicClient = createPublicClient({
          chain: anvil,
          transport: http(anvil.rpcUrls.default.http[0])
        });
        
        // Ensure the account is impersonated and has enough funds
        await publicClient.request({
          method: 'anvil_impersonateAccount' as any,
          params: [userAccount.address]
        });
        
        // Check balance and fund if needed
        const balance = await publicClient.getBalance({ address: userAccount.address });
        const requiredBalance = totalAmount + BigInt(1e17); // Add 0.1 ETH for gas
        
        if (balance < requiredBalance) {
          console.log(chalk.yellow(`Whale account ${userAccount.address} has insufficient funds. Adding more ETH...`));
          await publicClient.request({
            method: 'anvil_setBalance' as any,
            params: [userAccount.address, ('0x' + (BigInt(1000) * BigInt(1e18)).toString(16)) as any] // 1000 ETH
          });
          console.log(chalk.green(`Funded whale account ${userAccount.address} with 1000 ETH`));
        }
        
        // Get the contract ABI and function data
        const abi = predictionManager.abi;
        const functionName = 'recordPrediction';
        // Explicitly define the args with correct types
        const args = [
          userAccount.address as `0x${string}`, 
          BigInt(market.id), 
          outcome as number, 
          convictionStake as bigint
        ] as const;
        
        // Encode the function data
        const data = encodeFunctionData({
          abi,
          functionName,
          args
        });
        
        // Try to send the transaction with retry logic
        let attempts = 0;
        const maxAttempts = 3;
        let error;
        
        while (attempts < maxAttempts) {
          try {
            attempts++;
            // Send the transaction directly
            hash = await publicClient.request({
              method: 'eth_sendTransaction' as any,
              params: [{
                from: userAccount.address,
                to: CONTRACT_ADDRESSES.PREDICTION_MANAGER as `0x${string}`,
                data,
                value: `0x${totalAmount.toString(16)}` as `0x${string}`
              }]
            });
            // If successful, break the retry loop
            break;
          } catch (err: any) {
            error = err;
            console.log(chalk.yellow(`Attempt ${attempts}/${maxAttempts} failed for ${userAccount.address}. Retrying...`));
            
            // If this is an insufficient funds error, add more funds and try again
            if (err.message && err.message.includes('Insufficient funds')) {
              console.log(chalk.yellow(`Adding more funds to ${userAccount.address}...`));
              await publicClient.request({
                method: 'anvil_setBalance' as any,
                params: [userAccount.address, ('0x' + (BigInt(2000) * BigInt(1e18)).toString(16)) as any] // 2000 ETH
              });
            }
            
            // Wait a bit before retrying
            if (attempts < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }
        }
        
        // If we've tried all attempts and still failed, throw the error
        if (!hash && error) {
          throw error;
        }
      }
      
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
