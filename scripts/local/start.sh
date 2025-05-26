#!/bin/bash

# SwapCast Local Development Setup Script
# This script automates the setup of a local development environment for SwapCast

# Configuration
ANVIL_PORT=8545
SKIP_SUBGRAPH=false  # Set to true to skip subgraph setup
FORK_RPC_URL=""  # Will be set during execution
QUIET_MODE=true    # Reduce verbose output

# Project paths
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEPLOY_SCRIPT="${PROJECT_ROOT}/scripts/local/Deploy.s.sol"
SUBGRAPH_DIR="${PROJECT_ROOT}/subgraph"
DATA_DIR="${PROJECT_ROOT}/data"
DOCKER_COMPOSE_FILE="${PROJECT_ROOT}/scripts/local/docker-compose.yml"
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
  export PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
  export DEPLOY_SCRIPT="${PROJECT_ROOT}/scripts/local/Deploy.s.sol"
  export SUBGRAPH_DIR="${PROJECT_ROOT}/subgraph"
  export DAPP_ENV_FILE="${PROJECT_ROOT}/dApp/.env.local"
  export DOCKER_COMPOSE_FILE="${PROJECT_ROOT}/scripts/local/docker-compose.yml"
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
        read -p "Do you want to continue without setting up the subgraph? (y/n) [n]: " CONTINUE_WITHOUT_SUBGRAPH
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
          read -p "Continue without subgraph? (y/n): " response
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
  
  # Set up Ethereum RPC URL
  # Default to Anvil's built-in fork
  FORK_RPC_URL=""
  USE_ANVIL_DEFAULT_FORK=true
  
  # Only ask for RPC URL if running interactively
  if [ -t 0 ]; then
    log_info "Ethereum RPC URL is needed to fork mainnet"
    echo "Options:"
    echo "  1. Use Anvil's built-in fork (default)"
    echo "  2. Enter an Alchemy/Infura URL"
    echo "  3. Enter a custom RPC URL"
    read -p "Enter your choice (1-3) [1]: " RPC_CHOICE
    RPC_CHOICE=${RPC_CHOICE:-1} # Default to 1 if user provides no input
    
    case $RPC_CHOICE in
      1)
        # Already set defaults above
        ;;
      2)
        read -p "Enter your Alchemy/Infura API key: " API_KEY
        read -p "Provider (alchemy/infura) [alchemy]: " PROVIDER
        PROVIDER=${PROVIDER:-alchemy}
        
        if [ "$PROVIDER" = "alchemy" ]; then
          FORK_RPC_URL="https://eth-mainnet.g.alchemy.com/v2/$API_KEY"
        elif [ "$PROVIDER" = "infura" ]; then
          FORK_RPC_URL="https://mainnet.infura.io/v3/$API_KEY"
        else
          log_error "Unknown provider $PROVIDER"
          return 1
        fi
        USE_ANVIL_DEFAULT_FORK=false
        ;;
      3)
        read -p "Enter your custom RPC URL: " FORK_RPC_URL
        USE_ANVIL_DEFAULT_FORK=false
        ;;
      *)
        log_error "Invalid choice $RPC_CHOICE"
        return 1
        ;;
    esac
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
  
  log_success "Prerequisites check completed"
  return 0
}

