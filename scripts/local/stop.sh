#!/bin/bash

# SwapCast Local Development Cleanup Script
# This script stops all services started by the start.sh script

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Project paths
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LOG_DIR="${PROJECT_ROOT}/logs"
DOCKER_COMPOSE_FILE="${PROJECT_ROOT}/scripts/local/docker-compose.yml"

# Function to show usage
show_usage() {
  echo "Usage: $0 [OPTIONS]"
  echo "Options:"
  echo "  --help             Show this help message"
}

# Parse command line arguments
for arg in "$@"; do
  case $arg in
    --help)
      show_usage
      exit 0
      ;;
    *)
      echo "Unknown option: $arg"
      show_usage
      exit 1
      ;;
  esac
done

echo -e "${GREEN}========== Stopping SwapCast Local Development Environment ==========${NC}"

# Stop Anvil
echo -e "${YELLOW}Stopping Anvil...${NC}"
if [ -f "$LOG_DIR/anvil.pid" ]; then
  ANVIL_PID=$(cat $LOG_DIR/anvil.pid)
  if ps -p $ANVIL_PID > /dev/null; then
    kill $ANVIL_PID
    echo -e "${GREEN}Anvil stopped successfully.${NC}"
  else
    echo -e "${YELLOW}Anvil process not found. It may have already been stopped.${NC}"
  fi
  rm -f $LOG_DIR/anvil.pid
else
  echo -e "${YELLOW}No Anvil PID file found.${NC}"
fi

# Stop Graph Node process if running
echo -e "${YELLOW}Stopping Graph Node...${NC}"
if [ -f "$LOG_DIR/graph_node.pid" ]; then
  GRAPH_NODE_PID=$(cat $LOG_DIR/graph_node.pid)
  if ps -p $GRAPH_NODE_PID > /dev/null; then
    kill $GRAPH_NODE_PID
    echo -e "${GREEN}Graph Node process stopped successfully.${NC}"
  else
    echo -e "${YELLOW}Graph Node process not found. It may have already been stopped.${NC}"
  fi
  rm -f $LOG_DIR/graph_node.pid
else
  echo -e "${YELLOW}No Graph Node PID file found.${NC}"
fi

# Check if Docker is running and stop services using docker-compose
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  # Check if any graph-node containers are running
  if docker ps | grep -q "graph-node\|ipfs\|postgres"; then
    echo -e "${YELLOW}Stopping Docker services...${NC}"
    
    # Use docker-compose to stop services if the file exists
    if [ -f "$PROJECT_ROOT/docker-compose.yml" ]; then
      cd "$PROJECT_ROOT"
      if docker-compose down; then
        echo -e "${GREEN}Docker services stopped successfully.${NC}"
      else
        echo -e "${RED}Failed to stop Docker services with docker-compose.${NC}"
        # Fallback to manual container stopping
        DOCKER_CONTAINERS=$(docker ps -q -f "name=graph-node\|ipfs\|postgres")
        if [ -n "$DOCKER_CONTAINERS" ]; then
          docker stop $DOCKER_CONTAINERS
          echo -e "${GREEN}Docker services stopped manually.${NC}"
        fi
      fi
    else
      # If docker-compose.yml doesn't exist, stop containers manually
      DOCKER_CONTAINERS=$(docker ps -q -f "name=graph-node\|ipfs\|postgres")
      if [ -n "$DOCKER_CONTAINERS" ]; then
        docker stop $DOCKER_CONTAINERS
        echo -e "${GREEN}Docker services stopped manually.${NC}"
      fi
    fi
  else
    echo -e "${YELLOW}No Docker services found.${NC}"
  fi
else
  echo -e "${YELLOW}Docker not running. Skipping Docker services cleanup.${NC}"
fi

echo -e "${GREEN}========== Cleanup Complete ==========${NC}"
echo "You can restart the local development environment with:"
echo -e "${YELLOW}./scripts/local/start.sh${NC}"

exit 0
