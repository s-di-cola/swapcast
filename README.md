# SwapCast Protocol Overview

## Protocol Architecture

**SwapCast** is a prediction-enabled DeFi protocol built on Uniswap v4. Users can attach predictions to swaps (e.g., "SOL will reach $1k by DATE"), pay a fee, and receive an NFT representing their position. At the prediction's due date, the protocol resolves outcomes using Chainlink Automation and oracles. Winners can claim rewards.

### Key Components
- **Treasury:** Sole holder of all prediction fees (e.g., 1% of swap amount). All rewards are paid out from the Treasury.
- **RewardDistributor:** Handles reward claim logic. Validates claims, checks NFT ownership, verifies market outcome, and instructs the Treasury to pay out rewards.
- **PredictionPool:** Manages prediction markets and positions.
- **OracleResolver:** Registers and resolves prediction markets using Chainlink Automation and price feeds.
- **SwapCastNFT:** ERC721 NFT representing a prediction position.
- **Chainlink Automation:** Triggers market resolution at the due date.

### Funds Flow
1. **Prediction Creation:**
    - User pays a prediction fee (e.g., 1% of swap) during swap.
    - **PredictionPool** receives the fee and immediately transfers it to the **Treasury** contract, which holds all prediction funds securely.
2. **Market Resolution:**
    - Chainlink Automation triggers OracleResolver to resolve expired markets.
    - PredictionPool updates market outcome.
3. **Reward Claiming:**
    - Winner submits claim to RewardDistributor with their NFT.
    - RewardDistributor verifies claim and instructs Treasury to pay out the reward to the winner.
    - **Treasury** executes the transfer directly to the winner, based on RewardDistributor's instruction.

This separation ensures security, transparency, and upgradability of funds management. The Treasury is the sole holder of all prediction fees and executes all payouts, while RewardDistributor is responsible for validating claims and orchestrating rewards.

---

## Architecture Diagrams

For a detailed technical overview, see the [C4 Architecture Diagrams](docs/c4_architecture/). These include context, container, component, and sequence diagrams that illustrate the full protocol and funds flow.

## Foundry

**Foundry is a blazing fast, portable and modular toolkit for Ethereum application development written in Rust.**

Foundry consists of:

-   **Forge**: Ethereum testing framework (like Truffle, Hardhat and DappTools).
-   **Cast**: Swiss army knife for interacting with EVM smart contracts, sending transactions and getting chain data.
-   **Anvil**: Local Ethereum node, akin to Ganache, Hardhat Network.
-   **Chisel**: Fast, utilitarian, and verbose solidity REPL.

## Documentation

https://book.getfoundry.sh/

## Usage

### Build

```shell
$ forge build
```

### Test

```shell
$ forge test
```

### Format

```shell
$ forge fmt
```

### Gas Snapshots

```shell
$ forge snapshot
```

### Anvil

```shell
$ anvil
```

### Deploy

```shell
$ forge script script/Counter.s.sol:CounterScript --rpc-url <your_rpc_url> --private-key <your_private_key>
```

### Cast

```shell
$ cast <subcommand>
```

### Help

```shell
$ forge --help
$ anvil --help
$ cast --help
```
