#!/bin/bash

# SwapCast Local Development Setup Script
# This script automates the setup of a local development environment for SwapCast

# Configuration
ANVIL_PORT=8545
SKIP_SUBGRAPH=false  # Set to true to skip subgraph setup
# FORK_RPC_URL is expected from environment
QUIET_MODE=${QUIET_MODE:-true}    # Reduce verbose output
DEPLOYMENT_SUCCESS=false
SUBGRAPH_DEPLOYED=false

# Project paths
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEPLOY_SCRIPT="${PROJECT_ROOT}/scripts/local/Deploy.s.sol"
SUBGRAPH_DIR="${PROJECT_ROOT}/subgraph"
DOCKER_COMPOSE_FILE="${SUBGRAPH_DIR}/docker/docker-compose.yml"
LOG_DIR="${PROJECT_ROOT}/logs"
DAPP_ENV_FILE="${PROJECT_ROOT}/dApp/.env.local"

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Create log directory
mkdir -p "$LOG_DIR"

#######################################
# UTILITY FUNCTIONS
#######################################

# Logging functions
log_info() { echo -e "${BLUE}[INFO] $1${NC}" | tee -a "$LOG_DIR/setup.log"; }
log_success() { echo -e "${GREEN}[SUCCESS] $1${NC}" | tee -a "$LOG_DIR/setup.log"; }
log_warning() { echo -e "${YELLOW}[WARNING] $1${NC}" | tee -a "$LOG_DIR/setup.log"; }
log_error() { echo -e "${RED}[ERROR] $1${NC}" | tee -a "$LOG_DIR/setup.log"; }

# Check if a command exists
command_exists() { command -v "$1" >/dev/null 2>&1; }

# Clean up resources and exit
cleanup_and_exit() {
  local exit_code=$1
  local message=$2
  
  log_info "Cleaning up resources..."
  "${PROJECT_ROOT}/scripts/local/stop.sh" > /dev/null 2>&1
  
  if [ -n "$message" ]; then
    log_error "$message"
  fi
  
  exit $exit_code
}

#######################################
# CORE FUNCTIONS
#######################################

# Check prerequisites
check_prerequisites() {
  log_info "Checking prerequisites..."

  # Check for Forge/Anvil
  if ! command_exists forge || ! command_exists anvil; then
    log_error "Foundry (forge/anvil) is not installed"
    return 1
  fi

  # Ensure contracts are built
  if [ ! -d "$PROJECT_ROOT/out" ] || [ -z "$(ls -A "$PROJECT_ROOT/out" 2>/dev/null)" ]; then
    log_info "Building contracts..."
    (cd "$PROJECT_ROOT" && forge build) || return 1
    log_success "Contracts built successfully"
  fi

  # Check for Docker and Docker Compose
  if [ "$SKIP_SUBGRAPH" = false ]; then
    if ! command_exists docker || ! docker info > /dev/null 2>&1; then
      log_warning "Docker is not running or not installed"
      if [ -t 0 ]; then # Only ask if running interactively
        read -r -p "Continue without subgraph? (y/n): " response
        if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
          SKIP_SUBGRAPH=true
        else
          return 1
        fi
      else
        SKIP_SUBGRAPH=true
      fi
    fi
  fi

  # Check for Node.js and npm
  if ! command_exists node || ! command_exists npm; then
    log_error "Node.js or npm is not installed"
    return 1
  fi

  # Check for Graph CLI
  if [ "$SKIP_SUBGRAPH" = false ] && ! command_exists graph; then
    log_warning "Installing Graph CLI..."
    npm install -g @graphprotocol/graph-cli > /dev/null 2>&1
  fi

  return 0
}

