// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import "forge-std/console2.sol";
import "../../src/interfaces/IFeedRegistry.sol";

contract TestFeedRegistry is Script {
    function run() external {
        // Chainlink Feed Registry on Ethereum mainnet
        address feedRegistryAddress = 0x47Fb2585D2C56Fe188D0E6ec628a38b74fCeeeDf;
        IFeedRegistry feedRegistry = IFeedRegistry(feedRegistryAddress);
        
        // Token addresses according to Chainlink documentation
        address ethAddress = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE; // ETH
        address usdAddress = 0x0000000000000000000000000000000000000348; // USD
        address wethAddress = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2; // WETH
        address linkAddress = 0x514910771AF9Ca656af840dff83E8264EcF986CA; // LINK
        
        // Start broadcasting transactions
        vm.startBroadcast();
        
        console2.log("Testing Feed Registry at address:", feedRegistryAddress);
        
        // Test ETH/USD
        console2.log("\nTesting ETH/USD:");
        try feedRegistry.getFeed(ethAddress, usdAddress) returns (address aggregator) {
            console2.log("Feed exists for ETH/USD! Aggregator address:", aggregator);
        } catch Error(string memory reason) {
            console2.log("Feed does not exist for ETH/USD. Reason:", reason);
        } catch {
            console2.log("Feed does not exist for ETH/USD. Unknown error.");
        }
        
        // Test USD/ETH
        console2.log("\nTesting USD/ETH:");
        try feedRegistry.getFeed(usdAddress, ethAddress) returns (address aggregator) {
            console2.log("Feed exists for USD/ETH! Aggregator address:", aggregator);
        } catch Error(string memory reason) {
            console2.log("Feed does not exist for USD/ETH. Reason:", reason);
        } catch {
            console2.log("Feed does not exist for USD/ETH. Unknown error.");
        }
        
        // Test WETH/USD
        console2.log("\nTesting WETH/USD:");
        try feedRegistry.getFeed(wethAddress, usdAddress) returns (address aggregator) {
            console2.log("Feed exists for WETH/USD! Aggregator address:", aggregator);
        } catch Error(string memory reason) {
            console2.log("Feed does not exist for WETH/USD. Reason:", reason);
        } catch {
            console2.log("Feed does not exist for WETH/USD. Unknown error.");
        }
        
        // Test LINK/USD (known to exist)
        console2.log("\nTesting LINK/USD (should exist):");
        try feedRegistry.getFeed(linkAddress, usdAddress) returns (address aggregator) {
            console2.log("Feed exists for LINK/USD! Aggregator address:", aggregator);
        } catch Error(string memory reason) {
            console2.log("Feed does not exist for LINK/USD. Reason:", reason);
        } catch {
            console2.log("Feed does not exist for LINK/USD. Unknown error.");
        }
        
        // Stop broadcasting transactions
        vm.stopBroadcast();
    }
}
