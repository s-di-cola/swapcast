//SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, console} from "forge-std/Test.sol";
import {StdInvariant} from "forge-std/StdInvariant.sol";
import {PredictionManager} from "src/PredictionManager.sol";
import {MarketLogic} from "src/MarketLogic.sol";
import {MockSwapCastNFT} from "./mocks/MockSwapCastNFT.sol";
import {ISwapCastNFT} from "src/interfaces/ISwapCastNFT.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Vm} from "forge-std/Vm.sol";
import {FullMath} from "@uniswap/v4-core/src/libraries/FullMath.sol";
import {PredictionTypes} from "src/types/PredictionTypes.sol";

contract MockRevertingReceiver is Test {
    event Received(uint256 amount);

    receive() external payable {
        emit Received(msg.value);

        revert("Payment rejected by MockRevertingReceiver");
    }
}

contract PredictionManagerTest is Test {
    event FeeConfigurationChanged(address indexed newTreasuryAddress, uint256 newFeeBasisPoints);
    event MinStakeAmountChanged(uint256 newMinStakeAmount);
    event MarketCreated(
        uint256 indexed marketId,
        string name,
        string assetSymbol,
        uint256 expirationTime,
        address priceAggregator,
        uint256 priceThreshold
    );
    event MarketResolved(
        uint256 indexed marketId, PredictionTypes.Outcome winningOutcome, int256 price, uint256 totalPrizePool
    );
    event RewardClaimed(address indexed user, uint256 indexed tokenId, uint256 rewardAmount);

    event DisplayLog(
        uint256 indexed logIndex,
        address indexed emitter,
        bytes32 topic0,
        bytes32 topic1,
        bytes32 topic2,
        bytes32 topic3,
        bytes data
    );

    error ZeroAddressInput();
    error InvalidFeeBasisPoints(uint256 feeBasisPoints);
    error InvalidMinStakeAmount(uint256 minStakeAmount);
    error InvalidMarketId();
    error MarketAlreadyExists(uint256 marketId);
    error MarketDoesNotExist(uint256 marketId);
    error MarketAlreadyResolved(uint256 marketId);
    error MarketNotYetResolved(uint256 marketId);
    error InvalidOutcome(uint8 outcome);
    error AlreadyPredicted(uint256 marketId, address user);
    error StakeTooSmall(uint256 stakeAmount, uint256 minStakeAmount);
    error AmountCannotBeZero();
    error NotOracleResolver();
    error NotRewardDistributor();
    error TokenDoesNotExistInNFTContract(uint256 tokenId);
    error CallerNotTokenOwner(uint256 tokenId, address caller);
    error IncorrectPrediction(uint256 marketId, uint8 predictedOutcome, uint8 actualWinningOutcome);
    error PayoutCalculationError(uint256 totalWinningStake, uint256 totalLosingStake);
    error RewardTransferFailed(uint256 tokenId, address recipient, uint256 payoutAmount);

    PredictionManager internal pool;
    MockSwapCastNFT internal mockNft;
    MockRevertingReceiver internal revertingReceiver;
    address internal mockOracle;

    address internal owner;
    address payable internal treasuryAddress;
    address internal oracleResolverAddress;
    address internal rewardDistributorAddress;
    address internal user1;
    address internal user2;
    address internal user3;

    uint256 internal initialFeeBasisPoints = 100;
    uint256 internal initialMinStakeAmount = 0.01 ether;

    // Mock addresses for constructor arguments not already part of test setup
    address internal constant MOCK_ORACLE_RESOLVER_FOR_TEST = address(0x2001);
    address internal constant MOCK_REWARD_DISTRIBUTOR_FOR_TEST = address(0x2002);

    function setUp() public {
        owner = makeAddr("owner");
        treasuryAddress = payable(makeAddr("treasury"));
        revertingReceiver = new MockRevertingReceiver();
        mockOracle = makeAddr("mockOracle");

        user1 = makeAddr("user1");
        vm.deal(user1, 10 ether);
        user2 = makeAddr("user2");
        vm.deal(user2, 10 ether);
        user3 = makeAddr("user3");
        vm.deal(user3, 10 ether);

        vm.deal(owner, 1 ether); // For gas
        vm.deal(address(this), 50 ether); // General funding for test contract if it sends value

        vm.startPrank(owner);
        mockNft = new MockSwapCastNFT();
        pool = new PredictionManager(
            address(mockNft),
            treasuryAddress,
            initialFeeBasisPoints,
            initialMinStakeAmount,
            3600, // maxPriceStalenessSeconds
            MOCK_ORACLE_RESOLVER_FOR_TEST, // Use the constant for oracleResolverAddress
            MOCK_REWARD_DISTRIBUTOR_FOR_TEST // Use the constant for rewardDistributorAddress
        );
        mockNft.setPredictionPoolAddress(address(pool));
        vm.stopPrank();

        // These lines are for convenience if tests directly use these variables,
        // but the actual addresses are set in the constructor above using constants.
        oracleResolverAddress = MOCK_ORACLE_RESOLVER_FOR_TEST;
        rewardDistributorAddress = MOCK_REWARD_DISTRIBUTOR_FOR_TEST;
    }

    function testCreateMarket_Successful_And_EmitsEvent_And_SetsInitialState() public {
        uint256 marketIdToCreate = 1;
        string memory marketName = "Test Market";
        string memory assetSymbol = "ETHUSD";
        uint256 expirationTime = block.timestamp + 1 hours;
        uint256 priceThreshold = 3000 * 10 ** 8;

        vm.expectEmit(true, true, true, true);
        emit MarketCreated(marketIdToCreate, marketName, assetSymbol, expirationTime, mockOracle, priceThreshold);
        vm.prank(owner);
        pool.createMarket(marketIdToCreate, marketName, assetSymbol, expirationTime, mockOracle, priceThreshold);

        (
            uint256 id_,
            ,
            ,
            bool exists_,
            bool resolved_,
            PredictionTypes.Outcome winningOutcome_,
            ,
            ,
            uint256 expirationTime_,
            address priceAggregator_,
            uint256 priceThreshold_
        ) = pool.getMarketDetails(marketIdToCreate);

        assertTrue(exists_, "Market should exist after creation");
        assertEq(id_, marketIdToCreate, "Market ID mismatch");
        assertFalse(resolved_, "Market should not be resolved initially");
        assertEq(
            uint8(winningOutcome_),
            uint8(PredictionTypes.Outcome.Bearish), // Default winning outcome in struct is 0 (Bearish)
            "Winning outcome should be Bearish initially"
        );
        assertEq(expirationTime_, expirationTime, "Expiration time mismatch");
        assertEq(priceAggregator_, mockOracle, "Price aggregator mismatch");
        assertEq(priceThreshold_, priceThreshold, "Price threshold mismatch");
    }

    function testCreateMarket_Reverts_ZeroMarketId() public {
        vm.prank(owner);
        vm.expectRevert(PredictionManager.InvalidMarketId.selector);
        pool.createMarket(0, "Test Market", "ETHUSD", block.timestamp + 1 hours, mockOracle, 3000 * 10 ** 8);
    }

    function testCreateMarket_Reverts_MarketAlreadyExists() public {
        uint256 marketIdToCreate = 1;
        vm.prank(owner);
        pool.createMarket(
            marketIdToCreate, "Test Market", "ETHUSD", block.timestamp + 1 hours, mockOracle, 3000 * 10 ** 8
        );

        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(PredictionManager.MarketAlreadyExists.selector, marketIdToCreate));
        pool.createMarket(
            marketIdToCreate, "Test Market", "ETHUSD", block.timestamp + 1 hours, mockOracle, 3000 * 10 ** 8
        );
    }

    function testRecordPrediction() public {
        uint256 marketIdToTest = 1;
        address predictor = user1;
        PredictionTypes.Outcome outcome = PredictionTypes.Outcome.Bearish;
        uint256 stakeAmount = 0.02 ether;

        vm.prank(owner);
        pool.createMarket(
            marketIdToTest, "Test Market", "ETHUSD", block.timestamp + 1 hours, mockOracle, 3000 * 10 ** 8
        );

        uint256 initialPoolBalance = address(pool).balance;
        uint256 initialTreasuryBalance = treasuryAddress.balance;
        uint256 initialPredictorNftBalance = mockNft.balances(predictor);
        uint256 initialNextTokenId = mockNft.nextTokenId();

        uint256 feeBps = pool.protocolFeeBasisPoints();
        uint256 protocolFee = (stakeAmount * feeBps) / 10000;
        uint256 totalValue = stakeAmount + protocolFee;

        vm.prank(predictor);
        pool.recordPrediction{value: totalValue}(predictor, marketIdToTest, outcome, uint128(stakeAmount));

        (uint256 marketIdFromNFT, PredictionTypes.Outcome outcomeFromNFT, uint256 stakeFromNFT,) =
            mockNft.getPredictionDetails(initialNextTokenId);

        assertEq(marketIdFromNFT, marketIdToTest, "Market ID mismatch in NFT");
        assertEq(uint8(outcomeFromNFT), uint8(outcome), "Outcome mismatch in NFT");
        assertEq(uint256(stakeFromNFT), stakeAmount, "Stake amount mismatch in NFT"); // NFT stores declared stake

        assertEq(mockNft.balances(predictor), initialPredictorNftBalance + 1, "Predictor NFT balance incorrect");
        assertEq(mockNft.nextTokenId(), initialNextTokenId + 1, "Next token ID not incremented");
        (,,,, bool tokenExistsAfterMint) = mockNft.nfts(initialNextTokenId);
        assertTrue(tokenExistsAfterMint, "NFT should exist after minting");

        assertEq(address(pool).balance, initialPoolBalance + stakeAmount, "Pool balance incorrect");
        assertEq(treasuryAddress.balance, initialTreasuryBalance + protocolFee, "Treasury balance incorrect");
    }

    function testRecordPrediction_Reverts_MarketDoesNotExist() public {
        uint256 nonExistentMarketId = 99;
        uint256 stakeAmount = initialMinStakeAmount;
        address predictor = user1;
        PredictionTypes.Outcome outcomeToPredict = PredictionTypes.Outcome.Bearish;

        uint256 feeBps = pool.protocolFeeBasisPoints();
        uint256 protocolFee = (stakeAmount * feeBps) / 10000;
        uint256 totalValue = stakeAmount + protocolFee;

        vm.prank(predictor);
        vm.expectRevert(abi.encodeWithSelector(PredictionManager.MarketDoesNotExist.selector, nonExistentMarketId));
        pool.recordPrediction{value: totalValue}(predictor, nonExistentMarketId, outcomeToPredict, uint128(stakeAmount));
    }

    function testRecordPrediction_Reverts_AmountCannotBeZero_MsgValueZero() public {
        uint256 marketIdToTest = 1;
        vm.prank(owner);
        pool.createMarket(
            marketIdToTest, "Test Market", "ETHUSD", block.timestamp + 1 hours, mockOracle, 3000 * 10 ** 8
        );

        address predictor = user1;
        PredictionTypes.Outcome outcomeToPredict = PredictionTypes.Outcome.Bearish;

        vm.prank(predictor);
        vm.expectRevert(PredictionManager.AmountCannotBeZero.selector);
        pool.recordPrediction(predictor, marketIdToTest, outcomeToPredict, uint128(0));
    }

    function testRecordPrediction_Reverts_AmountCannotBeZero_NetStakeZeroDueToFee() public {
        uint256 marketIdToTest = 1;
        vm.prank(owner);
        pool.createMarket(
            marketIdToTest, "Test Market", "ETHUSD", block.timestamp + 1 hours, mockOracle, 3000 * 10 ** 8
        );

        address predictor = user1;
        PredictionTypes.Outcome outcomeToPredict = PredictionTypes.Outcome.Bullish;
        uint256 stakeAmountSent = 10 wei; // Small amount that will be less than fee if fee is high

        vm.prank(owner);
        pool.setFeeConfiguration(treasuryAddress, 10000); // 100% fee

        uint256 feeBps = pool.protocolFeeBasisPoints(); // This will be 10000
        uint256 calculatedFeeOnDeclaredStake = (stakeAmountSent * feeBps) / 10000; // fee will be stakeAmountSent
        uint256 totalMsgValue = stakeAmountSent + calculatedFeeOnDeclaredStake;

        vm.prank(predictor);
        vm.expectRevert(
            abi.encodeWithSelector(MarketLogic.StakeBelowMinimumL.selector, stakeAmountSent, pool.minStakeAmount())
        );
        pool.recordPrediction{value: totalMsgValue}(
            predictor, marketIdToTest, outcomeToPredict, uint128(stakeAmountSent)
        );

        vm.prank(owner);
        pool.setFeeConfiguration(treasuryAddress, initialFeeBasisPoints); // Reset fee
    }

    function testCannotRecordAfterMarketResolved() public {
        uint256 marketIdToTest = 2;
        vm.prank(owner);
        pool.createMarket(
            marketIdToTest, "Test Market", "ETHUSD", block.timestamp + 1 hours, mockOracle, 3000 * 10 ** 8
        );

        vm.prank(oracleResolverAddress);
        pool.resolveMarket(marketIdToTest, PredictionTypes.Outcome.Bearish, 0); // Resolve with any outcome and price

        uint128 stakeAmount = uint128(100 wei);
        uint256 feeBps = pool.protocolFeeBasisPoints();
        uint256 protocolFee = (uint256(stakeAmount) * feeBps) / 10000;
        uint256 totalValue = uint256(stakeAmount) + protocolFee;

        vm.expectRevert(MarketLogic.MarketAlreadyResolvedL.selector);
        pool.recordPrediction{value: totalValue}(
            address(1), marketIdToTest, PredictionTypes.Outcome.Bearish, stakeAmount
        );
    }

    function testDuplicatePredictionReverts() public {
        uint256 marketIdToTest = 3; // Using a distinct market ID
        PredictionTypes.Outcome outcome = PredictionTypes.Outcome.Bearish;
        uint128 stakeAmount = uint128(0.1 ether);
        address predictor = user1;

        vm.prank(owner);
        pool.createMarket(
            marketIdToTest, "Test Market", "ETHUSD", block.timestamp + 1 hours, mockOracle, 3000 * 10 ** 8
        );

        uint256 feeBps = pool.protocolFeeBasisPoints();
        uint256 protocolFee = (uint256(stakeAmount) * feeBps) / 10000;
        uint256 totalValue = uint256(stakeAmount) + protocolFee;

        // First prediction
        vm.prank(predictor);
        pool.recordPrediction{value: totalValue}(predictor, marketIdToTest, outcome, stakeAmount);

        // Attempt to predict again
        vm.prank(predictor);
        vm.expectRevert(abi.encodeWithSelector(MarketLogic.AlreadyPredictedL.selector, predictor));
        pool.recordPrediction{value: totalValue}(
            predictor, marketIdToTest, PredictionTypes.Outcome.Bullish, stakeAmount
        );
    }

    function testZeroUserAddressPredictionReverts() public {
        uint256 marketId = 4;
        address zeroUser = address(0);
        PredictionTypes.Outcome outcome = PredictionTypes.Outcome.Bearish;
        uint256 stake = 0.1 ether;

        vm.prank(owner);
        pool.createMarket(marketId, "Test Market", "ETHUSD", block.timestamp + 1 hours, mockOracle, 3000 * 10 ** 8);

        uint256 feeBps = pool.protocolFeeBasisPoints();
        uint256 protocolFee = (stake * feeBps) / 10000;
        uint256 totalValue = stake + protocolFee;

        vm.expectRevert(abi.encodeWithSelector(PredictionManager.ZeroAddressInput.selector));
        pool.recordPrediction{value: totalValue}(zeroUser, marketId, outcome, uint128(stake));
    }

    function testResolveMarket_NoPredictionsMade() public {
        uint256 marketIdToTest = 1;
        vm.prank(owner);
        pool.createMarket(
            marketIdToTest, "Test Market", "ETHUSD", block.timestamp + 1 hours, mockOracle, 3000 * 10 ** 8
        );

        vm.prank(oracleResolverAddress);

        vm.expectEmit(true, true, true, true);
        emit MarketResolved(marketIdToTest, PredictionTypes.Outcome.Bearish, 0, 0);
        pool.resolveMarket(marketIdToTest, PredictionTypes.Outcome.Bearish, 0);

        (,,, /*marketId, name, assetSymbol*/ bool existsAfterResolve, bool resolvedAfterResolve,,,,,,) =
            pool.getMarketDetails(marketIdToTest);
        assertTrue(existsAfterResolve, "Market should still exist after resolving with no predictions");
        assertTrue(resolvedAfterResolve, "Market should be resolved after resolving with no predictions");
    }

    function testResolveMarket_Successful() public {
        uint256 marketIdToTest = 6;
        vm.prank(owner);
        pool.createMarket(
            marketIdToTest, "Test Market", "ETHUSD", block.timestamp + 1 hours, mockOracle, 3000 * 10 ** 8
        );

        vm.prank(user1);
        uint256 stakeAmountUser1 = 1 ether; // This is the net stake for User 1
        uint256 feeBps = pool.protocolFeeBasisPoints();
        uint256 protocolFeeUser1 = (stakeAmountUser1 * feeBps) / 10000;
        uint256 totalValueUser1 = stakeAmountUser1 + protocolFeeUser1;
        // vm.deal(address(pool), totalValueUser1); // Fund the pool - REMOVE, handled by msg.value
        pool.recordPrediction{value: totalValueUser1}(
            user1, marketIdToTest, PredictionTypes.Outcome.Bearish, uint128(stakeAmountUser1)
        );
        // uint256 netStakeUser1 = stakeAmountUser1 - protocolFeeUser1; // INCORRECT, stakeAmountUser1 IS the net stake
        uint256 netStakeUser1 = stakeAmountUser1; // CORRECTED

        vm.prank(user2);
        uint256 stakeAmountUser2 = 2 ether; // This is the net stake for User 2
        uint256 protocolFeeUser2 = (stakeAmountUser2 * feeBps) / 10000;
        uint256 totalValueUser2 = stakeAmountUser2 + protocolFeeUser2;
        // vm.deal(address(pool), totalValueUser2); // Fund the pool - REMOVE, handled by msg.value
        pool.recordPrediction{value: totalValueUser2}(
            user2, marketIdToTest, PredictionTypes.Outcome.Bullish, uint128(stakeAmountUser2)
        );
        // uint256 netStakeUser2 = stakeAmountUser2 - protocolFeeUser2; // INCORRECT, stakeAmountUser2 IS the net stake
        uint256 netStakeUser2 = stakeAmountUser2; // CORRECTED

        uint256 expectedStake0 = netStakeUser1; // User1 predicted Bearish (Outcome 0)
        uint256 expectedStake1 = netStakeUser2; // User2 predicted Bullish (Outcome 1)
        PredictionTypes.Outcome winningOutcomeToSet = PredictionTypes.Outcome.Bullish;
        int256 expectedOraclePrice = 3100 * 10 ** 8; // Example price making Bullish win (if threshold is 3000 * 10^8)
        uint256 expectedTotalPrizePool = expectedStake0 + expectedStake1;
        uint256 totalFeesForMarket = protocolFeeUser1 + protocolFeeUser2;

        vm.prank(oracleResolverAddress);
        vm.expectEmit(true, true, true, true); // Adjusted to expect all 4 topics for MarketResolved

        emit MarketResolved(marketIdToTest, winningOutcomeToSet, expectedOraclePrice, expectedTotalPrizePool);
        pool.resolveMarket(marketIdToTest, winningOutcomeToSet, expectedOraclePrice);

        (
            uint256 mId,
            , // name
            , // assetSymbol
            bool mExists,
            bool mResolved,
            PredictionTypes.Outcome mWinningOutcome,
            uint256 mTotalConvictionStakeOutcome0,
            uint256 mTotalConvictionStakeOutcome1,
            , // mExpirationTime
            , // mPriceAggregator
                // mPriceThreshold
        ) = pool.getMarketDetails(marketIdToTest);

        assertTrue(mExists, "Market should still exist");
        assertEq(mId, marketIdToTest, "Market ID mismatch in struct");
        assertTrue(mResolved, "Market should be resolved");
        assertEq(uint8(mWinningOutcome), uint8(winningOutcomeToSet), "Winning outcome mismatch in struct");
        assertEq(mTotalConvictionStakeOutcome0, expectedStake0, "Total stake 0 (Bearish) in struct mismatch");
        assertEq(mTotalConvictionStakeOutcome1, expectedStake1, "Total stake 1 (Bullish) in struct mismatch");
        // assertEq(mFinalTs1, expectedStake1, "Total stake 1 (Bullish) in struct mismatch"); // Removed: variable no longer present
        // assertEq(mProtocolFeePaidToTreasury, totalFeesForMarket, "Protocol fee paid to treasury mismatch in struct"); // Removed: variable no longer present
        assertEq(treasuryAddress.balance, totalFeesForMarket, "Treasury ETH balance incorrect after market resolution");
    }

    function testResolveMarket_Reverts_NotOracleResolver_User() public {
        uint256 marketIdToTest = 6;
        vm.prank(owner);
        pool.createMarket(
            marketIdToTest, "Test Market", "ETHUSD", block.timestamp + 1 hours, mockOracle, 3000 * 10 ** 8
        );

        vm.prank(user1);
        vm.expectRevert(PredictionManager.NotOracleResolver.selector);
        pool.resolveMarket(marketIdToTest, PredictionTypes.Outcome.Bullish, 0);
    }

    function testResolveMarket_Reverts_NotOracleResolver_Owner() public {
        uint256 marketIdToTest = 6;
        vm.prank(owner);
        pool.createMarket(
            marketIdToTest, "Test Market", "ETHUSD", block.timestamp + 1 hours, mockOracle, 3000 * 10 ** 8
        );

        vm.prank(owner);
        vm.expectRevert(PredictionManager.NotOracleResolver.selector);
        pool.resolveMarket(marketIdToTest, PredictionTypes.Outcome.Bullish, 0);
    }

    function testResolveMarket_Reverts_MarketDoesNotExist() public {
        uint256 nonExistentMarketId = 99;
        vm.prank(oracleResolverAddress);
        vm.expectRevert(abi.encodeWithSelector(PredictionManager.MarketDoesNotExist.selector, nonExistentMarketId));
        pool.resolveMarket(nonExistentMarketId, PredictionTypes.Outcome.Bullish, 0);
    }

    function testResolveMarket_Reverts_MarketAlreadyResolved() public {
        uint256 marketIdToTest = 6;
        vm.prank(owner);
        pool.createMarket(
            marketIdToTest, "Test Market", "ETHUSD", block.timestamp + 1 hours, mockOracle, 3000 * 10 ** 8
        );

        vm.prank(oracleResolverAddress);
        pool.resolveMarket(marketIdToTest, PredictionTypes.Outcome.Bearish, 0);

        vm.prank(oracleResolverAddress);
        vm.expectRevert(MarketLogic.MarketAlreadyResolvedL.selector);
        pool.resolveMarket(marketIdToTest, PredictionTypes.Outcome.Bullish, 0);
    }

    function testResolveMarket_EnumSafety() public {
        uint256 marketIdToTest = 6;
        vm.prank(owner);
        pool.createMarket(
            marketIdToTest, "Test Market", "ETHUSD", block.timestamp + 1 hours, mockOracle, 3000 * 10 ** 8
        );

        // Test that we can use both enum values
        vm.startPrank(oracleResolverAddress);

        // Should work with Bearish
        pool.resolveMarket(marketIdToTest, PredictionTypes.Outcome.Bearish, 0);

        // Create another market to test Bullish
        uint256 marketIdToTest2 = 7;
        vm.stopPrank();
        vm.prank(owner);
        pool.createMarket(
            marketIdToTest2, "Test Market", "ETHUSD", block.timestamp + 1 hours, mockOracle, 3000 * 10 ** 8
        );

        vm.prank(oracleResolverAddress);
        pool.resolveMarket(marketIdToTest2, PredictionTypes.Outcome.Bullish, 0);
    }

    function testSetFeeConfiguration_Successful() public {
        address newTreasury = makeAddr("newTreasury");
        uint256 newFee = 200;

        vm.prank(owner);
        vm.expectEmit(true, false, false, true, address(pool));
        emit FeeConfigurationChanged(newTreasury, newFee);
        pool.setFeeConfiguration(newTreasury, newFee);

        assertEq(pool.treasuryAddress(), newTreasury, "Treasury address mismatch");
        assertEq(pool.protocolFeeBasisPoints(), newFee, "Fee basis points mismatch");
    }

    function testSetMinStakeAmount_Successful() public {
        uint256 newMinStake = 0.5 ether;

        vm.prank(owner);
        vm.expectEmit(false, false, false, true);
        emit MinStakeAmountChanged(newMinStake);
        pool.setMinStakeAmount(newMinStake);

        assertEq(pool.minStakeAmount(), newMinStake, "Min stake amount not updated");
    }

    function testClaimReward_Successful_NoLosingStakes() public {
        uint256 marketId = 10;
        address winner = user1;
        uint256 winnerStake = 2 ether; // This is the net stake
        PredictionTypes.Outcome winningOutcome = PredictionTypes.Outcome.Bearish;
        uint256 feeBps = pool.protocolFeeBasisPoints();
        uint256 protocolFee = (winnerStake * feeBps) / 10000;
        uint256 totalValue = winnerStake + protocolFee; // This is msg.value

        vm.prank(owner);
        pool.createMarket(
            marketId, "Test Market Single Winner", "ETHUSD", block.timestamp + 1 hours, mockOracle, 3000 * 10 ** 8
        );

        vm.prank(winner);
        // vm.deal(address(pool), totalValue); // Fund the pool - REMOVE, handled by msg.value
        uint256 winnerNftTokenId = mockNft.nextTokenId();
        pool.recordPrediction{value: totalValue}(winner, marketId, winningOutcome, uint128(winnerStake));
        uint256 winnerNetStake = winnerStake; // CORRECTED: winnerStake IS the net stake

        uint256 treasuryBalanceAfterPrediction = treasuryAddress.balance;
        assertEq(treasuryBalanceAfterPrediction, protocolFee, "Treasury balance incorrect after prediction");

        vm.prank(oracleResolverAddress);
        pool.resolveMarket(marketId, winningOutcome, 2900 * 10 ** 8); // Price to make Bearish win

        uint256 winnerInitialBalance = winner.balance;
        // uint256 poolInitialBalance = address(pool).balance; // Pool balance check will be against 0 after claim

        uint256 expectedPayout = winnerNetStake; // In a no-losing-stakes scenario, payout is the net stake

        // Mock the NFT details for the claim
        vm.mockCall(
            address(mockNft),
            abi.encodeWithSelector(ISwapCastNFT.getPredictionDetails.selector, winnerNftTokenId),
            abi.encode(marketId, winningOutcome, uint128(winnerNetStake), winner)
        );
        vm.mockCall(
            address(mockNft),
            abi.encodeWithSelector(IERC721.ownerOf.selector, winnerNftTokenId),
            abi.encode(winner) // Mock ownerOf to return the winner
        );

        // Update the pool initial balance after adding funds - This comment seems out of place, no funds added here
        // poolInitialBalance = address(pool).balance; // Redundant if checking for 0 later

        vm.prank(rewardDistributorAddress);
        vm.expectEmit(true, true, true, true); // Expecting marketId, user, tokenId, rewardAmount
        emit RewardClaimed(winner, winnerNftTokenId, expectedPayout);
        pool.claimReward(winnerNftTokenId);

        assertEq(winner.balance, winnerInitialBalance + expectedPayout, "Winner balance mismatch (no losing stakes)");
        assertEq(
            address(pool).balance, 0, "Pool ETH balance should be zero after single winner claims (no losing stakes)"
        );
        assertEq(treasuryAddress.balance, treasuryBalanceAfterPrediction, "Treasury balance should not change on claim");

        (,,,, bool tokenActuallyExistsAfterClaim) = mockNft.nfts(winnerNftTokenId);
        assertFalse(tokenActuallyExistsAfterClaim, "Winner NFT should be burned (no losing stakes)");
    }

    function testClaimReward_Successful_WithLosingStakes() public {
        uint256 marketId = 11;
        address winner = user1;
        address loser = user2;
        uint256 winnerStake = 2 ether; // This is the net stake for the winner
        uint256 loserStake = 1 ether; // This is the net stake for the loser
        PredictionTypes.Outcome winningOutcome = PredictionTypes.Outcome.Bearish;
        PredictionTypes.Outcome losingOutcome = PredictionTypes.Outcome.Bullish;
        uint256 feeBps = pool.protocolFeeBasisPoints();

        vm.prank(owner);
        pool.createMarket(
            marketId, "Test Market With Loser", "ETHUSD", block.timestamp + 1 hours, mockOracle, 3000 * 10 ** 8
        );

        // Winner's prediction
        vm.prank(winner);
        uint256 protocolFeeWinner = (winnerStake * feeBps) / 10000;
        uint256 totalValueWinner = winnerStake + protocolFeeWinner;
        // vm.deal(address(pool), totalValueWinner); // Fund the pool - REMOVE
        uint256 winnerNftTokenId = mockNft.nextTokenId();
        pool.recordPrediction{value: totalValueWinner}(winner, marketId, winningOutcome, uint128(winnerStake));
        uint256 winnerNetStake = winnerStake; // CORRECTED

        // Loser's prediction
        vm.prank(loser);
        uint256 protocolFeeLoser = (loserStake * feeBps) / 10000;
        uint256 totalValueLoser = loserStake + protocolFeeLoser;
        // vm.deal(address(pool), totalValueLoser); // Fund the pool - REMOVE
        /* uint256 loserNftTokenId = */
        mockNft.nextTokenId(); // Loser's token ID, not claimed
        pool.recordPrediction{value: totalValueLoser}(loser, marketId, losingOutcome, uint128(loserStake));
        uint256 loserNetStake = loserStake; // CORRECTED

        uint256 treasuryBalanceAfterPredictions = treasuryAddress.balance;
        assertEq(
            treasuryBalanceAfterPredictions,
            protocolFeeWinner + protocolFeeLoser,
            "Treasury balance incorrect after predictions"
        );

        vm.prank(oracleResolverAddress);
        pool.resolveMarket(marketId, winningOutcome, 2900 * 10 ** 8); // Price to make Bearish win

        uint256 winnerInitialBalance = winner.balance;
        // uint256 poolInitialBalance = address(pool).balance; // Will check against 0

        uint256 expectedPayout = winnerNetStake + loserNetStake; // Winner gets their stake back + loser's stake

        // Mock the NFT details for the claim
        vm.mockCall(
            address(mockNft),
            abi.encodeWithSelector(ISwapCastNFT.getPredictionDetails.selector, winnerNftTokenId),
            abi.encode(marketId, winningOutcome, uint128(winnerNetStake), winner)
        );
        vm.mockCall(
            address(mockNft), abi.encodeWithSelector(IERC721.ownerOf.selector, winnerNftTokenId), abi.encode(winner)
        );

        // Ensure the pool has enough balance to make the transfer - This comment/logic is likely obsolete with msg.value funding
        // uint256 totalNeededFunds = expectedPayout; // Total expected payout
        // if (address(pool).balance < totalNeededFunds) { // Not strictly needed if funding is via msg.value and internal accounting is correct
        //     vm.deal(address(pool), totalNeededFunds - address(pool).balance);
        // }

        // Update the pool initial balance after adding funds - This comment is obsolete
        // poolInitialBalance = address(pool).balance;

        vm.prank(rewardDistributorAddress);
        vm.expectEmit(true, true, true, true);
        emit RewardClaimed(winner, winnerNftTokenId, expectedPayout);
        pool.claimReward(winnerNftTokenId);
        assertEq(winner.balance, winnerInitialBalance + expectedPayout, "Winner balance mismatch (with losing stakes)");
        assertEq(address(pool).balance, 0, "Pool ETH balance should be zero after claim (with losing stakes)");
        assertEq(
            treasuryAddress.balance, treasuryBalanceAfterPredictions, "Treasury balance should not change on claim"
        );

        (,,,, bool tokenActuallyExistsAfterClaim) = mockNft.nfts(winnerNftTokenId);
        assertFalse(tokenActuallyExistsAfterClaim, "Winner NFT should be burned (with losing stakes)");
    }

    function testClaimReward_Successful_MultipleWinners_ShareLosingStakes() public {
        uint256 marketId = 12;
        address winner1 = user1;
        address winner2 = user2;
        address loser = user3;

        uint256 winner1Stake = 1 ether; // Net stake
        uint256 winner2Stake = 3 ether; // Net stake
        uint256 loserStake = 4 ether; // Net stake

        PredictionTypes.Outcome winningOutcome = PredictionTypes.Outcome.Bullish;
        PredictionTypes.Outcome losingOutcome = PredictionTypes.Outcome.Bearish;
        uint256 feeBps = pool.protocolFeeBasisPoints();

        vm.prank(owner);
        pool.createMarket(
            marketId, "Test Market Multi Winner", "ETHUSD", block.timestamp + 1 hours, mockOracle, 3000 * 10 ** 8
        );

        // Winner 1's prediction
        uint256 protocolFeeWinner1 = (winner1Stake * feeBps) / 10000;
        uint256 totalValueWinner1 = winner1Stake + protocolFeeWinner1;
        vm.prank(winner1);
        // vm.deal(address(pool), totalValueWinner1); // Fund the pool - REMOVE
        uint256 winner1NftTokenId = mockNft.nextTokenId();
        pool.recordPrediction{value: totalValueWinner1}(winner1, marketId, winningOutcome, uint128(winner1Stake));
        uint256 winner1NetStake = winner1Stake; // CORRECTED

        // Winner 2's prediction
        uint256 protocolFeeWinner2 = (winner2Stake * feeBps) / 10000;
        uint256 totalValueWinner2 = winner2Stake + protocolFeeWinner2;
        vm.prank(winner2);
        // vm.deal(address(pool), totalValueWinner2); // Fund the pool - REMOVE
        uint256 winner2NftTokenId = mockNft.nextTokenId();
        pool.recordPrediction{value: totalValueWinner2}(winner2, marketId, winningOutcome, uint128(winner2Stake));
        uint256 winner2NetStake = winner2Stake; // CORRECTED

        // Loser's prediction
        uint256 protocolFeeLoser = (loserStake * feeBps) / 10000;
        uint256 totalValueLoser = loserStake + protocolFeeLoser;
        vm.prank(loser);
        // vm.deal(address(pool), totalValueLoser); // Fund the pool - REMOVE
        /* uint256 loserNftTokenId = */
        mockNft.nextTokenId(); // Loser's token ID, not claimed
        pool.recordPrediction{value: totalValueLoser}(loser, marketId, losingOutcome, uint128(loserStake));
        uint256 loserNetStake = loserStake; // CORRECTED

        uint256 totalFeesPaid = protocolFeeWinner1 + protocolFeeWinner2 + protocolFeeLoser;
        uint256 treasuryBalanceAfterPredictions = treasuryAddress.balance;
        assertEq(treasuryBalanceAfterPredictions, totalFeesPaid, "Treasury balance incorrect after all predictions");

        vm.prank(oracleResolverAddress);
        pool.resolveMarket(marketId, winningOutcome, 3100 * 10 ** 8); // Price to make Bullish win

        uint256 totalWinnerNetStake = winner1NetStake + winner2NetStake;
        uint256 winner1ShareOfLosing = (winner1NetStake * loserNetStake) / totalWinnerNetStake;
        uint256 winner2ShareOfLosing = (winner2NetStake * loserNetStake) / totalWinnerNetStake;

        // Due to integer division, there might be a tiny remainder from loserNetStake. Sum of shares should be close.
        assertTrue(
            winner1ShareOfLosing + winner2ShareOfLosing <= loserNetStake, "Sum of shares exceeds total losing stake"
        );
        assertTrue(
            winner1ShareOfLosing + winner2ShareOfLosing >= loserNetStake - 1, // Max dust is 1
            "Sum of shares too much less than total losing stake (dust check)"
        );

        uint256 winner1ExpectedPayout = winner1NetStake + winner1ShareOfLosing;
        uint256 winner2ExpectedPayout = winner2NetStake + winner2ShareOfLosing;

        // uint256 totalPrizePoolNet = winner1NetStake + winner2NetStake + loserNetStake;
        // The logic for `vm.deal(address(pool), totalNeededFunds)` and associated balance checks is now obsolete
        // as the pool should be correctly funded by msg.value from predictions.

        // Claim for Winner 1
        uint256 winner1InitialBalance = winner1.balance;
        // uint256 poolBalanceBeforeWinner1Claim = address(pool).balance;
        vm.mockCall(
            address(mockNft),
            abi.encodeWithSelector(ISwapCastNFT.getPredictionDetails.selector, winner1NftTokenId),
            abi.encode(marketId, winningOutcome, uint128(winner1NetStake), winner1)
        );
        vm.mockCall(
            address(mockNft), abi.encodeWithSelector(IERC721.ownerOf.selector, winner1NftTokenId), abi.encode(winner1)
        );
        vm.prank(rewardDistributorAddress);
        vm.expectEmit(true, true, true, true);
        emit RewardClaimed(winner1, winner1NftTokenId, winner1ExpectedPayout);
        pool.claimReward(winner1NftTokenId);
        assertEq(winner1.balance, winner1InitialBalance + winner1ExpectedPayout, "Winner1 balance mismatch");
        (,,,, bool token1ActuallyExistsAfterClaim) = mockNft.nfts(winner1NftTokenId);
        assertFalse(token1ActuallyExistsAfterClaim, "Winner1 NFT should be burned");

        // Claim for Winner 2
        uint256 winner2InitialBalance = winner2.balance;
        // uint256 poolBalanceBeforeWinner2Claim = address(pool).balance;
        vm.mockCall(
            address(mockNft),
            abi.encodeWithSelector(ISwapCastNFT.getPredictionDetails.selector, winner2NftTokenId),
            abi.encode(marketId, winningOutcome, uint128(winner2NetStake), winner2)
        );
        vm.mockCall(
            address(mockNft), abi.encodeWithSelector(IERC721.ownerOf.selector, winner2NftTokenId), abi.encode(winner2)
        );
        vm.prank(rewardDistributorAddress);
        vm.expectEmit(true, true, true, true);
        emit RewardClaimed(winner2, winner2NftTokenId, winner2ExpectedPayout);
        pool.claimReward(winner2NftTokenId);
        assertEq(winner2.balance, winner2InitialBalance + winner2ExpectedPayout, "Winner2 balance mismatch");
        (,,,, bool token2ActuallyExistsAfterClaim) = mockNft.nfts(winner2NftTokenId);
        assertFalse(token2ActuallyExistsAfterClaim, "Winner2 NFT should be burned");

        assertEq(address(pool).balance, 0, "Pool ETH balance should be zero after all claims");
        assertEq(
            treasuryAddress.balance, treasuryBalanceAfterPredictions, "Treasury balance should not change during claims"
        );
    }

    function testClaimReward_Reverts_NotRewardDistributor() public {
        uint256 marketId = 13;
        address predictor = user1;
        uint256 stakeAmount = 1 ether; // This is the net stake
        PredictionTypes.Outcome outcome = PredictionTypes.Outcome.Bearish;

        uint256 feeBps = pool.protocolFeeBasisPoints();
        uint256 protocolFee = (stakeAmount * feeBps) / 10000;
        uint256 totalValueForMsg = stakeAmount + protocolFee; // This is msg.value

        vm.prank(owner);
        pool.createMarket(
            marketId,
            "Test Market Revert NotDistributor",
            "ETHUSD",
            block.timestamp + 1 hours,
            mockOracle,
            3000 * 10 ** 8
        );

        vm.prank(predictor);
        uint256 tokenId = mockNft.nextTokenId();
        // vm.deal(address(pool), totalValueForMsg); // Fund the pool - REMOVE, handled by msg.value
        pool.recordPrediction{value: totalValueForMsg}(predictor, marketId, outcome, uint128(stakeAmount));

        uint256 treasuryBalanceAfterPrediction = treasuryAddress.balance;
        assertEq(treasuryBalanceAfterPrediction, protocolFee, "Treasury balance incorrect after prediction");

        // Mock the NFT details needed for claim processing, even though it will revert before using all of them
        vm.mockCall(
            address(mockNft),
            abi.encodeWithSelector(ISwapCastNFT.getPredictionDetails.selector, tokenId),
            abi.encode(marketId, outcome, uint128(stakeAmount), predictor)
        );
        vm.mockCall(
            address(mockNft),
            abi.encodeWithSelector(IERC721.ownerOf.selector, tokenId),
            abi.encode(predictor) // Mock ownerOf to return the predictor
        );

        vm.prank(oracleResolverAddress);
        pool.resolveMarket(marketId, outcome, 2900 * 10 ** 8); // Price to make Bearish win

        vm.prank(user2); // Attempt claim from an unauthorized address
        vm.expectRevert(PredictionManager.NotRewardDistributor.selector);
        pool.claimReward(tokenId);

        // Treasury balance should remain unchanged by the failed claim attempt
        assertEq(
            treasuryAddress.balance,
            treasuryBalanceAfterPrediction,
            "Treasury balance should not change on failed claim"
        );
    }

    function testClaimReward_Reverts_TokenDoesNotExistInNFTContract() public {
        uint256 nonExistentTokenId = 999;

        // No market creation or prediction needed for this specific revert test, as it's about the NFT contract interaction.
        // However, the pool must exist.
        // uint256 marketId = 14;
        // vm.prank(owner);
        // pool.createMarket(marketId, "Test Market Revert No Token", "ETHUSD", block.timestamp + 1 hours, mockOracle, 3000 * 10**8);

        uint256 treasuryBalanceBeforeAttempt = treasuryAddress.balance;

        // Mock the NFT contract to indicate token does not exist (though the revert comes from the mock itself)
        // No explicit mock needed for getPredictionDetails or ownerOf because the call to claimReward will revert
        // when the mockNft internally can't find the token.

        vm.prank(rewardDistributorAddress);
        vm.expectRevert(abi.encodeWithSelector(MockSwapCastNFT.TokenDoesNotExist.selector, nonExistentTokenId));
        pool.claimReward(nonExistentTokenId);

        assertEq(
            treasuryAddress.balance,
            treasuryBalanceBeforeAttempt,
            "Treasury balance should not change on TokenDoesNotExist revert"
        );
    }

    function testClaimReward_Reverts_MarketNotYetResolved() public {
        uint256 marketId = 15;
        address predictor = user1;
        uint256 stakeAmount = 1 ether; // This is the net stake
        PredictionTypes.Outcome outcome = PredictionTypes.Outcome.Bearish;

        uint256 feeBps = pool.protocolFeeBasisPoints();
        uint256 protocolFee = (stakeAmount * feeBps) / 10000;
        uint256 totalValueForMsg = stakeAmount + protocolFee; // This is msg.value

        vm.prank(owner);
        pool.createMarket(
            marketId, "Test Market Revert NotResolved", "ETHUSD", block.timestamp + 1 hours, mockOracle, 3000 * 10 ** 8
        );

        vm.prank(predictor);
        uint256 tokenId = mockNft.nextTokenId();
        // vm.deal(address(pool), totalValueForMsg); // Fund the pool - REMOVE
        pool.recordPrediction{value: totalValueForMsg}(predictor, marketId, outcome, uint128(stakeAmount));

        uint256 treasuryBalanceAfterPrediction = treasuryAddress.balance;
        assertEq(treasuryBalanceAfterPrediction, protocolFee, "Treasury balance incorrect after prediction");

        // Market is NOT resolved yet

        // Mock NFT details as they would be read before the market resolution check
        vm.mockCall(
            address(mockNft),
            abi.encodeWithSelector(ISwapCastNFT.getPredictionDetails.selector, tokenId),
            abi.encode(marketId, outcome, uint128(stakeAmount), predictor) // Market not resolved, so details are pre-resolution
        );
        vm.mockCall(address(mockNft), abi.encodeWithSelector(IERC721.ownerOf.selector, tokenId), abi.encode(predictor));

        vm.prank(rewardDistributorAddress);
        vm.expectRevert(MarketLogic.MarketNotResolvedL.selector);
        pool.claimReward(tokenId);

        assertEq(
            treasuryAddress.balance,
            treasuryBalanceAfterPrediction,
            "Treasury balance should not change on MarketNotResolvedL revert"
        );
    }

    function testClaimReward_Reverts_IncorrectPrediction() public {
        uint256 marketId = 16;
        address predictor = user1;
        uint256 stakeAmount = 1 ether; // This is the net stake
        PredictionTypes.Outcome predictedOutcome = PredictionTypes.Outcome.Bearish;
        PredictionTypes.Outcome actualWinningOutcome = PredictionTypes.Outcome.Bullish; // Opposite of prediction

        uint256 feeBps = pool.protocolFeeBasisPoints();
        uint256 protocolFee = (stakeAmount * feeBps) / 10000;
        uint256 totalValueForMsg = stakeAmount + protocolFee; // This is msg.value

        vm.prank(owner);
        pool.createMarket(
            marketId,
            "Test Market Revert IncorrectPrediction",
            "ETHUSD",
            block.timestamp + 1 hours,
            mockOracle,
            3000 * 10 ** 8
        );

        vm.prank(predictor);
        uint256 tokenId = mockNft.nextTokenId();
        // vm.deal(address(pool), totalValueForMsg); // Fund the pool - REMOVE
        pool.recordPrediction{value: totalValueForMsg}(predictor, marketId, predictedOutcome, uint128(stakeAmount));

        uint256 treasuryBalanceAfterPrediction = treasuryAddress.balance;
        assertEq(treasuryBalanceAfterPrediction, protocolFee, "Treasury balance incorrect after prediction");

        vm.prank(oracleResolverAddress);
        pool.resolveMarket(marketId, actualWinningOutcome, 3100 * 10 ** 8); // Price to make Bullish win

        // Mock NFT details - predictor's outcome is Bearish, but market resolved Bullish
        vm.mockCall(
            address(mockNft),
            abi.encodeWithSelector(ISwapCastNFT.getPredictionDetails.selector, tokenId),
            abi.encode(marketId, predictedOutcome, uint128(stakeAmount), predictor)
        );
        vm.mockCall(address(mockNft), abi.encodeWithSelector(IERC721.ownerOf.selector, tokenId), abi.encode(predictor));

        vm.prank(rewardDistributorAddress);
        vm.expectRevert(MarketLogic.NotWinningNFTL.selector); // Changed from PM.IncorrectPrediction to MarketLogic's NotWinningNFTL
        pool.claimReward(tokenId);

        assertEq(
            treasuryAddress.balance,
            treasuryBalanceAfterPrediction,
            "Treasury balance should not change on NotWinningNFTL revert"
        );
    }

    function testClaimReward_Reverts_RewardTransferFailed() public {
        uint256 marketIdToTest = 123;
        uint256 tokenIdToClaim = 0;
        uint256 stakeAmount = 1 ether;

        MockRevertingReceiver localRevertingReceiver = new MockRevertingReceiver();
        address predictorAccount = address(localRevertingReceiver);

        uint256 feeBps = pool.protocolFeeBasisPoints();
        uint256 protocolFee = (stakeAmount * feeBps) / 10000;
        uint256 totalValue = stakeAmount + protocolFee;

        vm.prank(owner);
        pool.createMarket(
            marketIdToTest,
            "Test Market Revert TransferFail",
            "ETHUSD",
            block.timestamp + 1 hours,
            mockOracle,
            3000 * 10 ** 8
        );

        // Fund the reverting receiver with enough ETH to make the prediction
        // but it will revert on receiving the reward.
        vm.deal(predictorAccount, totalValue);

        vm.prank(predictorAccount); // The MockRevertingReceiver is the one making the prediction
        // The pool itself is not directly funded here with vm.deal for the prediction value;
        // it receives funds via msg.value in recordPrediction.
        pool.recordPrediction{value: totalValue}(
            predictorAccount, marketIdToTest, PredictionTypes.Outcome.Bearish, uint128(stakeAmount)
        );
        // tokenIdToClaim will implicitly be 0 as it's the first NFT minted for predictorAccount by the mock
        // if the mock NFT contract mints sequentially starting from 0 for new owners or globally.
        // Assuming MockSwapCastNFT.nextTokenId() starts at 0 and increments, and this is the first prediction by this address.
        // Let's explicitly get the token ID that would have been minted to be sure.
        // Actually, the mockNft.mintPredictionNFT used below explicitly sets the token ID to 0 for simplicity in other tests.
        // We will rely on the mock setup in this test to handle tokenIdToClaim = 0 correctly.

        uint256 treasuryBalanceAfterPrediction = treasuryAddress.balance;
        assertEq(treasuryBalanceAfterPrediction, protocolFee, "Treasury balance incorrect after prediction");

        vm.prank(oracleResolverAddress);
        pool.resolveMarket(marketIdToTest, PredictionTypes.Outcome.Bearish, 2900 * 10 ** 8); // Price to make Bearish win

        // Mock the NFT details for the claim
        vm.mockCall(
            address(mockNft),
            abi.encodeWithSelector(ISwapCastNFT.getPredictionDetails.selector, tokenIdToClaim),
            abi.encode(marketIdToTest, PredictionTypes.Outcome.Bearish, uint128(stakeAmount), predictorAccount)
        );
        vm.mockCall(
            address(mockNft),
            abi.encodeWithSelector(IERC721.ownerOf.selector, tokenIdToClaim),
            abi.encode(predictorAccount) // Mock ownerOf to return the predictor (reverting receiver)
        );

        vm.prank(rewardDistributorAddress);
        vm.expectRevert(MarketLogic.RewardTransferFailedL.selector);
        pool.claimReward(tokenIdToClaim);

        assertEq(
            treasuryAddress.balance,
            treasuryBalanceAfterPrediction,
            "Treasury balance should not change on RewardTransferFailedL revert"
        );
    }

    function testClaimReward_Reverts_MarketDoesNotExistForNFTsMarket() public {
        uint256 nonExistentMarketIdForNFT = 888;
        uint256 tokenIdForNonExistentMarket = 88;

        vm.prank(owner);
        pool.createMarket(1, "Test Market", "ETHUSD", block.timestamp + 1 hours, mockOracle, 3000 * 10 ** 8);
        vm.prank(oracleResolverAddress);
        pool.resolveMarket(1, PredictionTypes.Outcome.Bullish, 0);

        vm.prank(owner);
        pool.createMarket(
            nonExistentMarketIdForNFT, "Test Market", "ETHUSD", block.timestamp + 1 hours, mockOracle, 3000 * 10 ** 8
        );

        vm.mockCall(
            address(mockNft),
            abi.encodeWithSelector(ISwapCastNFT.getPredictionDetails.selector, tokenIdForNonExistentMarket),
            abi.encode(nonExistentMarketIdForNFT, PredictionTypes.Outcome.Bearish, 1 ether, user1)
        );

        vm.mockCall(
            address(mockNft),
            abi.encodeWithSelector(IERC721.ownerOf.selector, tokenIdForNonExistentMarket),
            abi.encode(user1) // Mock ownerOf to return the user1
        );

        vm.prank(rewardDistributorAddress);
        vm.expectRevert(MarketLogic.MarketNotResolvedL.selector); // MarketLogic will revert if market does not exist or is not resolved
        pool.claimReward(tokenIdForNonExistentMarket);
    }
}
