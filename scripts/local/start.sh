#!/bin/bash

# SwapCast Local Development Setup Script
# This script automates the setup of a local development environment for SwapCast

# Configuration
ANVIL_PORT=8545
SKIP_SUBGRAPH=false  # Set to true to skip subgraph setup
QUIET_MODE=true    # Reduce verbose output
DEPLOYMENT_SUCCESS=false
SUBGRAPH_DEPLOYED=false

# Project paths
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEPLOY_SCRIPT="${PROJECT_ROOT}/scripts/local/Deploy.s.sol"
SUBGRAPH_DIR="${PROJECT_ROOT}/subgraph"
DATA_DIR="${PROJECT_ROOT}/data"
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

# Create directories for logs
mkdir -p $LOG_DIR

# Utility functions
log() {
  local level=$1
  local message=$2
  local color=$NC

  case $level in
    "INFO")
      color=$BLUE
      ;;
    "SUCCESS")
      color=$GREEN
      ;;
    "WARNING")
      color=$YELLOW
      ;;
    "ERROR")
      color=$RED
      ;;
  esac

  # Always log to file
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$level] $message" >> "$LOG_DIR/setup.log"

  # Only print to console if not in quiet mode or if it's an error/warning
  if [ "$QUIET_MODE" != true ] || [ "$level" = "ERROR" ] || [ "$level" = "WARNING" ] || [ "$level" = "SUCCESS" ]; then
    echo -e "${color}[$level] $message${NC}"
  fi
}

log_info() {
  log "INFO" "$1"
}

log_success() {
  log "SUCCESS" "$1"
}

log_warning() {
  log "WARNING" "$1"
}

log_error() {
  log "ERROR" "$1"
}

# Function to check if a command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Function to set up the environment
setup_environment() {
  # Create log directory
  mkdir -p "$LOG_DIR"

  # Set project paths
  if [[ "${BASH_SOURCE[0]}" == "" ]]; then
    echo "Error: Script must be run in Bash" >&2
    exit 1
  fi

  script_dir="$(dirname "${BASH_SOURCE[0]}")"
  if ! project_path="$(cd "${script_dir}/../.." && pwd)"; then
    echo "Error: Failed to determine project root directory" >&2
    exit 1
  fi

  if [ ! -d "${project_path}" ]; then
    echo "Error: Project root directory doesn't exist: ${project_path}" >&2
    exit 1
  fi

  export PROJECT_ROOT="${project_path}"
  export DEPLOY_SCRIPT="${PROJECT_ROOT}/scripts/local/Deploy.s.sol"
  export SUBGRAPH_DIR="${PROJECT_ROOT}/subgraph"
  export DAPP_ENV_FILE="${PROJECT_ROOT}/dApp/.env.local"
  export DOCKER_COMPOSE_FILE="${SUBGRAPH_DIR}/docker/docker-compose.yml"
  export LOG_DIR="${PROJECT_ROOT}/logs"
  export DATA_DIR="${PROJECT_ROOT}/data"

  return 0
}

# Function to check prerequisites
check_prerequisites() {
  log_info "Checking prerequisites..."

  # Check for Forge/Anvil
  if ! command_exists forge || ! command_exists anvil; then
    log_error "Foundry (forge/anvil) is not installed"
    log_info "Please install Foundry: https://book.getfoundry.sh/getting-started/installation"
    return 1
  fi

  # Ensure contracts are built
  log_info "Checking if contracts are built..."
  if [ ! -d "$PROJECT_ROOT/out" ] || [ -z "$(ls -A "$PROJECT_ROOT/out" 2>/dev/null)" ]; then
    log_info "Building contracts..."
    cd "$PROJECT_ROOT" && forge build
    if [ $? -ne 0 ]; then
      log_error "Failed to build contracts"
      return 1
    fi
    log_success "Contracts built successfully"
  else
    log_info "Contracts already built"
  fi

  # Check for Docker and Docker Compose only if we're not skipping the subgraph setup
  if [ "$SKIP_SUBGRAPH" = false ]; then
    if ! command_exists docker; then
      log_warning "Docker is not installed"
      log_info "Docker is required for the subgraph setup"
      log_info "You can run this script with --skip-subgraph to skip the subgraph setup"

      if [ -t 0 ]; then # Only ask if running interactively
        read -r -p "Do you want to continue without setting up the subgraph? (y/n) [n]: " CONTINUE_WITHOUT_SUBGRAPH
        if [ "$CONTINUE_WITHOUT_SUBGRAPH" != "y" ]; then
          return 1
        fi
        SKIP_SUBGRAPH=true
        log_warning "Continuing without subgraph setup"
      else
        # Non-interactive mode, just skip subgraph
        SKIP_SUBGRAPH=true
        log_warning "Non-interactive mode detected. Skipping subgraph setup"
      fi
    else
      # Check if Docker daemon is running
      if ! docker info > /dev/null 2>&1; then
        log_warning "Docker daemon is not running"

        if [ -t 0 ]; then # Only ask if running interactively
          read -r -p "Continue without subgraph? (y/n): " response
          if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
            SKIP_SUBGRAPH=true
            log_warning "Continuing without subgraph setup"
          else
            log_info "Please start Docker and try again"
            return 1
          fi
        else
          # Non-interactive mode, just skip subgraph
          SKIP_SUBGRAPH=true
          log_warning "Non-interactive mode detected. Skipping subgraph setup"
        fi
      fi
    fi
  fi

  # Check for Node.js and npm
  if ! command_exists node || ! command_exists npm; then
    log_error "Node.js or npm is not installed"
    log_info "Please install Node.js and npm: https://nodejs.org/"
    return 1
  fi

  # Check for Graph CLI if not skipping subgraph
  if [ "$SKIP_SUBGRAPH" = false ] && ! command_exists graph; then
    log_warning "The Graph CLI is not installed. Installing it now..."
    npm install -g @graphprotocol/graph-cli > /dev/null 2>&1
  fi

  log_success "Prerequisites check completed"
  return 0
}

