#!/bin/bash

# SwapCast Local Development Setup Script
# This script automates the setup of a local development environment for SwapCast:
# 1. Starts an Ethereum mainnet fork using Anvil
# 2. Deploys the SwapCast contracts to the fork
# 3. Sets up the subgraph to index the deployed contracts
# 4. Prepares everything for frontend development

# Don't exit immediately on error to allow for better error handling
# set -e

# Configuration
ANVIL_PORT=8545
SKIP_SUBGRAPH=false  # Set to true to skip subgraph setup
FORK_RPC_URL=""  # Will be set during execution

# Project paths
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEPLOY_SCRIPT="${PROJECT_ROOT}/script/Deploy.s.sol"
SUBGRAPH_DIR="${PROJECT_ROOT}/subgraph"
DATA_DIR="${PROJECT_ROOT}/data"
DOCKER_COMPOSE_FILE="${PROJECT_ROOT}/scripts/local/docker-compose.yml"
LOG_DIR="${PROJECT_ROOT}/logs"
DAPP_ENV_FILE="${PROJECT_ROOT}/dApp/.env"

# Debug information
echo "Project root: ${PROJECT_ROOT}"
echo "Deploy script: ${DEPLOY_SCRIPT}"
echo "Subgraph directory: ${SUBGRAPH_DIR}"

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Create directories for logs
mkdir -p $LOG_DIR

# Function to check if a command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Function to check prerequisites
check_prerequisites() {
  echo -e "${YELLOW}Checking prerequisites...${NC}"
  
  # Check for Forge/Anvil
  if ! command_exists forge || ! command_exists anvil; then
    echo -e "${RED}Error: Foundry (forge/anvil) is not installed.${NC}"
    echo "Please install Foundry: https://book.getfoundry.sh/getting-started/installation"
    exit 1
  fi
  
  # Check for Docker and Docker Compose only if we're not skipping the subgraph setup
  if [ "$SKIP_SUBGRAPH" = false ]; then
    if ! command_exists docker; then
      echo -e "${YELLOW}Warning: Docker is not installed.${NC}"
      echo "Docker is required for the subgraph setup."
      echo -e "${YELLOW}You can run this script with --skip-subgraph to skip the subgraph setup.${NC}"
      echo "Usage: $0 --skip-subgraph"
      echo -e "${YELLOW}Do you want to continue without the subgraph? (y/n)${NC}"
      read -r response
      if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        SKIP_SUBGRAPH=true
        echo -e "${YELLOW}Continuing without subgraph setup.${NC}"
      else
        echo "Please install Docker: https://docs.docker.com/get-docker/"
        exit 1
      fi
    else
      # Check if Docker daemon is running
      if ! docker info > /dev/null 2>&1; then
        echo -e "${YELLOW}Warning: Docker daemon is not running.${NC}"
        echo "Docker is required for the subgraph setup."
        
        # Check for OrbStack specifically
        if [ -d "/Applications/OrbStack.app" ]; then
          echo "It looks like you're using OrbStack. Please start OrbStack from the Applications folder."
        elif [ -d "/Applications/Docker.app" ]; then
          echo "It looks like you're using Docker Desktop. Please start Docker Desktop from the Applications folder."
        else
          echo "On macOS, you can start Docker from the Applications folder."
        fi
        
        echo -e "${YELLOW}Do you want to continue without the subgraph? (y/n)${NC}"
        read -r response
        if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
          SKIP_SUBGRAPH=true
          echo -e "${YELLOW}Continuing without subgraph setup.${NC}"
        else
          echo "Please start Docker and try again."
          exit 1
        fi
      fi
    fi
  fi
  
  # Check for Node.js and npm
  if ! command_exists node || ! command_exists npm; then
    echo -e "${RED}Error: Node.js or npm is not installed.${NC}"
    echo "Please install Node.js and npm: https://nodejs.org/"
    exit 1
  fi
  
  # Check for Graph CLI
  if ! command_exists graph; then
    echo -e "${YELLOW}Warning: The Graph CLI is not installed. Installing it now...${NC}"
    npm install -g @graphprotocol/graph-cli
  fi
  
  # Ask for Ethereum RPC URL
  if [ -t 0 ]; then # Check if stdin is a terminal
    echo -e "${YELLOW}Ethereum RPC URL is needed to fork mainnet.${NC}"
    echo "Options:"
    echo "  1. Use Anvil's built-in fork (most reliable, no API key needed)"
    echo "  2. Enter an Alchemy/Infura URL"
    echo "  3. Enter a custom RPC URL"
    read -p "Enter your choice (1-3) [1]: " RPC_CHOICE
    RPC_CHOICE=${RPC_CHOICE:-1} # Default to 1 if user provides no input
  else
    echo -e "${YELLOW}Non-interactive mode detected. Defaulting to Anvil's built-in fork (Option 1).${NC}"
    RPC_CHOICE=1 # Default to option 1 for non-interactive sessions
  fi
  
  case $RPC_CHOICE in
    1)
      # Use Anvil's built-in fork capability without specifying a URL
      # This uses Anvil's default RPC which is more reliable than public endpoints
      FORK_RPC_URL=""
      USE_ANVIL_DEFAULT_FORK=true
      echo "Using Anvil's built-in fork capability."
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
        echo -e "${RED}Error: Unknown provider $PROVIDER${NC}"
        exit 1
      fi
      USE_ANVIL_DEFAULT_FORK=false
      echo "Using $PROVIDER RPC endpoint."
      ;;
    3)
      read -p "Enter your custom RPC URL: " FORK_RPC_URL
      USE_ANVIL_DEFAULT_FORK=false
      echo "Using custom RPC endpoint."
      ;;
    *)
      echo -e "${RED}Error: Invalid choice $RPC_CHOICE${NC}"
      exit 1
      ;;
  esac
  
  echo -e "${GREEN}All prerequisites checked!${NC}"
}