# Set up Ethereum RPC URL
setup_rpc_url() {
  # Check if FORK_RPC_URL is already set in the environment
  # Note: We need to check both ways because of how environment variables are passed
  if [ -n "$FORK_RPC_URL" ] || [ ! -z "${FORK_RPC_URL+x}" ]; then
    log_info "Using FORK_RPC_URL from environment: ${FORK_RPC_URL:0:30}..."
    export FORK_RPC_URL="$FORK_RPC_URL"
    return 0
  fi
  
  # Only ask for RPC URL if running interactively
  if [ ! -t 0 ]; then
    log_error "FORK_RPC_URL environment variable is required in non-interactive mode"
    return 1
  fi

  log_info "Ethereum RPC URL is needed to fork mainnet"
  echo "Options:"
  echo "  1. Enter an Alchemy/Infura URL"
  echo "  2. Enter a custom RPC URL"
  read -r -p "Enter your choice (1-2) [1]: " RPC_CHOICE
  RPC_CHOICE=${RPC_CHOICE:-1}

  case $RPC_CHOICE in
    1)
      read -r -p "Enter your Alchemy/Infura API key: " API_KEY
      read -r -p "Provider (alchemy/infura) [alchemy]: " PROVIDER
      PROVIDER=${PROVIDER:-alchemy}

      if [ "$PROVIDER" = "alchemy" ]; then
        FORK_RPC_URL="https://eth-mainnet.g.alchemy.com/v2/$API_KEY"
      elif [ "$PROVIDER" = "infura" ]; then
        FORK_RPC_URL="https://mainnet.infura.io/v3/$API_KEY"
      else
        log_error "Unknown provider $PROVIDER"
        return 1
      fi
      ;;
    2)
      read -r -p "Enter your custom RPC URL: " FORK_RPC_URL
      ;;
    *)
      log_error "Invalid choice $RPC_CHOICE"
      return 1
      ;;
  esac
  
  return 0
}

# Start Anvil with mainnet fork
start_anvil() {
  log_info "Starting Anvil with mainnet fork"

  # Kill any existing anvil process
  pkill -f anvil > /dev/null 2>&1 || true
  
  # Make sure we have an RPC URL
  if [ -z "$FORK_RPC_URL" ]; then
    log_error "FORK_RPC_URL is not set. Please export it before running this script."
    log_error "Example: export FORK_RPC_URL=\"https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY\""
    return 1
  fi
  
  # Test the RPC URL
  if ! curl -s -X POST -H "Content-Type: application/json" \
     --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
     "$FORK_RPC_URL" | grep -q "result"; then
    log_error "Invalid RPC URL: $FORK_RPC_URL"
    log_error "The RPC URL must be a valid Ethereum JSON-RPC endpoint"
    return 1
  fi
  # Start anvil with mainnet fork in the background
  log_info "Starting Anvil with fork URL: ${FORK_RPC_URL:0:30}..."
  anvil --fork-url "$FORK_RPC_URL" --port $ANVIL_PORT --chain-id 31337 > "$LOG_DIR"/anvil.log 2>&1 &
  ANVIL_PID=$!

  # Save PID immediately
  echo $ANVIL_PID > "$LOG_DIR"/anvil.pid

  # Wait for anvil to start
  log_info "Waiting for Anvil to start"
  sleep 3

  # Check if anvil is running
  if ! ps -p $ANVIL_PID > /dev/null; then
    log_error "Anvil failed to start. Check logs at $LOG_DIR/anvil.log"
    return 1
  fi

  # Verify RPC endpoint is responding
  if ! curl -s -X POST -H "Content-Type: application/json" \
     --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
     http://localhost:$ANVIL_PORT > /dev/null; then
    log_error "Anvil RPC endpoint is not responding"
    return 1
  fi

  log_success "Anvil started successfully"
  return 0
}

