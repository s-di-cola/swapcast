#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// Get command line arguments
const args = process.argv.slice(2);

if (args.length !== 3) {
  console.error('Usage: node update-contract-address.js <contract_address> <start_block> <network>');
  console.error('Example: node update-contract-address.js 0x1234567890123456789012345678901234567890 12345678 mainnet-fork');
  process.exit(1);
}

const contractAddress = args[0];
const startBlock = parseInt(args[1], 10);
const network = args[2];

// Path to subgraph.yaml
const subgraphPath = path.join(__dirname, '..', 'subgraph.yaml');

try {
  // Read the subgraph.yaml file
  const subgraphYaml = fs.readFileSync(subgraphPath, 'utf8');
  
  // Parse YAML to JavaScript object
  const subgraph = yaml.load(subgraphYaml);
  
  // Update the contract address, start block, and network
  subgraph.dataSources[0].source.address = contractAddress;
  subgraph.dataSources[0].source.startBlock = startBlock;
  subgraph.dataSources[0].network = network;
  
  // Convert back to YAML
  const updatedYaml = yaml.dump(subgraph);
  
  // Write the updated YAML back to the file
  fs.writeFileSync(subgraphPath, updatedYaml, 'utf8');
  
  console.log(`Subgraph configuration updated with contract address ${contractAddress}, start block ${startBlock}, and network ${network}`);
} catch (error) {
  console.error('Error updating subgraph configuration:', error);
  process.exit(1);
}
