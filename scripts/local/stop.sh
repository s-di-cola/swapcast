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
DOCKER_COMPOSE_FILE="${PROJECT_ROOT}/subgraph/docker/docker-compose.yml"

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

# Check if Docker is running and stop services using docker-compose
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  echo -e "${YELLOW}Stopping Docker services...${NC}"
  docker-compose -f "$DOCKER_COMPOSE_FILE" down
  echo -e "${GREEN}Docker services stopped.${NC}"
fi

# Clean up subgraph data directory
SUBGRAPH_DATA_DIR="${PROJECT_ROOT}/subgraph/data"
if [ -d "$SUBGRAPH_DATA_DIR" ]; then
  echo -e "${YELLOW}Cleaning up subgraph data directory...${NC}"
  rm -rf "$SUBGRAPH_DATA_DIR"
  echo -e "${GREEN}Subgraph data directory cleaned.${NC}"
fi

echo -e "${GREEN}========== Cleanup Complete ==========${NC}"
exit 0