# Deploy contracts to the fork
deploy_contracts() {
  log_info "Deploying contracts to the fork"

  # Set environment variables
  export PRIVATE_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" # Default anvil private key
  export CREATE_SAMPLE_MARKET="true"

  # Run the deployment script
  log_info "Running deployment script"
  if [ "$QUIET_MODE" = true ]; then
    forge script "$DEPLOY_SCRIPT" --rpc-url http://localhost:$ANVIL_PORT --broadcast --slow > "$LOG_DIR"/deploy.log 2>&1
    DEPLOY_EXIT_CODE=$?
  else
    forge script "$DEPLOY_SCRIPT" --rpc-url http://localhost:$ANVIL_PORT --broadcast --slow | tee "$LOG_DIR"/deploy.log
    DEPLOY_EXIT_CODE=${PIPESTATUS[0]}
  fi

  # Check if deployment was successful
  if [ "$DEPLOY_EXIT_CODE" -ne 0 ]; then
    log_error "Contract deployment failed with exit code $DEPLOY_EXIT_CODE"
    return 1
  fi

  # Create/overwrite the dApp .env file
  echo "# Auto-generated by scripts/local/start.sh at $(date)" > "$DAPP_ENV_FILE"

  # Extract contract addresses from the deployment summary
  log_info "Extracting contract addresses"
  SWAP_CAST_NFT=$(grep -A 10 "SwapCast Deployment Summary" "$LOG_DIR"/deploy.log | grep "SwapCastNFT:" | awk '{print $2}')
  TREASURY=$(grep -A 10 "SwapCast Deployment Summary" "$LOG_DIR"/deploy.log | grep "Treasury:" | awk '{print $2}')
  PREDICTION_MANAGER=$(grep -A 10 "SwapCast Deployment Summary" "$LOG_DIR"/deploy.log | grep "PredictionManager:" | awk '{print $2}')
  ORACLE_RESOLVER=$(grep -A 10 "SwapCast Deployment Summary" "$LOG_DIR"/deploy.log | grep "OracleResolver:" | awk '{print $2}')
  REWARD_DISTRIBUTOR=$(grep -A 10 "SwapCast Deployment Summary" "$LOG_DIR"/deploy.log | grep "RewardDistributor:" | awk '{print $2}')
  SWAP_CAST_HOOK=$(grep -A 10 "SwapCast Deployment Summary" "$LOG_DIR"/deploy.log | grep "SwapCastHook:" | awk '{print $2}')
  SIMPLE_SWAP_ROUTER=$(grep -A 10 "SwapCast Deployment Summary" "$LOG_DIR"/deploy.log | grep "SimpleSwapRouter:" | awk '{print $2}')

  # Check if we found the PredictionManager address
  if [ -z "$PREDICTION_MANAGER" ]; then
    log_error "Could not find PredictionManager address in the logs"
    return 1
  fi

  # Save addresses to the .env file
  [ -n "$SWAP_CAST_NFT" ] && echo "PUBLIC_SWAPCASTNFT_ADDRESS=$SWAP_CAST_NFT" >> "$DAPP_ENV_FILE"
  [ -n "$TREASURY" ] && echo "PUBLIC_TREASURY_ADDRESS=$TREASURY" >> "$DAPP_ENV_FILE"
  [ -n "$PREDICTION_MANAGER" ] && echo "PUBLIC_PREDICTIONMANAGER_ADDRESS=$PREDICTION_MANAGER" >> "$DAPP_ENV_FILE"
  [ -n "$ORACLE_RESOLVER" ] && echo "PUBLIC_ORACLERESOLVER_ADDRESS=$ORACLE_RESOLVER" >> "$DAPP_ENV_FILE"
  [ -n "$REWARD_DISTRIBUTOR" ] && echo "PUBLIC_REWARDDISTRIBUTOR_ADDRESS=$REWARD_DISTRIBUTOR" >> "$DAPP_ENV_FILE"
  [ -n "$SWAP_CAST_HOOK" ] && echo "PUBLIC_SWAPCASTHOOK_ADDRESS=$SWAP_CAST_HOOK" >> "$DAPP_ENV_FILE"
  [ -n "$SIMPLE_SWAP_ROUTER" ] && echo "PUBLIC_SIMPLESWAPROUTER_ADDRESS=$SIMPLE_SWAP_ROUTER" >> "$DAPP_ENV_FILE"
  
  # Add Uniswap v4 PoolManager address (mainnet)
  echo "PUBLIC_UNIV4_POOLMANAGER_ADDRESS=0x000000000004444c5dc75cB358380D2e3dE08A90" >> "$DAPP_ENV_FILE"
  # Add Uniswap v4 StateView address (mainnet)
  echo "PUBLIC_UNIV4_STATEVIEW_ADDRESS=0x7ffe42c4a5deea5b0fec41c94c136cf115597227" >> "$DAPP_ENV_FILE"
  # Add Uniswap Universal Router address (mainnet)
  echo "PUBLIC_UNIVERSAL_ROUTER_ADDRESS=0x66a9893cc07d91d95644aedd05d03f95e1dba8af" >> "$DAPP_ENV_FILE"

  # Add the admin private key and address (using first Anvil account)
  echo "PUBLIC_ADMIN_PRIVATE_KEY=$PRIVATE_KEY" >> "$DAPP_ENV_FILE"
  echo "PUBLIC_ADMIN_ADDRESS=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" >> "$DAPP_ENV_FILE"

  # Set the PREDICTION_MANAGER_ADDRESS variable for subgraph
  PREDICTION_MANAGER_ADDRESS=$PREDICTION_MANAGER

  # Get the current block number from anvil
  DEPLOY_BLOCK=$(curl -s -X POST -H "Content-Type: application/json" \
    --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
    http://localhost:$ANVIL_PORT | grep -o '"result":"0x[^"]*"' | \
    grep -o '0x[^"]*' | xargs printf "%d\n" 2>/dev/null)

  log_success "Contracts deployed successfully"
  DEPLOYMENT_SUCCESS=true
  return 0
}

