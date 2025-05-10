# SwapCast Subgraph

This subgraph indexes events from the SwapCast contracts, providing an efficient way to query data for the SwapCast dApp.

## Schema

The subgraph indexes the following entities:

- **Market**: Represents a prediction market with its details and current state
- **Prediction**: Records of user predictions on markets
- **User**: User-specific data including their predictions and statistics
- **MarketResolution**: Details about resolved markets
- **GlobalStat**: Global statistics about the protocol

## Setup and Deployment

### Prerequisites

- Node.js and npm
- The Graph CLI (`npm install -g @graphprotocol/graph-cli`)

### Local Development

1. Install dependencies:
   ```
   npm install
   ```

2. Generate AssemblyScript types from the subgraph schema and ABIs:
   ```
   npm run codegen
   ```

3. Build the subgraph:
   ```
   npm run build
   ```

### Deploying to a Local Graph Node

1. Start a local Graph Node (using Docker):
   ```
   docker-compose up -d
   ```

2. Create the subgraph locally:
   ```
   npm run create-local
   ```

3. Deploy the subgraph to your local Graph Node:
   ```
   npm run deploy-local
   ```

### Deploying to The Graph's Hosted Service

1. Authenticate with The Graph:
   ```
   graph auth --product hosted-service <YOUR_ACCESS_TOKEN>
   ```

2. Deploy the subgraph:
   ```
   npm run deploy
   ```

## Usage with SwapCast dApp

After deployment, you can query the subgraph using GraphQL. Here are some example queries:

### Get All Markets
```graphql
{
  markets {
    id
    marketId
    description
    expirationTimestamp
    isResolved
    winningOutcome
    totalStakedOutcome0
    totalStakedOutcome1
  }
}
```

### Get User Predictions
```graphql
{
  user(id: "0xUserAddress") {
    predictions {
      market {
        description
      }
      outcome
      amount
      claimed
      reward
    }
    totalStaked
    totalClaimed
  }
}
```

## Updating the Subgraph

When contract addresses or ABIs change:

1. Update the `subgraph.yaml` file with the new contract addresses
2. Run codegen and build again
3. Redeploy the subgraph

## Notes for Mainnet Fork Development

When testing with a local mainnet fork:
1. Update the network in `subgraph.yaml` to match your local network (e.g., `mainnet-fork`)
2. Update the contract addresses to match your local deployments
3. Set the `startBlock` to the block where your contracts were deployed on the fork