# Function to start Anvil with mainnet fork
start_anvil() {
  echo -e "${YELLOW}Starting Anvil with mainnet fork...${NC}"
  
  # Kill any existing anvil process
  pkill -f anvil || true
  
  # Start anvil with mainnet fork in the background
  if [ "$USE_ANVIL_DEFAULT_FORK" = true ]; then
    echo "Starting Anvil with built-in fork..."
    anvil --port $ANVIL_PORT > $LOG_DIR/anvil.log 2>&1 &
  else
    echo "Starting Anvil with fork URL: $FORK_RPC_URL"
    anvil --fork-url $FORK_RPC_URL --port $ANVIL_PORT > $LOG_DIR/anvil.log 2>&1 &
  fi
  ANVIL_PID=$!
  
  # Wait for anvil to start
  echo "Waiting for Anvil to start..."
  sleep 5
  
  # Check if anvil is running
  if ! ps -p $ANVIL_PID > /dev/null; then
    echo -e "${RED}Error: Anvil failed to start. Check logs at $LOG_DIR/anvil.log${NC}"
    exit 1
  fi
  
  echo -e "${GREEN}Anvil started successfully with PID $ANVIL_PID${NC}"
  echo $ANVIL_PID > $LOG_DIR/anvil.pid
}

# Function to deploy contracts to the fork
deploy_contracts() {
  echo -e "${YELLOW}Deploying contracts to the fork...${NC}"
  
  # Set environment variables directly instead of using a file
  export PRIVATE_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" # Default anvil private key
  export CREATE_SAMPLE_MARKET="true"
  
  # Deploy contracts using Forge script with better error handling
  echo "Running deployment script: forge script $DEPLOY_SCRIPT --rpc-url http://localhost:$ANVIL_PORT --broadcast --slow"
  
  # Change to project root directory to ensure correct script execution
  cd "${PROJECT_ROOT}"
  
  # Check if the deploy script exists
  if [ ! -f "$DEPLOY_SCRIPT" ]; then
    echo -e "${RED}Error: Deploy script not found at $DEPLOY_SCRIPT${NC}"
    ls -la "$(dirname "$DEPLOY_SCRIPT")"
    exit 1
  fi
  
  # Run the deployment script and capture the output directly
  echo "Running forge script with direct output:"
  forge script $DEPLOY_SCRIPT --rpc-url http://localhost:$ANVIL_PORT --broadcast --slow | tee $LOG_DIR/deploy.log
  DEPLOY_EXIT_CODE=${PIPESTATUS[0]}
  
  # Check if deployment was successful
  if [ $DEPLOY_EXIT_CODE -ne 0 ]; then
    echo -e "${RED}Error: Contract deployment failed with exit code $DEPLOY_EXIT_CODE${NC}"
    echo -e "${YELLOW}Check the full deployment logs at $LOG_DIR/deploy.log${NC}"
    DEPLOYMENT_SUCCESS=false
    SKIP_SUBGRAPH=true
    return 1
  fi
  
  # Create/overwrite the dApp .env file
  echo "# Auto-generated by scripts/local/start.sh at $(date)" > $DAPP_ENV_FILE
  
  # Extract all contract addresses from the deployment summary using grep directly
  SWAP_CAST_NFT=$(grep -A 10 "SwapCast Deployment Summary" $LOG_DIR/deploy.log | grep "SwapCastNFT:" | awk '{print $2}')
  TREASURY=$(grep -A 10 "SwapCast Deployment Summary" $LOG_DIR/deploy.log | grep "Treasury:" | awk '{print $2}')
  PREDICTION_MANAGER=$(grep -A 10 "SwapCast Deployment Summary" $LOG_DIR/deploy.log | grep "PredictionManager:" | awk '{print $2}')
  ORACLE_RESOLVER=$(grep -A 10 "SwapCast Deployment Summary" $LOG_DIR/deploy.log | grep "OracleResolver:" | awk '{print $2}')
  REWARD_DISTRIBUTOR=$(grep -A 10 "SwapCast Deployment Summary" $LOG_DIR/deploy.log | grep "RewardDistributor:" | awk '{print $2}')
  
  # Check if we found the PredictionManager address
  if [ -z "$PREDICTION_MANAGER" ]; then
    echo -e "${RED}Error: Could not find PredictionManager address in the logs.${NC}"
    echo "Check the deployment logs at $LOG_DIR/deploy.log for details."
    DEPLOYMENT_SUCCESS=false
    return 1
  fi
  
  # Save all addresses to the file with VITE_ prefix
  [ -n "$SWAP_CAST_NFT" ] && echo "VITE_SWAPCASTNFT_ADDRESS=$SWAP_CAST_NFT" >> $DAPP_ENV_FILE
  [ -n "$TREASURY" ] && echo "VITE_TREASURY_ADDRESS=$TREASURY" >> $DAPP_ENV_FILE
  [ -n "$PREDICTION_MANAGER" ] && echo "VITE_PREDICTIONMANAGER_ADDRESS=$PREDICTION_MANAGER" >> $DAPP_ENV_FILE
  [ -n "$ORACLE_RESOLVER" ] && echo "VITE_ORACLERESOLVER_ADDRESS=$ORACLE_RESOLVER" >> $DAPP_ENV_FILE
  [ -n "$REWARD_DISTRIBUTOR" ] && echo "VITE_REWARDDISTRIBUTOR_ADDRESS=$REWARD_DISTRIBUTOR" >> $DAPP_ENV_FILE
  
  # Add the hardcoded admin private key
  echo "VITE_ADMIN_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" >> $DAPP_ENV_FILE

  # Set the PREDICTION_MANAGER_ADDRESS variable for use in the rest of the script (subgraph)
  PREDICTION_MANAGER_ADDRESS=$PREDICTION_MANAGER
  
  # Get the current block number from anvil
  DEPLOY_BLOCK=$(curl -s -X POST -H "Content-Type: application/json" --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' http://localhost:$ANVIL_PORT | grep -o '"result":"0x[^"]*"' | grep -o '0x[^"]*' | xargs printf "%d\n" 2>/dev/null)
  
  if [ -z "$DEPLOY_BLOCK" ]; then
    echo "Could not determine deployment block, using 0 as fallback"
    DEPLOY_BLOCK=0
  fi
  
  # Add the deployment block to the file
  echo "VITE_DEPLOY_BLOCK=$DEPLOY_BLOCK" >> $DAPP_ENV_FILE
  
  echo -e "${GREEN}Contracts deployed successfully!${NC}"
  echo "PredictionManager address: $PREDICTION_MANAGER_ADDRESS"
  echo "Deployment block: $DEPLOY_BLOCK"
  echo "Environment variables saved to $DAPP_ENV_FILE"
  
  # Set deployment success flag
  DEPLOYMENT_SUCCESS=true
}

