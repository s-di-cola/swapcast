import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createMarket } from '$lib/contract/contracts';

/**
 * POST handler for creating a new prediction market
 * This endpoint connects to the smart contracts to create a market
 */
export const POST: RequestHandler = async ({ request }) => {
  try {
    // Parse the request body
    const data = await request.json();
    
    // Validate required fields
    const requiredFields = ['marketName', 'tokenA_address', 'tokenB_address', 'predictionMarketType', 'durationHours', 'resolutionSource'];
    const missingFields = requiredFields.filter(field => !data[field]);
    
    if (missingFields.length > 0) {
      return json({
        success: false,
        error: 'Missing required fields',
        details: `The following fields are required: ${missingFields.join(', ')}`
      }, { status: 400 });
    }
    
    // Validate market type specific fields
    if (data.predictionMarketType === 'price_binary' && !data.targetPrice) {
      return json({
        success: false,
        error: 'Invalid market parameters',
        details: 'Target price is required for binary markets'
      }, { status: 400 });
    }
    
    if (data.predictionMarketType === 'price_range' && (!data.lowerBoundPrice || !data.upperBoundPrice)) {
      return json({
        success: false,
        error: 'Invalid market parameters',
        details: 'Lower and upper bound prices are required for range markets'
      }, { status: 400 });
    }
    
    // Parse numeric values
    const durationHours = parseInt(data.durationHours);
    if (isNaN(durationHours) || durationHours <= 0) {
      return json({
        success: false,
        error: 'Invalid market parameters',
        details: 'Duration must be greater than zero'
      }, { status: 400 });
    }
    
    let targetPrice = 0;
    if (data.predictionMarketType === 'price_binary') {
      targetPrice = parseFloat(data.targetPrice);
      if (isNaN(targetPrice) || targetPrice <= 0) {
        return json({
          success: false,
          error: 'Invalid market parameters',
          details: 'Target price must be greater than zero'
        }, { status: 400 });
      }
    } else if (data.predictionMarketType === 'price_range') {
      // For range markets, use the average of lower and upper bounds
      const lowerBound = parseFloat(data.lowerBoundPrice);
      const upperBound = parseFloat(data.upperBoundPrice);
      
      if (isNaN(lowerBound) || isNaN(upperBound) || lowerBound <= 0 || upperBound <= 0) {
        return json({
          success: false,
          error: 'Invalid market parameters',
          details: 'Price bounds must be greater than zero'
        }, { status: 400 });
      }
      
      if (lowerBound >= upperBound) {
        return json({
          success: false,
          error: 'Invalid market parameters',
          details: 'Upper bound must be greater than lower bound'
        }, { status: 400 });
      }
      
      targetPrice = (lowerBound + upperBound) / 2;
    }
    
    // Determine price feed key from token addresses or resolution source
    // This is a simple approach - in production you'd have a more robust mapping
    let priceFeedKey = 'ETH/USD'; // Default
    if (data.resolutionSource.includes('ETH') && data.resolutionSource.includes('USD')) {
      priceFeedKey = 'ETH/USD';
    } else if (data.resolutionSource.includes('BTC') && data.resolutionSource.includes('USD')) {
      priceFeedKey = 'BTC/USD';
    } else if (data.resolutionSource.includes('LINK') && data.resolutionSource.includes('USD')) {
      priceFeedKey = 'LINK/USD';
    } else if (data.resolutionSource.includes('USDC') && data.resolutionSource.includes('USD')) {
      priceFeedKey = 'USDC/USD';
    }
    
    // Create the market
    const result = await createMarket(
      data.marketName,
      durationHours,
      targetPrice,
      priceFeedKey
    );
    
    if (!result.success) {
      return json({
        success: false,
        error: 'Market creation failed',
        details: result.error || 'An unexpected error occurred'
      }, { status: 500 });
    }
    
    // Return success response
    return json({
      success: true,
      marketId: result.marketId,
      txHash: result.txHash,
      message: 'Market created successfully'
    }, { status: 201 });
    
  } catch (error: any) {
    console.error('Error creating market:', error);
    return json({
      success: false,
      error: 'Server error',
      details: error.message || 'An unexpected error occurred while creating the market'
    }, { status: 500 });
  }
};