# Set up the subgraph
setup_subgraph() {
  if [ "$SKIP_SUBGRAPH" = true ] || [ "$DEPLOYMENT_SUCCESS" = false ]; then
    log_warning "Skipping subgraph setup"
    return 0
  fi
  
  # Clean up data directories to ensure a fresh start
  log_info "Cleaning up data directories"
  rm -rf "$SUBGRAPH_DIR/docker/data/ipfs" "$SUBGRAPH_DIR/docker/data/postgres"
  mkdir -p "$SUBGRAPH_DIR/docker/data/ipfs" "$SUBGRAPH_DIR/docker/data/postgres"

  log_info "Setting up the subgraph"

  # Update the contract address in the subgraph configuration
  log_info "Updating subgraph configuration"
  cd "$SUBGRAPH_DIR" || return 1

  # Check if the update-address script exists in package.json
  if grep -q "update-address" package.json; then
    if [ "$QUIET_MODE" = true ]; then
      npm run update-address "$PREDICTION_MANAGER_ADDRESS" "$DEPLOY_BLOCK" "mainnet-fork" > /dev/null 2>&1
    else
      npm run update-address "$PREDICTION_MANAGER_ADDRESS" "$DEPLOY_BLOCK" "mainnet-fork"
    fi
  else
    log_warning "update-address script not found, creating it"
    # Add the script to package.json
    node -e "const fs = require('fs'); const pkg = JSON.parse(fs.readFileSync('package.json')); pkg.scripts['update-address'] = 'node scripts/update-contract-address.js'; fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));" > /dev/null 2>&1

    # Run the script directly
    node scripts/update-contract-address.js $PREDICTION_MANAGER_ADDRESS $DEPLOY_BLOCK "mainnet-fork" > /dev/null 2>&1
  fi

  # Generate code and build the subgraph
  log_info "Generating code and building the subgraph"
  if [ "$QUIET_MODE" = true ]; then
    npm run codegen > /dev/null 2>&1 && npm run build > /dev/null 2>&1
  else
    npm run codegen && npm run build
  fi

  if [ $? -ne 0 ]; then
    log_error "Failed to build the subgraph"
    return 1
  fi

  # Create data directories and start Docker services
  log_info "Starting Graph Node services"
  cd "$SUBGRAPH_DIR/docker" || return 1

  if [ "$QUIET_MODE" = true ]; then
    docker-compose up -d > /dev/null 2>&1
  else
    docker-compose up -d
  fi

  if [ $? -ne 0 ]; then
    log_error "Failed to start Graph Node services"
    return 1
  fi

  # Wait for services to be ready
  log_info "Waiting for Graph Node services to be ready"
  sleep 10

  # Create and deploy the subgraph
  log_info "Creating and deploying the subgraph"
  cd "$SUBGRAPH_DIR" || return 1

  # Run create-local (don't wait for it to finish)
  log_info "Creating local subgraph..."
  if [ "$QUIET_MODE" = true ]; then
    npm run create-local > /dev/null 2>&1 || true
  else
    npm run create-local || true
  fi
  
  # Run deploy-local with automatic version flag
  log_info "Deploying local subgraph..."
  if [ "$QUIET_MODE" = true ]; then
    npm run deploy-local-auto > /dev/null 2>&1 || true
  else
    npm run deploy-local-auto || true
  fi
  
  # Mark as deployed and continue
  log_info "Subgraph deployment initiated"
  SUBGRAPH_DEPLOYED=true
  return 0
}