# Function to start Anvil with mainnet fork
start_anvil() {
  log_info "Starting Anvil with mainnet fork"

  # Kill any existing anvil process
  pkill -f anvil > /dev/null 2>&1 || true

  # Start anvil with mainnet fork in the background
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

# Function to deploy contracts to the fork
deploy_contracts() {
  log_info "Deploying contracts to the fork"

  # Set environment variables
  export PRIVATE_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" # Default anvil private key
  export CREATE_SAMPLE_MARKET="true"

  # Change to project root directory
  cd "${PROJECT_ROOT}" || exit

  # Check if the deploy script exists
  if [ ! -f "$DEPLOY_SCRIPT" ]; then
    log_error "Deploy script not found at $DEPLOY_SCRIPT"
    return 1
  fi

  # Run the deployment script
  log_info "Running deployment script"
  if [ "$QUIET_MODE" = true ]; then
    # Redirect output to log file in quiet mode
    forge script "$DEPLOY_SCRIPT" --rpc-url http://localhost:$ANVIL_PORT --broadcast --slow > "$LOG_DIR"/deploy.log 2>&1
    DEPLOY_EXIT_CODE=$?
  else
    # Show output in normal mode
    forge script "$DEPLOY_SCRIPT" --rpc-url http://localhost:$ANVIL_PORT --broadcast --slow | tee "$LOG_DIR"/deploy.log
    DEPLOY_EXIT_CODE=${PIPESTATUS[0]}
  fi

  # Check if deployment was successful
  if [ "$DEPLOY_EXIT_CODE" -ne 0 ]; then
    log_error "Contract deployment failed with exit code $DEPLOY_EXIT_CODE"
    log_info "Check the full deployment logs at $LOG_DIR/deploy.log"
    DEPLOYMENT_SUCCESS=false
    SKIP_SUBGRAPH=true
    return 1
  fi

  # Create/overwrite the dApp .env file
  echo "# Auto-generated by scripts/local/start.sh at $(date)" > "$DAPP_ENV_FILE"

  # Extract contract addresses from the deployment summary
  log_info "Extracting contract addresses"

  # Extract addresses directly without using associative arrays
  SWAP_CAST_NFT=$(grep -A 10 "SwapCast Deployment Summary" "$LOG_DIR"/deploy.log | grep "SwapCastNFT:" | awk '{print $2}')
  TREASURY=$(grep -A 10 "SwapCast Deployment Summary" "$LOG_DIR"/deploy.log | grep "Treasury:" | awk '{print $2}')
  PREDICTION_MANAGER=$(grep -A 10 "SwapCast Deployment Summary" "$LOG_DIR"/deploy.log | grep "PredictionManager:" | awk '{print $2}')
  ORACLE_RESOLVER=$(grep -A 10 "SwapCast Deployment Summary" "$LOG_DIR"/deploy.log | grep "OracleResolver:" | awk '{print $2}')
  REWARD_DISTRIBUTOR=$(grep -A 10 "SwapCast Deployment Summary" "$LOG_DIR"/deploy.log | grep "RewardDistributor:" | awk '{print $2}')
  SWAP_CAST_HOOK=$(grep -A 10 "SwapCast Deployment Summary" "$LOG_DIR"/deploy.log | grep "SwapCastHook:" | awk '{print $2}')

  # Check if we found the PredictionManager address
  if [ -z "$PREDICTION_MANAGER" ]; then
    log_error "Could not find PredictionManager address in the logs"
    DEPLOYMENT_SUCCESS=false
    return 1
  fi

  # Save addresses to the .env file
  [ -n "$SWAP_CAST_NFT" ] && echo "PUBLIC_SWAPCASTNFT_ADDRESS=$SWAP_CAST_NFT" >> "$DAPP_ENV_FILE"
  [ -n "$TREASURY" ] && echo "PUBLIC_TREASURY_ADDRESS=$TREASURY" >> "$DAPP_ENV_FILE"
  [ -n "$PREDICTION_MANAGER" ] && echo "PUBLIC_PREDICTIONMANAGER_ADDRESS=$PREDICTION_MANAGER" >> "$DAPP_ENV_FILE"
  [ -n "$ORACLE_RESOLVER" ] && echo "PUBLIC_ORACLERESOLVER_ADDRESS=$ORACLE_RESOLVER" >> "$DAPP_ENV_FILE"
  [ -n "$REWARD_DISTRIBUTOR" ] && echo "PUBLIC_REWARDDISTRIBUTOR_ADDRESS=$REWARD_DISTRIBUTOR" >> "$DAPP_ENV_FILE"
  [ -n "$SWAP_CAST_HOOK" ] && echo "PUBLIC_SWAPCASTHOOK_ADDRESS=$SWAP_CAST_HOOK" >> "$DAPP_ENV_FILE"
  # Add Uniswap v4 PoolManager address (mainnet)
  echo "PUBLIC_UNIV4_POOLMANAGER_ADDRESS=0x000000000004444c5dc75cB358380D2e3dE08A90" >> "$DAPP_ENV_FILE"

  # Add the admin private key and address (using first Anvil account)
  # First Anvil account private key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
  echo "PUBLIC_ADMIN_PRIVATE_KEY=$PRIVATE_KEY" >> "$DAPP_ENV_FILE"

  # First Anvil account address: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
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

# Function to set up the subgraph
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

  if [ "$QUIET_MODE" = true ]; then
    npm run create-local > /dev/null 2>&1 && npm run deploy-local > /dev/null 2>&1
  else
    npm run create-local && npm run deploy-local
  fi

  if [ $? -ne 0 ]; then
    log_error "Failed to deploy the subgraph"
    return 1
  fi

  log_success "Subgraph deployed successfully"
  return 0
}

# Function to print a summary of the setup
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
  
  echo -e "\n${BOLD}========== Cleanup Complete ==========${NC}"
}