# Function to start Anvil with mainnet fork
start_anvil() {
  log_info "Starting Anvil with mainnet fork"
  
  # Kill any existing anvil process
  pkill -f anvil > /dev/null 2>&1 || true
  
  # Start anvil with mainnet fork in the background
  if [ "$USE_ANVIL_DEFAULT_FORK" = true ]; then
    log_info "Using Anvil's built-in fork"
    anvil --port $ANVIL_PORT > $LOG_DIR/anvil.log 2>&1 &
  else
    log_info "Using custom fork URL"
    anvil --fork-url $FORK_RPC_URL --port $ANVIL_PORT > $LOG_DIR/anvil.log 2>&1 &
  fi
  ANVIL_PID=$!
  
  # Save PID immediately
  echo $ANVIL_PID > $LOG_DIR/anvil.pid
  
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
  cd "${PROJECT_ROOT}"
  
  # Check if the deploy script exists
  if [ ! -f "$DEPLOY_SCRIPT" ]; then
    log_error "Deploy script not found at $DEPLOY_SCRIPT"
    return 1
  fi
  
  # Run the deployment script
  log_info "Running deployment script"
  if [ "$QUIET_MODE" = true ]; then
    # Redirect output to log file in quiet mode
    forge script $DEPLOY_SCRIPT --rpc-url http://localhost:$ANVIL_PORT --broadcast --slow > $LOG_DIR/deploy.log 2>&1
    DEPLOY_EXIT_CODE=$?
  else
    # Show output in normal mode
    forge script $DEPLOY_SCRIPT --rpc-url http://localhost:$ANVIL_PORT --broadcast --slow | tee $LOG_DIR/deploy.log
    DEPLOY_EXIT_CODE=${PIPESTATUS[0]}
  fi
  
  # Check if deployment was successful
  if [ $DEPLOY_EXIT_CODE -ne 0 ]; then
    log_error "Contract deployment failed with exit code $DEPLOY_EXIT_CODE"
    log_info "Check the full deployment logs at $LOG_DIR/deploy.log"
    DEPLOYMENT_SUCCESS=false
    SKIP_SUBGRAPH=true
    return 1
  fi
  
  # Create/overwrite the dApp .env file
  echo "# Auto-generated by scripts/local/start.sh at $(date)" > $DAPP_ENV_FILE
  
  # Extract contract addresses from the deployment summary
  log_info "Extracting contract addresses"
  
  # Define contract names
  CONTRACT_NAMES=("SwapCastNFT" "Treasury" "PredictionManager" "OracleResolver" "RewardDistributor" "SwapCastHook")
  
  # Extract addresses directly without using associative arrays
  SWAP_CAST_NFT=$(grep -A 10 "SwapCast Deployment Summary" $LOG_DIR/deploy.log | grep "SwapCastNFT:" | awk '{print $2}')
  TREASURY=$(grep -A 10 "SwapCast Deployment Summary" $LOG_DIR/deploy.log | grep "Treasury:" | awk '{print $2}')
  PREDICTION_MANAGER=$(grep -A 10 "SwapCast Deployment Summary" $LOG_DIR/deploy.log | grep "PredictionManager:" | awk '{print $2}')
  ORACLE_RESOLVER=$(grep -A 10 "SwapCast Deployment Summary" $LOG_DIR/deploy.log | grep "OracleResolver:" | awk '{print $2}')
  REWARD_DISTRIBUTOR=$(grep -A 10 "SwapCast Deployment Summary" $LOG_DIR/deploy.log | grep "RewardDistributor:" | awk '{print $2}')
  SWAP_CAST_HOOK=$(grep -A 10 "SwapCast Deployment Summary" $LOG_DIR/deploy.log | grep "SwapCastHook:" | awk '{print $2}')
  
  # Check if we found the PredictionManager address
  if [ -z "$PREDICTION_MANAGER" ]; then
    log_error "Could not find PredictionManager address in the logs"
    DEPLOYMENT_SUCCESS=false
    return 1
  fi
  
  # Save addresses to the .env file
  [ -n "$SWAP_CAST_NFT" ] && echo "PUBLIC_SWAPCASTNFT_ADDRESS=$SWAP_CAST_NFT" >> $DAPP_ENV_FILE
  [ -n "$TREASURY" ] && echo "PUBLIC_TREASURY_ADDRESS=$TREASURY" >> $DAPP_ENV_FILE
  [ -n "$PREDICTION_MANAGER" ] && echo "PUBLIC_PREDICTIONMANAGER_ADDRESS=$PREDICTION_MANAGER" >> $DAPP_ENV_FILE
  [ -n "$ORACLE_RESOLVER" ] && echo "PUBLIC_ORACLERESOLVER_ADDRESS=$ORACLE_RESOLVER" >> $DAPP_ENV_FILE
  [ -n "$REWARD_DISTRIBUTOR" ] && echo "PUBLIC_REWARDDISTRIBUTOR_ADDRESS=$REWARD_DISTRIBUTOR" >> $DAPP_ENV_FILE
  [ -n "$SWAP_CAST_HOOK" ] && echo "PUBLIC_SWAPCASTHOOK_ADDRESS=$SWAP_CAST_HOOK" >> $DAPP_ENV_FILE
  # Add Uniswap v4 PoolManager address (mainnet)
  echo "PUBLIC_UNIV4_POOLMANAGER_ADDRESS=0x000000000004444c5dc75cB358380D2e3dE08A90" >> $DAPP_ENV_FILE
  
  # Add the admin private key and address (using first Anvil account)
  # First Anvil account private key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
  echo "PUBLIC_ADMIN_PRIVATE_KEY=$PRIVATE_KEY" >> $DAPP_ENV_FILE
  
  # First Anvil account address: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
  echo "PUBLIC_ADMIN_ADDRESS=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" >> $DAPP_ENV_FILE

  # Set the PREDICTION_MANAGER_ADDRESS variable for subgraph
  PREDICTION_MANAGER_ADDRESS=$PREDICTION_MANAGER
  
  # Get the current block number from anvil
  DEPLOY_BLOCK=$(curl -s -X POST -H "Content-Type: application/json" \
    --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
    http://localhost:$ANVIL_PORT | grep -o '"result":"0x[^"]*"' | \
    grep -o '0x[^"]*' | xargs printf "%d\n" 2>/dev/null)
  
  if [ -z "$DEPLOY_BLOCK" ]; then
    log_warning "Could not determine deployment block, using 0 as fallback"
    DEPLOY_BLOCK=0
  fi
  
  # Add the deployment block to the file
  echo "PUBLIC_DEPLOY_BLOCK=$DEPLOY_BLOCK" >> $DAPP_ENV_FILE
  
  # Store contract data for summary
  CONTRACT_DATA=$(cat $DAPP_ENV_FILE)
  
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

  log_info "Setting up the subgraph"
  
  # Update the contract address in the subgraph configuration
  log_info "Updating subgraph configuration"
  cd $SUBGRAPH_DIR || return 1
  
  # Check if the update-address script exists in package.json
  if grep -q "update-address" package.json; then
    if [ "$QUIET_MODE" = true ]; then
      npm run update-address $PREDICTION_MANAGER_ADDRESS $DEPLOY_BLOCK "mainnet-fork" > /dev/null 2>&1
    else
      npm run update-address $PREDICTION_MANAGER_ADDRESS $DEPLOY_BLOCK "mainnet-fork"
    fi
  else
    log_warning "update-address script not found, creating it"
    # Add the script to package.json
    node -e "const fs = require('fs'); const pkg = JSON.parse(fs.readFileSync('package.json')); pkg.scripts['update-address'] = 'node scripts/update-contract-address.js'; fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));" > /dev/null 2>&1
    
    # js-yaml dependency should already be installed in prerequisites
    
    # Create the script if it doesn't exist
    if [ ! -f "scripts/update-contract-address.js" ]; then
      mkdir -p scripts
      cat > scripts/update-contract-address.js << 'EOF'
const fs = require('fs');
const yaml = require('js-yaml');

// Get command line arguments
const contractAddress = process.argv[2];
const startBlock = process.argv[3] || '0';
const network = process.argv[4] || 'mainnet';

if (!contractAddress) {
  console.error('Error: Contract address is required');
  process.exit(1);
}

// Read the subgraph.yaml file
const subgraphYaml = yaml.load(fs.readFileSync('./subgraph.yaml', 'utf8'));

// Update the contract address and start block
subgraphYaml.dataSources.forEach(dataSource => {
  dataSource.network = network;
  dataSource.source.address = contractAddress;
  dataSource.source.startBlock = parseInt(startBlock);
});

// Write the updated subgraph.yaml file
fs.writeFileSync('./subgraph.yaml', yaml.dump(subgraphYaml, { lineWidth: 120 }));
EOF
    fi
    
    # Run the script directly
    node scripts/update-contract-address.js $PREDICTION_MANAGER_ADDRESS $DEPLOY_BLOCK "mainnet-fork" > /dev/null 2>&1
  fi
  
  # Generate code and build the subgraph
  log_info "Building the subgraph"
  if [ "$QUIET_MODE" = true ]; then
    npm run codegen > /dev/null 2>&1 && npm run build > /dev/null 2>&1
  else
    npm run codegen && npm run build
  fi
  
  # Check Docker requirements
  if ! command_exists docker || ! docker info > /dev/null 2>&1; then
    log_warning "Docker is not available, skipping subgraph deployment"
    SUBGRAPH_DEPLOYED=false
    cd "$PROJECT_ROOT" || return 1
    return 0
  fi
  
  # Create data directories and start Docker services
  log_info "Starting Graph Node services"
  mkdir -p "$PROJECT_ROOT/data/ipfs" "$PROJECT_ROOT/data/postgres"
  cd "$PROJECT_ROOT" || return 1
  
  # Update docker-compose with correct port in the correct file
  if [ -f "$DOCKER_COMPOSE_FILE" ]; then
    sed -i '' "s|ethereum: 'mainnet-fork:http://host.docker.internal:8545'|ethereum: 'mainnet-fork:http://host.docker.internal:$ANVIL_PORT'|" "$DOCKER_COMPOSE_FILE" 2>/dev/null
  else
    log_error "Docker compose file not found at $DOCKER_COMPOSE_FILE"
    SUBGRAPH_DEPLOYED=false
    return 1
  fi
  
  # Start Docker services with the correct file
  log_info "Running docker-compose up -d with file: $DOCKER_COMPOSE_FILE"
  if [ "$QUIET_MODE" = true ]; then
    docker-compose -f "$DOCKER_COMPOSE_FILE" up -d > "$LOG_DIR/docker.log" 2>&1
  else
    docker-compose -f "$DOCKER_COMPOSE_FILE" up -d
  fi
  
  # Wait for services
  log_info "Waiting for Graph Node to start"
  sleep 10
  
  # Check if graph node is running (with retry)
  local retry_count=0
  local max_retries=5
  while ! curl -s http://localhost:8020/ > /dev/null && [ $retry_count -lt $max_retries ]; do
    log_info "Waiting for Graph Node to be ready (attempt $(($retry_count + 1))/$max_retries)"
    sleep 5
    retry_count=$((retry_count + 1))
  done
  
  if ! curl -s http://localhost:8020/ > /dev/null; then
    log_warning "Graph node is not running after $max_retries attempts, skipping subgraph deployment"
    log_info "Check Docker logs with: docker logs local-graph-node-1"
    SUBGRAPH_DEPLOYED=false
    return 0
  fi
  
  log_success "Graph node is running successfully"
  
  # Deploy the subgraph
  log_info "Deploying the subgraph"
  cd "$SUBGRAPH_DIR" || return 1
  
  # Create and deploy
  npm run create-local > $LOG_DIR/subgraph_create.log 2>&1 || true
  npm run deploy-local-auto > $LOG_DIR/subgraph_deploy.log 2>&1
  DEPLOY_RESULT=$?
  
  cd "$PROJECT_ROOT" || return 1
  
  if [ $DEPLOY_RESULT -eq 0 ]; then
    log_success "Subgraph deployed successfully"
    SUBGRAPH_DEPLOYED=true
  else
    log_warning "Failed to deploy the subgraph"
    SUBGRAPH_DEPLOYED=false
  fi
  
  return 0
}

