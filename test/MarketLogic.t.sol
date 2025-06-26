// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import {MarketLogic} from "../src/MarketLogic.sol";
import {PredictionManager} from "../src/PredictionManager.sol";
import {ISwapCastNFT} from "../src/interfaces/ISwapCastNFT.sol";
import {PredictionTypes} from "../src/types/PredictionTypes.sol";

// Wrapper contract to test internal functions
contract MarketLogicWrapper {
    using MarketLogic for PredictionManager.Market;

    PredictionManager.Market public market;
    ISwapCastNFT public swapCastNFT;
    address public treasuryAddress = address(0x1234);
    uint256 public constant PROTOCOL_FEE_BASIS_POINTS = 100; // 1%
    uint256 public constant MIN_STAKE_AMOUNT = 0.01 ether;

    constructor(uint256 marketId, address _swapCastNFT) {
        market.marketId = marketId;
        market.expirationTime = block.timestamp + 1 days;
        market.priceThreshold = 1000e8; // $1000 with 8 decimals
        market.priceAggregator = address(0xABCD);
        swapCastNFT = ISwapCastNFT(_swapCastNFT);
    }

    function recordPrediction(address user, PredictionTypes.Outcome outcome, uint256 convictionStakeDeclared)
        external
        payable
        returns (uint256, uint256, uint256)
    {
        return market.recordPrediction(
            user,
            outcome,
            convictionStakeDeclared,
            swapCastNFT,
            treasuryAddress,
            PROTOCOL_FEE_BASIS_POINTS,
            MIN_STAKE_AMOUNT
        );
    }

    function resolve(PredictionTypes.Outcome winningOutcome, int256 oraclePrice) external returns (uint256) {
        return market.resolve(winningOutcome, oraclePrice);
    }

    function claimReward(
        uint256 tokenId,
        PredictionTypes.Outcome predictionOutcome,
        uint256 userConvictionStake,
        address nftOwner
    ) external returns (uint256) {
        return market.claimReward(tokenId, predictionOutcome, userConvictionStake, nftOwner, swapCastNFT);
    }

    function isPastExpiration() external view returns (bool) {
        return market.isPastExpiration();
    }

    function getOutcomeFromOracle(uint256 maxPriceStaleness) external view returns (PredictionTypes.Outcome, int256) {
        return market.getOutcomeFromOracle(maxPriceStaleness);
    }

    // Helper function to set market as resolved
    function setResolved(bool _resolved) external {
        market.resolved = _resolved;
    }

    // Helper function to set expiration time
    function setExpirationTime(uint256 _expirationTime) external {
        market.expirationTime = _expirationTime;
    }

    // Helper function to set price aggregator
    function setPriceAggregator(address _priceAggregator) external {
        market.priceAggregator = _priceAggregator;
    }

    // Helper function to set user prediction status
    function setUserPredicted(address user, bool _hasPredicted) external {
        market.userHasPredicted[user] = _hasPredicted;
    }

    // Helper function to set total conviction stakes
    function setTotalConvictionStakes(uint256 outcome0, uint256 outcome1) external {
        market.totalConvictionStakeOutcome0 = outcome0;
        market.totalConvictionStakeOutcome1 = outcome1;
    }
}

// Mock implementation of ISwapCastNFT for testing
contract MockSwapCastNFT is ISwapCastNFT {
    mapping(uint256 => address) public owners;
    uint256 public nextTokenId = 1;

    function mint(address to, uint256, PredictionTypes.Outcome, uint256) external returns (uint256) {
        uint256 tokenId = nextTokenId++;
        owners[tokenId] = to;
        return tokenId;
    }

    function burn(uint256 tokenId) external {
        delete owners[tokenId];
    }

    function ownerOf(uint256 tokenId) external view returns (address) {
        return owners[tokenId];
    }

    function getPredictionDetails(uint256 _tokenId)
        external
        view
        returns (uint256 marketId, PredictionTypes.Outcome outcome, uint256 convictionStake, address owner)
    {
        // Return dummy values for testing
        return (1, PredictionTypes.Outcome.Bullish, 1 ether, owners[_tokenId]);
    }
}