# Function to clean up resources on exit
cleanup_and_exit() {
  local exit_code=$1
  local message=$2
  
  # Kill anvil if it's running
  if [ -f "$LOG_DIR/anvil.pid" ]; then
    ANVIL_PID=$(cat "$LOG_DIR/anvil.pid")
    if ps -p $ANVIL_PID > /dev/null; then
      kill $ANVIL_PID
      log_info "Anvil process killed"
    fi
  fi
  
  # Stop Docker services if they're running
  if [ "$SKIP_SUBGRAPH" = false ] && [ -f "$SUBGRAPH_DIR/docker/docker-compose.yml" ]; then
    log_info "Stopping Docker services"
    (cd "$SUBGRAPH_DIR/docker" && docker-compose down > /dev/null 2>&1)
  fi
  
  if [ -n "$message" ]; then
    log_error "$message"
  fi
  
  exit $exit_code
}

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
  # Check prerequisites
  check_prerequisites || return 1

  # Create log directory
  mkdir -p "$LOG_DIR"
  
  # Check if FORK_RPC_URL is already set in the environment
  if [ -z "$FORK_RPC_URL" ]; then
    # Only ask for RPC URL if running interactively
    if [ -t 0 ]; then
      log_info "Ethereum RPC URL is needed to fork mainnet"
      echo "Options:"
      echo "  1. Enter an Alchemy/Infura URL"
      echo "  2. Enter a custom RPC URL"
      read -r -p "Enter your choice (1-2) [1]: " RPC_CHOICE
      RPC_CHOICE=${RPC_CHOICE:-1} # Default to 1 if user provides no input

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
    else
      log_error "FORK_RPC_URL environment variable is required in non-interactive mode"
      return 1
    fi
  else
    log_info "Using FORK_RPC_URL from environment: ${FORK_RPC_URL:0:30}..."
  fi

  # Install subgraph dependencies if needed
  if [ "$SKIP_SUBGRAPH" = false ] && [ -d "$SUBGRAPH_DIR" ]; then
    log_info "Checking subgraph dependencies..."
    if [ ! -d "$SUBGRAPH_DIR/node_modules/js-yaml" ]; then
      log_info "Installing subgraph dependencies..."
      (cd "$SUBGRAPH_DIR" && npm install --save-dev js-yaml)
      if [ $? -ne 0 ]; then
        log_error "Failed to install subgraph dependencies"
        return 1
      fi
      log_success "Subgraph dependencies installed"
    else
      log_info "Subgraph dependencies already installed"
    fi
  fi

  # Start anvil
  start_anvil || cleanup_and_exit 2 "Failed to start Anvil"

  # Deploy contracts
  log_info "Deploying contracts..."
  if deploy_contracts; then
    DEPLOYMENT_SUCCESS=true
  else
    log_error "Contract deployment failed"
  fi

  # Setup subgraph
  if [ "$SKIP_SUBGRAPH" = false ] && [ "$DEPLOYMENT_SUCCESS" = true ]; then
    log_info "Setting up subgraph..."
    if setup_subgraph; then
      SUBGRAPH_DEPLOYED=true
    else
      log_warning "Subgraph setup had issues, but continuing"
    fi
  elif [ "$SKIP_SUBGRAPH" = true ]; then
    log_info "Skipping subgraph setup as requested"
  fi

  # Print summary
  print_summary

  exit 0
}

main
exit 0
