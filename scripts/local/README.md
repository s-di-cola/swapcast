# SwapCast Local Development Scripts

This directory contains scripts and configuration files for setting up a local development environment for the SwapCast project.

## Files

- `start.sh`: Main script to set up the complete local development environment
- `docker-compose.yml`: Docker Compose configuration for running The Graph node and related services

## Usage

### Setting Up the Local Development Environment

Run the start script from the project root:

```bash
./scripts/local/start.sh
```

This script will:

1. Start an Ethereum mainnet fork using Anvil
2. Deploy the SwapCast contracts to the fork using the `Deploy.s.sol` script
3. Set up The Graph node and related services using Docker
4. Configure and deploy the subgraph to index the deployed contracts

### Stopping the Local Development Environment

To stop the services:

1. Kill the Anvil process:
   ```bash
   kill $(cat logs/anvil.pid)
   ```

2. Stop the Docker services:
   ```bash
   docker-compose -f scripts/local/docker-compose.yml down
   ```

## Configuration

You can configure the script by editing the variables at the top of `start.sh`:

- `ALCHEMY_API_KEY`: Your Alchemy API key for forking mainnet (optional)
- `ANVIL_PORT`: The port for the Anvil RPC server (default: 8545)

## Logs

All logs are saved to the `logs/` directory:

- `anvil.log`: Logs from the Anvil process
- `deploy.log`: Logs from the contract deployment
- `contract_addresses.env`: Deployed contract addresses and other deployment information