contract MarketLogicTest is Test {
    MarketLogicWrapper public wrapper;
    MockSwapCastNFT public mockNFT;

    address public owner = address(0xABCD);
    address public user1 = address(0x1111);
    address public user2 = address(0x2222);

    uint256 public constant MARKET_ID = 1;

    function setUp() public {
        mockNFT = new MockSwapCastNFT();
        wrapper = new MarketLogicWrapper(MARKET_ID, address(mockNFT));

        // Fund test addresses
        vm.deal(owner, 100 ether);
        vm.deal(user1, 100 ether);
        vm.deal(user2, 100 ether);
    }

    // Test recordPrediction function
    function test_recordPrediction_Success() public {
        uint256 stakeAmount = 1 ether;
        uint256 expectedFee = (stakeAmount * wrapper.PROTOCOL_FEE_BASIS_POINTS()) / 10000;

        // Record prediction
        (uint256 netStake, uint256 fee, uint256 tokenId) = wrapper.recordPrediction{value: stakeAmount + expectedFee}(
            user1, PredictionTypes.Outcome.Bullish, stakeAmount
        );

        // Verify results
        assertEq(netStake, stakeAmount, "Net stake amount mismatch");
        assertEq(fee, expectedFee, "Fee amount mismatch");
        assertGt(tokenId, 0, "Token ID should be greater than 0");

        // Attempt to record prediction again (should revert)
        vm.expectRevert(abi.encodeWithSignature("AlreadyPredictedL(address,uint256)", user1, 1));
        wrapper.recordPrediction{value: stakeAmount + expectedFee}(user1, PredictionTypes.Outcome.Bullish, stakeAmount);
    }

    function test_recordPrediction_ExpiredMarket() public {
        // Set market as expired
        wrapper.setExpirationTime(block.timestamp - 1);

        // Attempt to record prediction
        uint256 stakeAmount = 1 ether;
        uint256 expectedFee = (stakeAmount * wrapper.PROTOCOL_FEE_BASIS_POINTS()) / 10000;

        vm.expectRevert(
            abi.encodeWithSelector(
                bytes4(keccak256("MarketExpiredL(uint256,uint256,uint256)")),
                1, // marketId
                block.timestamp - 1, // expirationTime
                block.timestamp // currentTime
            )
        );
        wrapper.recordPrediction{value: stakeAmount + expectedFee}(user1, PredictionTypes.Outcome.Bullish, stakeAmount);
    }

    function test_recordPrediction_ZeroAmount() public {
        // Attempt to record prediction with zero amount
        vm.expectRevert("AmountCannotBeZeroL()");
        wrapper.recordPrediction{value: 0}(user1, PredictionTypes.Outcome.Bullish, 0);
    }

    function test_recordPrediction_BelowMinStake() public {
        // Attempt to record prediction with amount below min stake
        uint256 stakeAmount = 0.001 ether; // Below 0.01 ether min
        uint256 expectedFee = (stakeAmount * wrapper.PROTOCOL_FEE_BASIS_POINTS()) / 10000;

        vm.expectRevert(
            abi.encodeWithSelector(
                bytes4(keccak256("StakeBelowMinimumL(uint256,uint256)")), stakeAmount, wrapper.MIN_STAKE_AMOUNT()
            )
        );
        wrapper.recordPrediction{value: stakeAmount + expectedFee}(user1, PredictionTypes.Outcome.Bullish, stakeAmount);
    }

    // Test resolve function
    function test_resolve_Success() public {
        // First record some predictions
        uint256 stakeAmount = 1 ether;
        uint256 expectedFee = (stakeAmount * wrapper.PROTOCOL_FEE_BASIS_POINTS()) / 10000;

        // User 1 predicts Bullish
        (uint256 tokenId1,,) = wrapper.recordPrediction{value: stakeAmount + expectedFee}(
            user1, PredictionTypes.Outcome.Bullish, stakeAmount
        );
        assertGt(tokenId1, 0, "Token ID should be greater than 0");

        // User 2 predicts Bearish
        wrapper.recordPrediction{value: stakeAmount + expectedFee}(user2, PredictionTypes.Outcome.Bearish, stakeAmount);

        // Set market as expired
        wrapper.setExpirationTime(block.timestamp - 1);

        // Resolve market as Bullish
        uint256 totalPrizePool = wrapper.resolve(PredictionTypes.Outcome.Bullish, 1100e8); // $1100 > $1000 threshold

        // Verify results
        assertEq(totalPrizePool, stakeAmount * 2, "Total prize pool mismatch");

        // Verify market is resolved
        (,,,, bool resolved,,,,,,) = wrapper.market();
        assertTrue(resolved, "Market should be resolved");
    }

    function test_resolve_AlreadyResolved() public {
        // Set market as resolved
        wrapper.setResolved(true);

        // Attempt to resolve again
        vm.expectRevert(
            abi.encodeWithSelector(
                bytes4(keccak256("MarketAlreadyResolvedL(uint256)")),
                1 // marketId
            )
        );
        wrapper.resolve(PredictionTypes.Outcome.Bullish, 1100e8);
    }

    // Test claimReward function
    function test_claimReward_Success() public {
        // First record some predictions
        uint256 stakeAmount = 1 ether;
        uint256 expectedFee = (stakeAmount * wrapper.PROTOCOL_FEE_BASIS_POINTS()) / 10000;

        // User 1 predicts Bullish
        (uint256 tokenId1,,) = wrapper.recordPrediction{value: stakeAmount + expectedFee}(
            user1, PredictionTypes.Outcome.Bullish, stakeAmount
        );

        // User 2 predicts Bearish
        wrapper.recordPrediction{value: stakeAmount + expectedFee}(user2, PredictionTypes.Outcome.Bearish, stakeAmount);

        // Set market as expired and resolve as Bullish
        wrapper.setExpirationTime(block.timestamp - 1);
        wrapper.resolve(PredictionTypes.Outcome.Bullish, 1100e8);

        // Claim reward for user1 (winner)
        uint256 initialBalance = user1.balance;
        uint256 reward = wrapper.claimReward(tokenId1, PredictionTypes.Outcome.Bullish, stakeAmount, user1);

        // Verify reward amount (should get stake back + share of losing pool)
        uint256 expectedReward = stakeAmount + stakeAmount; // 1:1 ratio in this case
        assertEq(reward, expectedReward, "Reward amount mismatch");
        assertEq(user1.balance, initialBalance + expectedReward, "User balance mismatch");
    }

    function test_claimReward_NotResolved() public {
        // Record a prediction
        uint256 stakeAmount = 1 ether;
        uint256 expectedFee = (stakeAmount * wrapper.PROTOCOL_FEE_BASIS_POINTS()) / 10000;

        (uint256 tokenId1,,) = wrapper.recordPrediction{value: stakeAmount + expectedFee}(
            user1, PredictionTypes.Outcome.Bullish, stakeAmount
        );

        // Attempt to claim before resolution
        vm.expectRevert(
            abi.encodeWithSelector(
                bytes4(keccak256("MarketNotResolvedL(uint256)")),
                1 // marketId
            )
        );
        wrapper.claimReward(tokenId1, PredictionTypes.Outcome.Bullish, stakeAmount, user1);
    }

    function test_claimReward_NotWinner() public {
        // Record predictions
        uint256 stakeAmount = 1 ether;
        uint256 expectedFee = (stakeAmount * wrapper.PROTOCOL_FEE_BASIS_POINTS()) / 10000;

        // User 1 predicts Bullish
        (uint256 tokenId1,,) = wrapper.recordPrediction{value: stakeAmount + expectedFee}(
            user1, PredictionTypes.Outcome.Bullish, stakeAmount
        );
        assertGt(tokenId1, 0, "Token ID should be greater than 0");

        // User 2 predicts Bearish
        wrapper.recordPrediction{value: stakeAmount + expectedFee}(user2, PredictionTypes.Outcome.Bearish, stakeAmount);

        // Resolve as Bearish (user1 loses)
        wrapper.setExpirationTime(block.timestamp - 1);
        wrapper.resolve(PredictionTypes.Outcome.Bearish, 900e8); // $900 < $1000 threshold

        // Attempt to claim with wrong outcome
        vm.expectRevert(
            abi.encodeWithSelector(
                bytes4(keccak256("NotWinningNFTL(uint256,uint8,uint8)")),
                tokenId1, // tokenId
                uint8(PredictionTypes.Outcome.Bullish), // predictedOutcome
                uint8(PredictionTypes.Outcome.Bearish) // winningOutcome
            )
        );
        wrapper.claimReward(
            tokenId1,
            PredictionTypes.Outcome.Bullish, // Wrong outcome (market resolved as Bearish)
            stakeAmount,
            user1
        );
    }

    // Test isPastExpiration function
    function test_isPastExpiration() public {
        // Market is not expired
        assertFalse(wrapper.isPastExpiration(), "Market should not be expired");

        // Move time forward past expiration
        vm.warp(block.timestamp + 2 days);
        assertTrue(wrapper.isPastExpiration(), "Market should be expired");
    }

    // Test getOutcomeFromOracle function
    function test_getOutcomeFromOracle() public {
        // This would require mocking the Chainlink aggregator
        // For now, we'll just test that it reverts with the expected error

        // Test with zero address price aggregator
        wrapper.setPriceAggregator(address(0));
        vm.expectRevert(abi.encodeWithSignature("InvalidPriceAggregator()"));
        wrapper.getOutcomeFromOracle(3600);
    }
}