# Function to print summary information
print_summary() {
  # Clear the screen for better readability
  clear
  
  echo -e "\n${BOLD}${GREEN}========== SwapCast Local Development Setup Summary ===========${NC}\n"
  
  # Print deployment status with appropriate icon
  if [ "$DEPLOYMENT_SUCCESS" = true ]; then
    echo -e "${BOLD}${GREEN}✓ Contract Deployment: SUCCESS${NC}"
  else
    echo -e "${BOLD}${RED}✗ Contract Deployment: FAILED${NC}"
    echo -e "Check logs at: $LOG_DIR/deploy.log"
    return 1
  fi
  
  # Print subgraph status
  if [ "$SKIP_SUBGRAPH" = false ]; then
    if [ "$SUBGRAPH_DEPLOYED" = true ]; then
      echo -e "${BOLD}${GREEN}✓ Subgraph Deployment: SUCCESS${NC}"
    else
      echo -e "${BOLD}${YELLOW}⚠ Subgraph Deployment: FAILED${NC}"
    fi
  else
    echo -e "${BOLD}${YELLOW}⚠ Subgraph Setup: SKIPPED${NC}"
  fi
  echo
  
  # Print contract addresses in a table format
  echo -e "${BOLD}${BLUE}CONTRACT ADDRESSES:${NC}"
  echo -e "${BOLD}┌───────────────────┬──────────────────────────────────────────────┐${NC}"
  echo -e "${BOLD}│ Contract          │ Address                                    │${NC}"
  echo -e "${BOLD}├───────────────────┼──────────────────────────────────────────────┤${NC}"
  
  # Read the .env file and extract contract addresses
  while IFS='=' read -r key value; do
    if [[ $key =~ ^VITE_(.*)_ADDRESS$ ]]; then
      contract_name=${BASH_REMATCH[1]}
      # Format the contract name and address for the table
      printf "${BOLD}│ %-17s │ %-46s │${NC}\n" "$contract_name" "$value"
    fi
  done < "$DAPP_ENV_FILE"
  
  echo -e "${BOLD}└───────────────────┴──────────────────────────────────────────────┘${NC}\n"
  
  # Print deployment info
  echo -e "${BOLD}${BLUE}DEPLOYMENT INFO:${NC}"
  echo -e "${BOLD}┌───────────────────┬──────────────────────────────────────────────┐${NC}"
  echo -e "${BOLD}│ Item              │ Value                                      │${NC}"
  echo -e "${BOLD}├───────────────────┼──────────────────────────────────────────────┤${NC}"
  printf "${BOLD}│ %-17s │ %-46s │${NC}\n" "Deployment Block" "$(grep "VITE_DEPLOY_BLOCK=" "$DAPP_ENV_FILE" | cut -d'=' -f2)"
  printf "${BOLD}│ %-17s │ %-46s │${NC}\n" "Ethereum RPC" "http://localhost:$ANVIL_PORT"
  printf "${BOLD}│ %-17s │ %-46s │${NC}\n" "Environment File" "$DAPP_ENV_FILE"
  echo -e "${BOLD}└───────────────────┴──────────────────────────────────────────────┘${NC}\n"
  
  # Print subgraph info if deployed
  if [ "$SKIP_SUBGRAPH" = false ]; then
    if [ "$SUBGRAPH_DEPLOYED" = true ]; then
      echo -e "${BOLD}${BLUE}SUBGRAPH INFO:${NC}"
      echo -e "${BOLD}┌───────────────────┬──────────────────────────────────────────────┐${NC}"
      echo -e "${BOLD}│ Item              │ Value                                      │${NC}"
      echo -e "${BOLD}├───────────────────┼──────────────────────────────────────────────┤${NC}"
      printf "${BOLD}│ %-17s │ %-46s │${NC}\n" "GraphQL Endpoint" "http://localhost:8000/subgraphs/name/swapcast-subgraph"
      printf "${BOLD}│ %-17s │ %-46s │${NC}\n" "Contract Address" "$PREDICTION_MANAGER_ADDRESS"
      printf "${BOLD}│ %-17s │ %-46s │${NC}\n" "Start Block" "$(grep "VITE_DEPLOY_BLOCK=" "$DAPP_ENV_FILE" | cut -d'=' -f2)"
      echo -e "${BOLD}└───────────────────┴──────────────────────────────────────────────┘${NC}\n"
    else
      echo -e "${BOLD}${YELLOW}⚠ SUBGRAPH DEPLOYMENT FAILED${NC}\n"
      echo -e "Check setup logs at: $LOG_DIR/setup.log\n"
      echo -e "Make sure Docker is running and ports 8000, 8001, 8020, 8030, 5001, and 5432 are available.\n"
    fi
  else
    echo -e "${BOLD}${YELLOW}⚠ SUBGRAPH SETUP WAS SKIPPED${NC}\n"
  fi
  
  # Print next steps
  echo -e "${BOLD}${BLUE}NEXT STEPS:${NC}"
  echo -e "1. Start the frontend development server:\n   ${BOLD}cd dApp && npm run dev${NC}"
  echo -e "2. Access the application at: ${BOLD}http://localhost:5173${NC}\n"
  
  # Print cleanup instructions
  echo -e "${BOLD}${BLUE}TO STOP SERVICES:${NC}"
  echo -e "1. Use the stop script: ${BOLD}./scripts/local/stop.sh${NC}"
  echo -e "2. Or manually:\n   - Kill Anvil: ${BOLD}kill \$(cat "$LOG_DIR/anvil.pid")${NC}"
  if [ "$SKIP_SUBGRAPH" = false ]; then
    echo -e "   - Stop Docker services: ${BOLD}docker-compose -f "$DOCKER_COMPOSE_FILE" down${NC}"
  fi
  echo
  
  echo -e "${BOLD}${GREEN}Setup completed successfully!${NC}\n"
}

