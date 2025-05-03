# SwapCast: a Market Intelligence & Prediction Layer for Uniswap v4

SwapCast transforms Uniswap v4 pools into dual-purpose infrastructure: maintaining efficient swap execution while
simultaneously generating valuable market intelligence through incentivized predictions.

This hook enables traders to include market predictions alongside their swaps, with transaction value serving as
conviction weight. By aggregating these signals, SwapCast creates an on-chain wisdom-of-crowds mechanism backed by
genuine financial commitment.

Unlike standalone prediction markets that struggle with liquidity fragmentation, this hook leverages Uniswap's
substantial trading volume to generate high-quality market sentiment data while rewarding accurate predictors.

## 🔍 Key Features

- **Seamless Swap Integration**: Captures prediction data during standard swap execution
- **Conviction Weighting**: Uses actual transaction values to weight market signals
- **Automated Resolution**: Leverages Chainlink Automation for trustless prediction resolution
- **Dual-sided Markets**: Creates balanced markets with initial 60/40 odds ratios
- **Position NFTs**: Issues unique SwapCast NFTs as proof of prediction positions
- **Reward Distribution**: Pull-based mechanism for winners to claim rewards

## 📊 Conviction Weight & Reward Mathematics

### Conviction Weight Calculation

The conviction weight of a prediction is derived from the swap amount, creating a natural alignment between financial
commitment and market signal strength:

1. **Base Weight Calculation**:
   ```
   convictionWeight = swapAmount * convictionFactor
   ```
   Where `convictionFactor` is typically 0.01 (1%)

2. **Effective Market Influence**:
   The effective influence a prediction has on the market is proportional to its conviction weight relative to the total
   weight on that side:
   ```
   marketInfluence = convictionWeight / totalSideWeight
   ```

3. **Market Odds Adjustment**:
   As predictions flow in, the market odds continuously adjust based on the total conviction weights:
   ```
   bullProbability = totalBullWeight / (totalBullWeight + totalBearWeight)
   bearProbability = totalBearWeight / (totalBullWeight + totalBearWeight)
   ```

4. **Logarithmic Scaling (Optional)**:
   For large swaps, we may apply logarithmic scaling to prevent whale manipulation:
   ```
   adjustedWeight = baseWeight * (1 + log10(swapAmount / minimumSwap))
   ```

### Reward Distribution Mathematics

Rewards are calculated using a pari-mutuel betting model with adjustments for protocol fees:

1. **Total Pool Calculation**:
   ```
   totalPool = totalBullWeight + totalBearWeight
   ```

2. **Fee Application**:
   ```
   protocolFee = totalPool * feeRate
   distributablePool = totalPool - protocolFee
   ```
   Where `feeRate` is typically 0.05 (5%)

3. **Winner's Reward**:
   If a trader's prediction is correct, their reward is calculated as:
   ```
   reward = (convictionWeight / totalWinningWeight) * (distributablePool)
   ```

4. **Net Payout**:
   The net payout for a winning trader is:
   ```
   netPayout = convictionWeight + reward - convictionWeight
             = reward
   ```

5. **Example Calculation**:
    - Total Bull Predictions: 1000 USDC
    - Total Bear Predictions: 3000 USDC
    - Protocol Fee: 5%
    - Trader's Bull Position: 100 USDC

   If the Bull outcome is correct:
    - Distributable Pool: (1000 + 3000) * 0.95 = 3800 USDC
    - Trader's Share: (100 / 1000) * 3800 = 380 USDC
    - In addition to their original 100 USDC stake

## 📐 Architecture Documentation

The SwapCast project uses the C4 model for visualizing and documenting software architecture. The C4 model provides a
way to create maps of your code at various levels of detail, similar to how maps of a country can be created at
different levels of zoom. It consists of a hierarchical set of diagrams for describing and communicating software
architecture:

* **Context Diagrams**: High-level view showing how the system fits into the world around it
* **Container Diagrams**: Show the high-level technical building blocks
* **Component Diagrams**: Zoom in and decompose each container into components
* **Sequence Diagrams**: Illustrate how components interact to implement key scenarios

Our complete architecture documentation can be found in the [c4_architecture](docs/c4_architecture) folder.

### 1. SwapCast Hook Contract

**Purpose**: Intercepts Uniswap v4 swap transactions and extracts prediction data.

**Key Functionality**:

- Implements the Uniswap v4 hook interface
- Hooks into the `afterSwap` function in the Uniswap lifecycle
- Extracts prediction parameters from swap transaction data
- Calculates the conviction weight based on swap value
- Creates prediction positions in the Prediction Pool
- Ensures seamless user experience with minimal gas overhead

**State Variables**:

- Reference to the Prediction Pool contract
- Prediction parameters structure (asset, targetPrice, expirationTime, isAbove)

**Key Functions**:

- `afterSwap`: Processes predictions after a swap occurs
- `calculateConvictionWeight`: Determines conviction weight based on swap value

### 2. Prediction Pool Contract

**Purpose**: Manages prediction markets, positions, and NFT issuance.

**Key Functionality**:

- Creates and tracks prediction markets for different asset/price/expiration combinations
- Issues prediction NFTs to traders
- Handles market resolution and reward accounting
- Maintains odds ratios and conviction weight accounting

**State Variables**:

- Markets: Maps marketId to market details (asset, targetPrice, expiration, weights, etc.)
- Positions: Maps positionId to position details (market, side, weight, owner)
- Market hash to marketId mapping for efficiency

**Key Functions**:

- `createPosition`: Creates new position for a trader (called by SwapCast hook)
- `getOrCreateMarket`: Finds or creates a market for a specific asset/price/expiration
- `resolveMarket`: Updates market state when resolved (called by Oracle Resolver)
- `claimReward`: Allows winners to claim their rewards (pull mechanism)

### 3. SwapCast NFT Contract

**Purpose**: Creates and manages NFTs representing prediction positions.

**Key Functionality**:

- Implements ERC721 standard for non-fungible prediction position tokens
- Stores comprehensive prediction metadata on-chain
- Maintains ownership verification for reward claims
- Provides rich metadata for frontend visualization

**NFT Metadata**:

- Asset (e.g., ETH)
- Price target (e.g., $5000)
- Direction (Bull/Bear)
- Expiration date
- Conviction weight (stake)
- Market ID reference
- Creation timestamp

**Key Functions**:

- `mint`: Creates new position NFT with complete prediction metadata
- `burn`: Burns position NFT when rewards are claimed
- `getMetadata`: Retrieves full prediction details from an NFT

### 4. Oracle Resolver Contract

**Purpose**: Resolves prediction outcomes using Chainlink price feeds and automation.

**Key Functionality**:

- Implements Chainlink Automation compatible interface
- Tracks registered markets awaiting resolution
- Resolves markets based on Chainlink price feed data
- Provides fallback manual resolution mechanism

**Chainlink Integration**:

- Uses Chainlink Price Feeds to get accurate asset prices
- Uses Chainlink Automation to automatically check for expired predictions
- Implements the `checkUpkeep` and `performUpkeep` functions for automation

**Key Functions**:

- `registerMarket`: Registers a new market for future resolution
- `checkUpkeep`: Checks if any markets need resolution (called by Chainlink)
- `performUpkeep`: Resolves expired markets (called by Chainlink)
- `manualResolveMarket`: Allows admin to manually resolve edge cases

### 5. Reward Distributor Contract

**Purpose**: Calculates rewards for winning prediction positions.

**Key Functionality**:

- Calculates rewards based on market outcomes and conviction weights
- Implements pull-based reward claiming mechanism
- Manages protocol fee collection
- Burns position NFTs upon claim

**Pull-Based Rewards**:

- Traders must actively claim their rewards
- Requires submission of position NFT for verification
- Burns position NFT upon successful claim
- Transfers reward only after verification

**Key Functions**:

- `calculateReward`: Computes potential reward for a position
- `claimReward`: Processes reward claims via pull mechanism

## 🔄 How It Works

### Prediction Creation Flow

1. A trader makes a swap on Uniswap v4 (e.g., USDC to ETH)
2. The trader includes prediction parameters (e.g., "ETH will reach $5000 by June 30")
3. The trader's conviction weight is calculated based on swap amount
4. The SwapCast Hook captures this data and creates a position in the Prediction Pool
5. The trader receives a SwapCast NFT as proof of their prediction, with all details stored in metadata

### Why NFTs (ERC721) Instead of ERC20 Tokens

Using NFTs for prediction positions provides several advantages:

1. **Rich Metadata**: Each NFT stores complete prediction details (asset, price target, direction, expiration)
2. **Unique Positions**: Each prediction is properly represented as a unique position
3. **Simplified UX**: No need for complex token naming conventions
4. **Visual Representation**: NFTs can be visually represented in wallets and marketplaces
5. **Ownership Verification**: Simplifies the reward claiming process through ownership verification

### Prediction Resolution Flow

1. Chainlink Automation regularly checks for expired predictions
2. When a prediction expires, Chainlink Automation triggers the resolution process
3. The Oracle Resolver fetches the current price from Chainlink Price Feeds
4. The Oracle Resolver determines if the prediction was correct
5. The Reward Distributor calculates rewards based on conviction weights

### Pull-Based Reward Mechanism

1. Winners must actively claim their rewards by calling the `claimReward` function
2. They must own the SwapCast NFT representing their prediction
3. The contract verifies:
    - Market has been resolved
    - Trader owns the position NFT
    - Position matches the winning outcome
4. Position NFT is burned upon successful claim
5. Rewards are transferred to the winner's address

## 📊 Example User Flow

1. **Alice swaps 1000 USDC for ETH**
    - She predicts ETH will exceed $5000 by June 30
    - Her conviction weight is calculated as 10 USDC (1% of swap)
    - She receives ETH (from swap) and a SwapCast NFT with her prediction details

2. **Bob swaps 2000 USDC for ETH**
    - He predicts ETH will NOT exceed $5000 by June 30
    - His conviction weight is calculated as 20 USDC (1% of swap)
    - He receives ETH (from swap) and a SwapCast NFT with his prediction details

3. **June 30 arrives**
    - Chainlink Automation triggers resolution
    - Oracle Resolver checks current ETH price via Chainlink
    - If ETH > $5000, Bull outcome wins; if ETH < $5000, Bear outcome wins

4. **Rewards are claimed**
    - Winners must visit the SwapCast dApp or directly call the contract
    - They must own the SwapCast NFT representing their prediction
    - NFT is burned upon successful claim
    - Rewards are transferred to the winner's address