# Print a summary of the setup
print_summary() {
  echo -e "\n${BOLD}========== Setup Summary ==========${NC}"
  
  if [ "$DEPLOYMENT_SUCCESS" = true ]; then
    echo -e "${GREEN}✓ Contracts deployed successfully${NC}"
    echo -e "  PredictionManager: $PREDICTION_MANAGER_ADDRESS"
    echo -e "  Environment file: $DAPP_ENV_FILE"
  else
    echo -e "${RED}✗ Contract deployment failed${NC}"
  fi

  if [ "$SKIP_SUBGRAPH" = false ]; then
    if [ "$SUBGRAPH_DEPLOYED" = true ]; then
      echo -e "${GREEN}✓ Subgraph deployed successfully${NC}"
      echo -e "  Subgraph URL: http://localhost:8000/subgraphs/name/swapcast/mainnet-fork"
      echo -e "  GraphQL Playground: http://localhost:8000/graphql"
    else
      echo -e "${RED}✗ Subgraph deployment had issues${NC}"
    fi
  else
    echo -e "${YELLOW}! Subgraph setup was skipped${NC}"
  fi

  echo -e "\n${BOLD}Anvil RPC:${NC} http://localhost:$ANVIL_PORT"
  echo -e "${BOLD}Chain ID:${NC} 31337"
  
  echo -e "\n${BOLD}To stop all services:${NC}"
  echo -e "  ./scripts/local/stop.sh"
  
  echo -e "\n${BOLD}========== Setup Complete ==========${NC}"
}

#######################################
# MAIN SCRIPT
#######################################

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-subgraph)
      SKIP_SUBGRAPH=true
      shift
      ;;
    --verbose)
      QUIET_MODE=false
      shift
      ;;
    --help)
      echo "Usage: $0 [options]"
      echo ""
      echo "Options:"
      echo "  --skip-subgraph    Skip subgraph setup"
      echo "  --verbose          Show verbose output"
      echo "  --help             Show this help message"
      echo ""
      echo "Environment variables:"
      echo "  FORK_RPC_URL       Ethereum RPC URL for forking (if set, skips the prompt)"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      echo "Use --help to see available options"
      exit 1
      ;;
  esac
done

# Set up trap to clean up on exit
trap 'cleanup_and_exit 1 "Script interrupted"' INT TERM

# Main function to orchestrate the setup process
function main() {
  # First thing: clean up any existing resources
  log_info "Cleaning up any existing resources"
  "${PROJECT_ROOT}/scripts/local/stop.sh" > /dev/null 2>&1
  
  # Check prerequisites
  check_prerequisites || cleanup_and_exit 1 "Prerequisites check failed"
  
  # Check if FORK_RPC_URL is set
  if [ -n "$FORK_RPC_URL" ]; then
    log_info "Using FORK_RPC_URL from environment"
  else
    # Prompt the user for RPC URL
    setup_rpc_url || cleanup_and_exit 1 "Failed to set up RPC URL"
  fi
  
  # Start anvil
  start_anvil || cleanup_and_exit 1 "Failed to start Anvil"
  
  # Deploy contracts
  if deploy_contracts; then
    DEPLOYMENT_SUCCESS=true
  else
    cleanup_and_exit 1 "Contract deployment failed"
  fi
  
  # Setup subgraph
  if [ "$SKIP_SUBGRAPH" = false ]; then
    if setup_subgraph; then
      SUBGRAPH_DEPLOYED=true
    else
      log_warning "Subgraph setup had issues, but continuing"
    fi
  fi
  
  # Print summary
  print_summary
  
  # Remove the trap before exiting normally
  trap - INT TERM
  exit 0
}

# Run the main function
main
exit 0