# Function to handle errors and cleanup
cleanup_and_exit() {
  local exit_code=$1
  local error_message=$2
  
  echo -e "\n${RED}ERROR: $error_message${NC}"
  echo -e "${YELLOW}Cleaning up resources...${NC}"
  
  # Kill anvil if it's running
  if [ -f "$LOG_DIR/anvil.pid" ]; then
    kill $(cat $LOG_DIR/anvil.pid) 2>/dev/null || true
    echo "Anvil process terminated."
  fi
  
  # Stop Docker services if they're running
  if docker ps | grep -q "graph-node"; then
    docker-compose -f "${DOCKER_COMPOSE_FILE}" down
    echo "Docker services stopped."
  fi
  
  echo -e "${RED}Setup failed. Please check the logs for more information.${NC}"
  exit $exit_code
}

# Function to show usage
show_usage() {
  echo "Usage: $0 [OPTIONS]"
  echo "Options:"
  echo "  --skip-subgraph    Skip the subgraph setup"
  echo "  --help             Show this help message"
}

# Initialize argument flags
SKIP_SUBGRAPH=false
SHOW_HELP=false
UNKNOWN_OPTION_FOUND=false

# Parse command line arguments
TEMP_ARGS=()
while [[ $# -gt 0 ]]; do
  arg="$1"
  if [[ "$arg" == "--help" ]]; then
    SHOW_HELP=true
    shift # Consume --help
    # No need to break immediately, process all args in case of mixed order or future additions
  elif [[ "$arg" == "--skip-subgraph" ]]; then
    SKIP_SUBGRAPH=true
    shift # Consume --skip-subgraph
  elif [[ "$arg" == --* ]]; then # Check for any other unknown options starting with --
    echo "Unknown option: $arg"
    UNKNOWN_OPTION_FOUND=true
    shift # Consume unknown option
  else
    # Store positional arguments if any, or handle as error if none are expected
    # For this script, we don't expect positional args beyond options
    echo "Unexpected argument: $arg"
    UNKNOWN_OPTION_FOUND=true
    shift # Consume unexpected argument
  fi
done

# Handle help or unknown option after parsing
if [[ "$SHOW_HELP" == true ]]; then
  show_usage
  exit 0
fi

if [[ "$UNKNOWN_OPTION_FOUND" == true ]]; then
  show_usage
  exit 1
fi

# Main execution
main() {
  # Stop any running services first
  log_info "Stopping any running services..."
  "${PROJECT_ROOT}/scripts/local/stop.sh"
  
  # Initialize variables
  DEPLOYMENT_SUCCESS=false
  SUBGRAPH_DEPLOYED=false

  # Setup environment
  setup_environment || cleanup_and_exit 1 "Environment setup failed"
  
  # Check prerequisites
  log_info "Checking prerequisites..."
  check_prerequisites || cleanup_and_exit 1 "Prerequisites check failed"
  
  # Start Anvil
  log_info "Starting Anvil..."
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
