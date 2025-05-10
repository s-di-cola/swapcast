# SwapCast Subgraph Deployment Guide

This guide will walk you through deploying the SwapCast subgraph to a local Graph Node running alongside your Ethereum mainnet fork.

## Prerequisites

1. Docker and Docker Compose installed
2. Node.js and npm installed
3. The Graph CLI installed (`npm install -g @graphprotocol/graph-cli`)
4. A running Ethereum mainnet fork (using Anvil or Hardhat)

## Setting Up a Local Graph Node

1. Create a `docker-compose.yml` file in your project root:

```yaml
version: '3'
services:
  graph-node:
    image: graphprotocol/graph-node:latest
    ports:
      - '8000:8000'
      - '8001:8001'
      - '8020:8020'
      - '8030:8030'
      - '8040:8040'
    depends_on:
      - ipfs
      - postgres
    environment:
      postgres_host: postgres
      postgres_user: graph-node
      postgres_pass: let-me-in
      postgres_db: graph-node
      ipfs: 'ipfs:5001'
      ethereum: 'mainnet-fork:http://host.docker.internal:8545'
      GRAPH_LOG: info
      ETHEREUM_POLLING_INTERVAL: 1000
      ETHEREUM_REORG_THRESHOLD: 1
      GRAPH_ETHEREUM_TARGET_TRIGGERS_PER_BLOCK_RANGE: 100

  ipfs:
    image: ipfs/go-ipfs:v0.10.0
    ports:
      - '5001:5001'
    volumes:
      - ./data/ipfs:/data/ipfs

  postgres:
    image: postgres:14
    ports:
      - '5432:5432'
    command: ["postgres", "-cshared_preload_libraries=pg_stat_statements"]
    environment:
      POSTGRES_USER: graph-node
      POSTGRES_PASSWORD: let-me-in
      POSTGRES_DB: graph-node
    volumes:
      - ./data/postgres:/var/lib/postgresql/data
```

2. Create the data directories:

```bash
mkdir -p data/ipfs data/postgres
```

3. Start the Graph Node and related services:

```bash
docker-compose up -d
```

## Deploying SwapCast Contracts to Mainnet Fork

1. Start your local Ethereum mainnet fork:

```bash
cd /Users/sdicola/WebstormProjects/swap-cast
anvil --fork-url https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY
```

2. In a separate terminal, deploy your contracts to the fork:

```bash
cd /Users/sdicola/WebstormProjects/swap-cast
forge script script/Deploy.s.sol --rpc-url http://localhost:8545 --broadcast
```

3. Note the deployed contract addresses, especially the `PredictionManager` address.

## Updating Subgraph Configuration

1. Update the `subgraph.yaml` file with the actual contract address:

```yaml
dataSources:
  - kind: ethereum
    name: PredictionManager
    network: mainnet
    source:
      address: "0x123...abc"  # Replace with your deployed PredictionManager address
      abi: PredictionManager
      startBlock: 1234567  # Replace with the block number where your contract was deployed
```

## Deploying the Subgraph Locally

1. Create the subgraph on your local Graph Node:

```bash
cd /Users/sdicola/WebstormProjects/swap-cast/subgraph
npm run create-local
```

2. Deploy the subgraph:

```bash
cd /Users/sdicola/WebstormProjects/swap-cast/subgraph
npm run deploy-local
```

## Testing the Subgraph

1. Open the GraphQL playground at http://localhost:8000/subgraphs/name/swapcast-subgraph

2. Try some example queries:

```graphql
{
  markets(first: 10) {
    id
    marketId
    description
    expirationTimestamp
    isResolved
    totalStakedOutcome0
    totalStakedOutcome1
  }
}
```

## Integrating with the Frontend

1. Install the required dependencies in your frontend project:

```bash
npm install @apollo/client graphql
```

2. Set up Apollo Client to connect to your local subgraph:

```javascript
import { ApolloClient, InMemoryCache, gql } from '@apollo/client';

const client = new ApolloClient({
  uri: 'http://localhost:8000/subgraphs/name/swapcast-subgraph',
  cache: new InMemoryCache(),
});

// Example query
const GET_MARKETS = gql`
  query GetMarkets {
    markets(first: 10) {
      id
      marketId
      description
      expirationTimestamp
      isResolved
      totalStakedOutcome0
      totalStakedOutcome1
    }
  }
`;

// Use the query in your component
function Markets() {
  const { loading, error, data } = useQuery(GET_MARKETS);
  
  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error :(</p>;
  
  return data.markets.map(market => (
    <div key={market.id}>
      <h3>{market.description}</h3>
      <p>Expires: {new Date(parseInt(market.expirationTimestamp) * 1000).toLocaleString()}</p>
      <p>Total Staked: {ethers.utils.formatEther(market.totalStakedOutcome0 + market.totalStakedOutcome1)} ETH</p>
    </div>
  ));
}
```

## Troubleshooting

1. If you encounter issues with the subgraph not syncing, check the Graph Node logs:

```bash
docker-compose logs -f graph-node
```

2. If you need to reset the subgraph:

```bash
npm run remove-local
npm run create-local
npm run deploy-local
```

3. If you update your contract and redeploy, you'll need to update the contract address and start block in the subgraph.yaml file and redeploy the subgraph.
