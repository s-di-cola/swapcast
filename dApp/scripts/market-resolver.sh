#!/bin/bash

# SwapCast Market Resolver Script
# Automates oracle resolver setup and market resolution

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "🔧 SwapCast Market Resolver"
echo "=========================="

# Function to validate Ethereum address
validate_address() {
    local addr=$1
    if [[ ! "$addr" =~ ^0x[a-fA-F0-9]{40}$ ]]; then
        echo -e "${RED}Error: Invalid Ethereum address format${NC}"
        return 1
    fi
    return 0
}

# Get contract and user addresses
echo -e "\n${BLUE}Configuration Setup${NC}"
echo "Enter the contract and user details:"

# PM Contract
read -p "Enter PredictionManager contract address: " PM_CONTRACT
validate_address "$PM_CONTRACT" || exit 1

# Anvil User
echo -e "\nDefault Anvil addresses:"
echo "0 - 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
echo "1 - 0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
echo "2 - 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"
read -p "Enter Anvil user (0, 1, 2) or full address (or press Enter for 0): " ANVIL_INPUT

# Convert shortcuts to full addresses
case "$ANVIL_INPUT" in
    ""|"0")
        ANVIL_USER="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
        echo "Using Anvil account 0: $ANVIL_USER"
        ;;
    "1")
        ANVIL_USER="0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
        echo "Using Anvil account 1: $ANVIL_USER"
        ;;
    "2")
        ANVIL_USER="0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"
        echo "Using Anvil account 2: $ANVIL_USER"
        ;;
    *)
        ANVIL_USER="$ANVIL_INPUT"
        validate_address "$ANVIL_USER" || exit 1
        echo "Using custom address: $ANVIL_USER"
        ;;
esac

# Function to check if command succeeded
check_success() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Success${NC}"
    else
        echo -e "${RED}❌ Failed${NC}"
        exit 1
    fi
}

# Step 1: Set oracle resolver to anvil user
echo -e "\n${YELLOW}Step 1: Setting oracle resolver address...${NC}"
echo "Contract: $PM_CONTRACT"
echo "Setting oracle resolver to: $ANVIL_USER"

cast send $PM_CONTRACT "setOracleResolverAddress(address)" $ANVIL_USER --unlocked
check_success

# Verify the change
echo "Verifying oracle resolver address..."
CURRENT_RESOLVER=$(cast call $PM_CONTRACT "oracleResolverAddress()")
echo "Current oracle resolver: $CURRENT_RESOLVER"

# Step 2: Get user inputs
echo -e "\n${YELLOW}Step 2: Getting market resolution parameters...${NC}"

# Check market count first
echo "Checking available markets..."
MARKET_COUNT=$(cast call $PM_CONTRACT "getMarketCount()" 2>/dev/null)
if [ $? -eq 0 ]; then
    MARKET_COUNT_DEC=$((MARKET_COUNT))
    echo "Total markets available: $MARKET_COUNT_DEC"
else
    echo -e "${YELLOW}Warning: Could not fetch market count${NC}"
fi

# Market ID
read -p "Enter Market ID: " MARKET_ID
if [[ ! "$MARKET_ID" =~ ^[0-9]+$ ]]; then
    echo -e "${RED}Error: Market ID must be a number${NC}"
    exit 1
fi

# Validate market exists and get its details
echo "Checking market $MARKET_ID..."
MARKET_DETAILS=$(cast call $PM_CONTRACT "getMarketDetails(uint256)" $MARKET_ID 2>/dev/null)
if [ $? -ne 0 ]; then
    echo -e "${RED}Error: Market $MARKET_ID does not exist or is inaccessible${NC}"
    exit 1
fi

# Parse market details (simplified - just check if it's resolved)
echo "Market details fetched successfully"
echo -e "${BLUE}Market $MARKET_ID appears to exist${NC}"

# Outcome (Bullish/Bearish)
echo "Select outcome:"
echo "0 - Bearish"
echo "1 - Bullish"
read -p "Enter outcome (0 or 1): " OUTCOME
if [[ ! "$OUTCOME" =~ ^[01]$ ]]; then
    echo -e "${RED}Error: Outcome must be 0 (Bearish) or 1 (Bullish)${NC}"
    exit 1
fi

# Price
read -p "Enter oracle price: " PRICE
if [[ ! "$PRICE" =~ ^[0-9]+$ ]]; then
    echo -e "${RED}Error: Price must be a number${NC}"
    exit 1
fi

# Step 3: Display summary
echo -e "\n${YELLOW}Step 3: Resolution Summary${NC}"
echo "Market ID: $MARKET_ID"
echo "Outcome: $OUTCOME ($([ $OUTCOME -eq 0 ] && echo "Bearish" || echo "Bullish"))"
echo "Price: $PRICE"

read -p "Proceed with resolution? (y/N): " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
fi

# Step 4: Resolve the market
echo -e "\n${YELLOW}Step 4: Resolving market...${NC}"
echo "Calling resolveMarket($MARKET_ID, $OUTCOME, $PRICE)..."

cast send $PM_CONTRACT "resolveMarket(uint256,uint8,int256)" $MARKET_ID $OUTCOME $PRICE --unlocked
check_success

echo -e "\n${GREEN}🎉 Market $MARKET_ID resolved successfully!${NC}"
echo "Outcome: $([ $OUTCOME -eq 0 ] && echo "Bearish" || echo "Bullish")"
echo "Price: $PRICE"