# Function to set up the subgraph
setup_subgraph() {
  if [ "$SKIP_SUBGRAPH" = true ] || [ "$DEPLOYMENT_SUCCESS" = false ]; then
    echo -e "${YELLOW}Skipping subgraph setup.${NC}"
    return
  fi

  echo -e "${YELLOW}Setting up the subgraph...${NC}"
  
  # Update the contract address in the subgraph configuration
  echo "Updating subgraph configuration with contract address: $PREDICTION_MANAGER_ADDRESS and block: $DEPLOY_BLOCK"
  cd $SUBGRAPH_DIR
  
  # Check if the update-address script exists in package.json
  if grep -q "update-address" package.json; then
    npm run update-address $PREDICTION_MANAGER_ADDRESS $DEPLOY_BLOCK "mainnet-fork"
  else
    echo -e "${YELLOW}Warning: update-address script not found in package.json${NC}"
    echo "Creating update-address script..."
    # Add the script to package.json if it doesn't exist
    node -e "const fs = require('fs'); const pkg = JSON.parse(fs.readFileSync('package.json')); pkg.scripts['update-address'] = 'node scripts/update-contract-address.js'; fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));"
    
    # Check if the update-contract-address.js script exists
    if [ ! -f "scripts/update-contract-address.js" ]; then
      echo "Creating update-contract-address.js script..."
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

console.log(`Updating subgraph.yaml with contract address: ${contractAddress}`);
console.log(`Start block: ${startBlock}`);
console.log(`Network: ${network}`);

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

console.log('subgraph.yaml updated successfully');
EOF
      # Install js-yaml if not already installed
      npm install --save-dev js-yaml
    fi
    
    # Run the script directly
    node scripts/update-contract-address.js $PREDICTION_MANAGER_ADDRESS $DEPLOY_BLOCK "mainnet-fork"
  fi
  
  # Generate code from the subgraph schema
  echo "Generating code from the subgraph schema..."
  npm run codegen
  
  # Build the subgraph
  echo "Building the subgraph..."
  npm run build
  
  # Check if Docker is running
  if ! command -v docker >/dev/null 2>&1; then
    echo -e "${RED}Error: Docker is not installed or not in the PATH.${NC}"
    echo -e "${YELLOW}Continuing without setting up the subgraph...${NC}"
    SUBGRAPH_DEPLOYED=false
    cd ..
    return 0
  fi
  
  # Check if Docker is running
  if ! docker info >/dev/null 2>&1; then
    echo -e "${RED}Error: Docker is not running.${NC}"
    echo -e "${YELLOW}Please start Docker and try again.${NC}"
    echo -e "${YELLOW}Continuing without setting up the subgraph...${NC}"
    SUBGRAPH_DEPLOYED=false
    cd ..
    return 0
  fi
  
  # Create data directories for Docker volumes if they don't exist
  mkdir -p "$PROJECT_ROOT/data/ipfs" "$PROJECT_ROOT/data/postgres"
  
  # Start Docker services
  echo "Starting Graph Node, IPFS, and PostgreSQL..."
  cd "$PROJECT_ROOT"
  
  # Update the ethereum network in docker-compose.yml to point to our Anvil instance
  sed -i '' "s|ethereum: 'mainnet-fork:http://host.docker.internal:8545'|ethereum: 'mainnet-fork:http://host.docker.internal:$ANVIL_PORT'|" docker-compose.yml
  
  # Start the Docker services
  docker-compose up -d
  cd "$SUBGRAPH_DIR"
  
  # Wait for services to be ready
  echo "Waiting for services to be ready..."
  sleep 10
  
  # Check if the graph node is actually running
  if ! curl -s http://localhost:8020/ > /dev/null; then
    echo -e "${RED}Error: Graph node is not running at http://localhost:8020/${NC}"
    echo "Check that Docker is running and the graph-node container is up."
    echo -e "${YELLOW}You can check the Docker logs with: docker logs local-graph-node-1${NC}"
    echo -e "${YELLOW}Continuing without deploying the subgraph...${NC}"
    SUBGRAPH_DEPLOYED=false
    cd ..
    return 0
  fi
  
  # Create and deploy the subgraph
  echo "Creating and deploying the subgraph..."
  
  # Try to create the subgraph, but don't fail if it already exists
  npm run create-local > $LOG_DIR/subgraph_create.log 2>&1 || true
  
  # Deploy the subgraph with automatic version label
  npm run deploy-local-auto > $LOG_DIR/subgraph_deploy.log 2>&1
  DEPLOY_RESULT=$?
  
  cd ..
  
  if [ $DEPLOY_RESULT -eq 0 ]; then
    echo -e "${GREEN}Subgraph deployed successfully!${NC}"
    echo "You can access the GraphQL playground at http://localhost:8000/subgraphs/name/swapcast-subgraph"
    SUBGRAPH_DEPLOYED=true
  else
    echo -e "${RED}Error: Failed to deploy the subgraph.${NC}"
    echo "Check the deployment logs at $LOG_DIR/subgraph_deploy.log"
    echo -e "${YELLOW}Continuing without a working subgraph...${NC}"
    SUBGRAPH_DEPLOYED=false
  fi
}

# Function to print summary information
print_summary() {
  # Source the contract addresses
  # source $LOG_DIR/contract_addresses.env
  
  echo -e "\n${GREEN}========== SwapCast Local Development Environment Ready! ==========${NC}"
  echo -e "Ethereum Mainnet Fork: ${YELLOW}http://localhost:$ANVIL_PORT${NC}"
  
  # Show subgraph status if not skipped
  if [ "$SKIP_SUBGRAPH" = false ]; then
    if [ "$SUBGRAPH_DEPLOYED" = true ]; then
      echo -e "GraphQL Playground: ${YELLOW}http://localhost:8000/subgraphs/name/swapcast-subgraph${NC}"
    else
      echo -e "${YELLOW}Note: Subgraph deployment had issues. Check the logs for details.${NC}"
    fi
  fi
  
  # The contract addresses have already been displayed in the forge script output
  if [ "$DEPLOYMENT_SUCCESS" = true ]; then
    echo -e "\n${GREEN}Contract deployment was successful.${NC}"
    echo -e "PredictionManager Address: ${YELLOW}$PREDICTION_MANAGER_ADDRESS${NC}"
  else
    echo -e "\n${RED}Contract deployment was not successful.${NC}"
    echo -e "Please check the logs at $LOG_DIR/deploy.log for details."
    echo -e "Try running the script again with a different RPC option."
  fi
  
  echo -e "\nDeployment Block: ${YELLOW}$DEPLOY_BLOCK${NC}"
  echo -e "All logs are available in the $LOG_DIR directory."
  echo -e "Environment variables are saved in: ${YELLOW}$DAPP_ENV_FILE${NC}"
  
  echo -e "\nTo stop the services:"
  echo -e "  - Use the stop script: ${YELLOW}./scripts/local/stop.sh${NC}"
  echo -e "  - Or manually:"
  echo -e "    - Kill Anvil: ${YELLOW}kill \$(cat $LOG_DIR/anvil.pid)${NC}"
  
  if [ "$SKIP_SUBGRAPH" = false ]; then
    echo -e "    - Stop Docker services: ${YELLOW}docker-compose -f "${DOCKER_COMPOSE_FILE}" down${NC}"
  fi
  
  echo -e "\n${GREEN}Local development environment is ready! Check the logs folder for more information.${NC}"
  
  if [ "$SKIP_SUBGRAPH" = true ]; then
    echo -e "\n${YELLOW}Note: Subgraph setup was skipped. To set up the subgraph later, run:${NC}"
    echo -e "${YELLOW}  $0${NC}"
  fi
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

# Initialize variables
DEPLOYMENT_SUCCESS=false
SUBGRAPH_DEPLOYED=false

# Main execution
echo -e "${GREEN}========== SwapCast Local Development Setup ==========${NC}"

check_prerequisites || cleanup_and_exit 1 "Prerequisites check failed."
start_anvil || cleanup_and_exit 2 "Failed to start Anvil."
deploy_contracts

if [ "$SKIP_SUBGRAPH" = true ]; then
  echo -e "${YELLOW}Skipping subgraph setup as requested.${NC}"
else
  setup_subgraph || echo -e "${YELLOW}Subgraph setup had issues, but continuing...${NC}"
fi

print_summary

exit 0
