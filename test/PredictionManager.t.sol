//SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, console} from "forge-std/Test.sol";
import {StdInvariant} from "forge-std/StdInvariant.sol";
import {PredictionManager} from "src/PredictionManager.sol";
import {MockSwapCastNFT} from "./mocks/MockSwapCastNFT.sol";
import {ISwapCastNFT} from "src/interfaces/ISwapCastNFT.sol";
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
    event MarketCreated(uint256 indexed marketId);
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

    address internal owner;
    address payable internal treasuryAddress;
    address internal oracleResolverAddress;
    address internal rewardDistributorAddress;
    address internal user1;
    address internal user2;
    address internal user3;

    uint256 internal initialFeeBasisPoints = 100;
    uint256 internal initialMinStakeAmount = 0.01 ether;

    function setUp() public {
        owner = makeAddr("owner");
        treasuryAddress = payable(makeAddr("treasury"));
        revertingReceiver = new MockRevertingReceiver();

        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        user3 = makeAddr("user3");

        vm.deal(user1, 10 ether);
        vm.deal(user2, 10 ether);
        vm.deal(user3, 10 ether);
        vm.deal(owner, 1 ether);

        vm.startPrank(owner);
        mockNft = new MockSwapCastNFT();
        vm.stopPrank();

        pool = new PredictionManager(
            address(mockNft),
            treasuryAddress,
            initialFeeBasisPoints,
            owner,
            initialMinStakeAmount,
            3600 // maxPriceStalenessSeconds
        );

        // Get the addresses of OracleResolver and RewardDistributor created by PredictionManager
        oracleResolverAddress = pool.oracleResolverAddress();
        rewardDistributorAddress = pool.rewardDistributorAddress();

        vm.prank(owner);
        mockNft.setPredictionPoolAddress(address(pool));
    }

    function testCreateMarket_Successful_And_EmitsEvent_And_SetsInitialState() public {
        uint256 marketIdToCreate = 1;

        vm.expectEmit(true, true, true, true);
        emit MarketCreated(marketIdToCreate);
        vm.prank(owner);
        pool.createMarket(marketIdToCreate);

        (
            uint256 marketId_,
            bool exists_,
            bool resolved_,
            PredictionTypes.Outcome winningOutcome_,
            uint256 totalConvictionStakeOutcome0_,
            uint256 totalConvictionStakeOutcome1_,
            ,
            ,
        ) = pool.getMarketDetails(marketIdToCreate);

        assertTrue(exists_, "Market should exist after creation");
        assertEq(marketId_, marketIdToCreate, "Stored marketId mismatch with key");
        assertFalse(resolved_, "Market should not be resolved initially");
        assertEq(
            uint8(winningOutcome_),
            uint8(PredictionTypes.Outcome.Bearish),
            "Winning outcome should be Bearish initially"
        );
        assertEq(totalConvictionStakeOutcome0_, 0, "Total stake for outcome 0 should be 0");
        assertEq(totalConvictionStakeOutcome1_, 0, "Total stake for outcome 1 should be 0");
    }

    function testCreateMarket_Reverts_ZeroMarketId() public {
        vm.prank(owner);
        vm.expectRevert(PredictionManager.InvalidMarketId.selector);
        pool.createMarket(0);
    }

    function testCreateMarket_Reverts_MarketAlreadyExists() public {
        uint256 marketIdToCreate = 1;
        vm.prank(owner);
        pool.createMarket(marketIdToCreate);

        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(PredictionManager.MarketAlreadyExists.selector, marketIdToCreate));
        pool.createMarket(marketIdToCreate);
    }

    function testRecordPrediction() public {
        uint256 marketIdToTest = 1;
        address predictor = user1;
        PredictionTypes.Outcome outcome = PredictionTypes.Outcome.Bearish;
        uint256 stakeAmount = 0.02 ether;

        vm.prank(owner);
        pool.createMarket(marketIdToTest);

        uint256 initialPredictorNftBalance = mockNft.balances(predictor);
        uint256 initialNextTokenId = mockNft.nextTokenId();

        vm.deal(address(pool), stakeAmount); // Fund the pool with the stake
        vm.prank(predictor);
        pool.recordPrediction(predictor, marketIdToTest, outcome, uint128(stakeAmount));

        assertEq(mockNft.balances(predictor), initialPredictorNftBalance + 1, "Predictor NFT balance incorrect");
        assertEq(mockNft.nextTokenId(), initialNextTokenId + 1, "Next token ID not incremented");
        (,,,, bool tokenExistsAfterMint) = mockNft.nfts(initialNextTokenId);
        assertTrue(tokenExistsAfterMint, "NFT should exist after minting");
    }

    function testRecordPrediction_Reverts_MarketDoesNotExist() public {
        uint256 nonExistentMarketId = 99;
        uint256 stakeAmount = initialMinStakeAmount;
        address predictor = user1;
        PredictionTypes.Outcome outcomeToPredict = PredictionTypes.Outcome.Bearish;

        vm.prank(predictor);
        vm.expectRevert(abi.encodeWithSelector(PredictionManager.MarketDoesNotExist.selector, nonExistentMarketId));
        vm.deal(address(pool), stakeAmount); // Fund the pool
        pool.recordPrediction(predictor, nonExistentMarketId, outcomeToPredict, uint128(stakeAmount));
    }

    function testRecordPrediction_Reverts_AmountCannotBeZero_MsgValueZero() public {
        uint256 marketIdToTest = 1;
        vm.prank(owner);
        pool.createMarket(marketIdToTest);

        address predictor = user1;
        PredictionTypes.Outcome outcomeToPredict = PredictionTypes.Outcome.Bearish;

        vm.prank(predictor);
        vm.expectRevert(PredictionManager.AmountCannotBeZero.selector);
        pool.recordPrediction(predictor, marketIdToTest, outcomeToPredict, uint128(0));
    }

    function testRecordPrediction_Reverts_AmountCannotBeZero_NetStakeZeroDueToFee() public {
        uint256 marketIdToTest = 1;
        vm.prank(owner);
        pool.createMarket(marketIdToTest);

        uint256 highFee = 10000;
        vm.prank(owner);
        pool.setFeeConfiguration(treasuryAddress, highFee);

        uint256 stakeAmountSent = 100 wei;

        address predictor = user1;
        PredictionTypes.Outcome outcomeToPredict = PredictionTypes.Outcome.Bearish;

        vm.prank(predictor);
        vm.expectRevert(PredictionManager.AmountCannotBeZero.selector);
        vm.deal(address(pool), stakeAmountSent); // Fund the pool
        pool.recordPrediction(predictor, marketIdToTest, outcomeToPredict, uint128(stakeAmountSent));

        vm.prank(owner);
        pool.setFeeConfiguration(treasuryAddress, initialFeeBasisPoints);
    }

    function testCannotRecordAfterMarketResolved() public {
        uint256 marketIdToTest = 2;
        vm.prank(owner);
        pool.createMarket(marketIdToTest);
        vm.prank(oracleResolverAddress);
        pool.resolveMarket(marketIdToTest, PredictionTypes.Outcome.Bearish, 0);

        vm.expectRevert(abi.encodeWithSelector(PredictionManager.MarketAlreadyResolved.selector, marketIdToTest));
        vm.deal(address(pool), 100 wei); // Fund the pool
        pool.recordPrediction(address(1), marketIdToTest, PredictionTypes.Outcome.Bearish, uint128(100 wei));
    }

    function testDuplicatePredictionReverts() public {
        uint256 marketIdToTest = 3;
        vm.prank(owner);
        pool.createMarket(marketIdToTest);

        vm.deal(address(pool), 0.1 ether); // Fund the pool
        pool.recordPrediction(address(1), marketIdToTest, PredictionTypes.Outcome.Bearish, uint128(0.1 ether));

        vm.expectRevert(abi.encodeWithSelector(PredictionManager.AlreadyPredicted.selector, marketIdToTest, address(1)));
        vm.deal(address(pool), 0.1 ether); // Fund the pool
        pool.recordPrediction(address(1), marketIdToTest, PredictionTypes.Outcome.Bullish, uint128(0.1 ether));
    }

    function testZeroUserAddressPredictionReverts() public {
        uint256 marketId = 5;
        address zeroUser = address(0);
        uint256 stake = 0.1 ether;
        PredictionTypes.Outcome outcome = PredictionTypes.Outcome.Bearish;

        vm.prank(owner);
        pool.createMarket(marketId);

        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(PredictionManager.ZeroAddressInput.selector));
        vm.deal(address(pool), stake); // Fund the pool
        pool.recordPrediction(zeroUser, marketId, outcome, uint128(stake));
    }

    function testResolveMarket_NoPredictionsMade() public {
        uint256 marketIdToTest = 1;
        vm.prank(owner);
        pool.createMarket(marketIdToTest);

        vm.prank(oracleResolverAddress);

        vm.expectEmit(true, true, true, true);
        emit MarketResolved(marketIdToTest, PredictionTypes.Outcome.Bearish, 0, 0);
        pool.resolveMarket(marketIdToTest, PredictionTypes.Outcome.Bearish, 0);

        (,, bool retMarketResolved,,,,,,) = pool.getMarketDetails(marketIdToTest);
        assertTrue(retMarketResolved, "Market should be resolved");
    }

    function testResolveMarket_Successful() public {
        uint256 marketIdToTest = 6;
        vm.prank(owner);
        pool.createMarket(marketIdToTest);

        vm.prank(user1);
        vm.deal(address(pool), 1 ether); // Fund the pool
        pool.recordPrediction(user1, marketIdToTest, PredictionTypes.Outcome.Bearish, uint128(1 ether));
        vm.prank(user2);
        vm.deal(address(pool), 2 ether); // Fund the pool
        pool.recordPrediction(user2, marketIdToTest, PredictionTypes.Outcome.Bullish, uint128(2 ether));

        uint256 expectedStake0 = (1 ether * (10000 - initialFeeBasisPoints)) / 10000;
        uint256 expectedStake1 = (2 ether * (10000 - initialFeeBasisPoints)) / 10000;
        PredictionTypes.Outcome winningOutcomeToSet = PredictionTypes.Outcome.Bullish;
        int256 expectedOraclePrice = 1000;
        uint256 expectedTotalPrizePool = expectedStake0 + expectedStake1;

        vm.prank(oracleResolverAddress);
        vm.expectEmit(true, false, false, true, address(pool));

        emit MarketResolved(marketIdToTest, winningOutcomeToSet, expectedOraclePrice, expectedTotalPrizePool);
        pool.resolveMarket(marketIdToTest, winningOutcomeToSet, expectedOraclePrice);

        (
            uint256 mId,
            bool mExists,
            bool mResolved,
            PredictionTypes.Outcome mOutcomeFromMarket,
            uint256 mFinalTs0,
            uint256 mFinalTs1,
            ,
            ,
        ) = pool.getMarketDetails(marketIdToTest);

        assertTrue(mExists, "Market should still exist");
        assertEq(mId, marketIdToTest, "Market ID mismatch in struct");
        assertTrue(mResolved, "Market should be resolved");
        assertEq(uint8(mOutcomeFromMarket), uint8(winningOutcomeToSet), "Winning outcome mismatch in struct");
        assertEq(mFinalTs0, expectedStake0, "Total stake 0 in struct mismatch");
        assertEq(mFinalTs1, expectedStake1, "Total stake 1 in struct mismatch");
    }

    function testResolveMarket_Reverts_NotOracleResolver_User() public {
        uint256 marketIdToTest = 6;
        vm.prank(owner);
        pool.createMarket(marketIdToTest);

        vm.prank(user1);
        vm.expectRevert(PredictionManager.NotOracleResolver.selector);
        pool.resolveMarket(marketIdToTest, PredictionTypes.Outcome.Bullish, 0);
    }

    function testResolveMarket_Reverts_NotOracleResolver_Owner() public {
        uint256 marketIdToTest = 6;
        vm.prank(owner);
        pool.createMarket(marketIdToTest);

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
        pool.createMarket(marketIdToTest);

        vm.prank(oracleResolverAddress);
        pool.resolveMarket(marketIdToTest, PredictionTypes.Outcome.Bearish, 0);

        vm.prank(oracleResolverAddress);
        vm.expectRevert(abi.encodeWithSelector(PredictionManager.MarketAlreadyResolved.selector, marketIdToTest));
        pool.resolveMarket(marketIdToTest, PredictionTypes.Outcome.Bullish, 0);
    }

    function testResolveMarket_EnumSafety() public {
        uint256 marketIdToTest = 6;
        vm.prank(owner);
        pool.createMarket(marketIdToTest);

        // Test that we can use both enum values
        vm.startPrank(oracleResolverAddress);

        // Should work with Bearish
        pool.resolveMarket(marketIdToTest, PredictionTypes.Outcome.Bearish, 0);

        // Create another market to test Bullish
        uint256 marketIdToTest2 = 7;
        vm.stopPrank();
        vm.prank(owner);
        pool.createMarket(marketIdToTest2);

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
        uint256 winnerStake = 2 ether;
        PredictionTypes.Outcome winningOutcome = PredictionTypes.Outcome.Bearish;

        vm.prank(owner);
        pool.createMarket(marketId);

        vm.prank(winner);
        vm.deal(address(pool), winnerStake); // Fund the pool
        uint256 winnerNftTokenId = mockNft.nextTokenId();
        pool.recordPrediction(winner, marketId, winningOutcome, uint128(winnerStake));
        uint256 winnerNetStake = winnerStake - ((winnerStake * initialFeeBasisPoints) / 10000);

        vm.prank(oracleResolverAddress);
        pool.resolveMarket(marketId, winningOutcome, 1000);

        uint256 winnerInitialBalance = winner.balance;
        uint256 poolInitialBalance = address(pool).balance;

        uint256 expectedPayout = winnerNetStake;

        // Ensure the pool has enough balance to make the transfer
        vm.deal(address(pool), expectedPayout);

        vm.prank(rewardDistributorAddress);
        vm.expectEmit(true, true, false, false, address(pool));
        emit RewardClaimed(winner, winnerNftTokenId, expectedPayout);
        pool.claimReward(winnerNftTokenId);

        assertEq(winner.balance, winnerInitialBalance + expectedPayout, "Winner balance mismatch (no losing stakes)");
        assertEq(address(pool).balance, poolInitialBalance - expectedPayout, "Pool balance mismatch (no losing stakes)");
        (,,,, bool tokenActuallyExistsAfterClaim) = mockNft.nfts(winnerNftTokenId);
        assertFalse(tokenActuallyExistsAfterClaim, "Winner NFT should be burned (no losing stakes)");
    }

    function testClaimReward_Successful_WithLosingStakes() public {
        uint256 marketId = 11;
        address winner = user1;
        address loser = user2;
        uint256 winnerStake = 2 ether;
        uint256 loserStake = 1 ether;
        PredictionTypes.Outcome winningOutcome = PredictionTypes.Outcome.Bearish;
        PredictionTypes.Outcome losingOutcome = PredictionTypes.Outcome.Bullish;

        vm.prank(owner);
        pool.createMarket(marketId);

        vm.prank(winner);
        vm.deal(address(pool), winnerStake); // Fund the pool
        uint256 winnerNftTokenId = mockNft.nextTokenId();
        pool.recordPrediction(winner, marketId, winningOutcome, uint128(winnerStake));
        uint256 winnerNetStake = winnerStake - ((winnerStake * initialFeeBasisPoints) / 10000);

        vm.prank(loser);
        vm.deal(address(pool), loserStake); // Fund the pool
        pool.recordPrediction(loser, marketId, losingOutcome, uint128(loserStake));
        uint256 loserNetStake = loserStake - ((loserStake * initialFeeBasisPoints) / 10000);

        vm.prank(oracleResolverAddress);
        pool.resolveMarket(marketId, winningOutcome, 1000);

        uint256 winnerInitialBalance = winner.balance;
        uint256 poolInitialBalance = address(pool).balance;

        uint256 expectedPayout = winnerNetStake + loserNetStake;

        // Ensure the pool has enough balance to make the transfer
        vm.deal(address(pool), expectedPayout);

        // Update the pool initial balance after adding funds
        poolInitialBalance = address(pool).balance;

        vm.prank(rewardDistributorAddress);
        vm.expectEmit(true, true, false, false, address(pool));
        emit RewardClaimed(winner, winnerNftTokenId, expectedPayout);
        pool.claimReward(winnerNftTokenId);

        assertEq(winner.balance, winnerInitialBalance + expectedPayout, "Winner balance mismatch (with losing stakes)");
        assertEq(address(pool).balance, poolInitialBalance - expectedPayout, "Pool balance mismatch after reward claim");
        (,,,, bool tokenActuallyExistsAfterClaim) = mockNft.nfts(winnerNftTokenId);
        assertFalse(tokenActuallyExistsAfterClaim, "Winner NFT should be burned (with losing stakes)");
    }

    function testClaimReward_Successful_MultipleWinners_ShareLosingStakes() public {
        uint256 marketId = 12;
        address winner1 = user1;
        address winner2 = user2;
        address loser = user3;

        uint256 winner1Stake = 1 ether;
        uint256 winner2Stake = 3 ether;
        uint256 loserStake = 4 ether;

        PredictionTypes.Outcome winningOutcome = PredictionTypes.Outcome.Bearish;
        PredictionTypes.Outcome losingOutcome = PredictionTypes.Outcome.Bullish;

        vm.prank(owner);
        pool.createMarket(marketId);

        vm.prank(winner1);
        vm.deal(address(pool), winner1Stake); // Fund the pool
        uint256 winner1NftTokenId = mockNft.nextTokenId();
        pool.recordPrediction(winner1, marketId, winningOutcome, uint128(winner1Stake));
        uint256 winner1NetStake = winner1Stake - ((winner1Stake * initialFeeBasisPoints) / 10000);

        vm.prank(winner2);
        vm.deal(address(pool), winner2Stake); // Fund the pool
        uint256 winner2NftTokenId = mockNft.nextTokenId();
        pool.recordPrediction(winner2, marketId, winningOutcome, uint128(winner2Stake));
        uint256 winner2NetStake = winner2Stake - ((winner2Stake * initialFeeBasisPoints) / 10000);

        vm.prank(loser);
        vm.deal(address(pool), loserStake); // Fund the pool
        pool.recordPrediction(loser, marketId, losingOutcome, uint128(loserStake));
        uint256 loserNetStake = loserStake - ((loserStake * initialFeeBasisPoints) / 10000);

        vm.prank(oracleResolverAddress);
        pool.resolveMarket(marketId, winningOutcome, 1000);

        uint256 totalNetWinningStake = winner1NetStake + winner2NetStake;

        uint256 winner1InitialBalance = winner1.balance;
        uint256 poolBalanceBeforeWinner1Claim = address(pool).balance;
        uint256 winner1ShareOfLosing = FullMath.mulDiv(winner1NetStake, loserNetStake, totalNetWinningStake);
        uint256 winner1ExpectedPayout = winner1NetStake + winner1ShareOfLosing;

        // Calculate total needed funds for both winners
        uint256 totalNeededFunds = winner1ExpectedPayout + winner2NetStake
            + FullMath.mulDiv(winner2NetStake, loserNetStake, totalNetWinningStake);

        // Ensure the pool has enough balance to make the transfer
        vm.deal(address(pool), totalNeededFunds);

        // Update the pool balance after adding funds
        poolBalanceBeforeWinner1Claim = address(pool).balance;

        vm.prank(rewardDistributorAddress);
        vm.expectEmit(true, true, false, false, address(pool));
        emit RewardClaimed(winner1, winner1NftTokenId, winner1ExpectedPayout);
        pool.claimReward(winner1NftTokenId);

        assertEq(winner1.balance, winner1InitialBalance + winner1ExpectedPayout, "Winner1 balance mismatch");
        assertEq(
            address(pool).balance,
            poolBalanceBeforeWinner1Claim - winner1ExpectedPayout,
            "Pool balance mismatch after Winner1"
        );
        (,,,, bool winner1TokenExists) = mockNft.nfts(winner1NftTokenId);
        assertFalse(winner1TokenExists, "Winner1 NFT should be burned");

        uint256 winner2InitialBalance = winner2.balance;
        uint256 poolBalanceBeforeWinner2Claim = address(pool).balance;
        uint256 winner2ShareOfLosing = FullMath.mulDiv(winner2NetStake, loserNetStake, totalNetWinningStake);

        uint256 winner2ExpectedPayout = winner2NetStake + winner2ShareOfLosing;

        // The pool should already have enough balance from the previous vm.deal, but let's ensure it
        if (address(pool).balance < winner2ExpectedPayout) {
            vm.deal(address(pool), winner2ExpectedPayout);
        }

        vm.prank(rewardDistributorAddress);
        vm.expectEmit(true, true, false, false, address(pool));
        emit RewardClaimed(winner2, winner2NftTokenId, winner2ExpectedPayout);
        pool.claimReward(winner2NftTokenId);

        assertEq(winner2.balance, winner2InitialBalance + winner2ExpectedPayout, "Winner2 balance mismatch");
        assertEq(
            address(pool).balance,
            poolBalanceBeforeWinner2Claim - winner2ExpectedPayout,
            "Pool balance mismatch after Winner2"
        );
        (,,,, bool winner2TokenExists) = mockNft.nfts(winner2NftTokenId);
        assertFalse(winner2TokenExists, "Winner2 NFT should be burned");

        assertTrue(
            winner1ShareOfLosing + winner2ShareOfLosing <= loserNetStake, "Sum of shares exceeds total losing stake"
        );
        assertTrue(
            winner1ShareOfLosing + winner2ShareOfLosing >= loserNetStake - 1,
            "Sum of shares too much less than total losing stake (dust check)"
        );
    }

    function testClaimReward_Reverts_NotRewardDistributor() public {
        uint256 marketId = 13;
        address predictor = user1;
        uint256 stake = 1 ether;
        PredictionTypes.Outcome outcome = PredictionTypes.Outcome.Bearish;

        vm.prank(owner);
        pool.createMarket(marketId);

        vm.prank(predictor);
        vm.deal(address(pool), stake); // Fund the pool
        uint256 tokenId = mockNft.nextTokenId();
        pool.recordPrediction(predictor, marketId, outcome, uint128(stake));

        vm.prank(oracleResolverAddress);
        pool.resolveMarket(marketId, outcome, 1000);

        vm.prank(user2);
        vm.expectRevert(PredictionManager.NotRewardDistributor.selector);
        pool.claimReward(tokenId);
    }

    function testClaimReward_Reverts_TokenDoesNotExistInNFTContract() public {
        uint256 nonExistentTokenId = 999;

        uint256 marketId = 14;
        vm.prank(owner);
        pool.createMarket(marketId);
        vm.prank(oracleResolverAddress);
        pool.resolveMarket(marketId, PredictionTypes.Outcome.Bearish, 1000);

        vm.prank(rewardDistributorAddress);
        vm.expectRevert(abi.encodeWithSelector(MockSwapCastNFT.TokenDoesNotExist.selector, nonExistentTokenId));
        pool.claimReward(nonExistentTokenId);
    }

    function testClaimReward_Reverts_MarketNotYetResolved() public {
        uint256 marketId = 15;
        address predictor = user1;
        uint256 stake = 1 ether;
        PredictionTypes.Outcome outcome = PredictionTypes.Outcome.Bearish;

        vm.prank(owner);
        pool.createMarket(marketId);

        vm.prank(predictor);
        vm.deal(address(pool), stake); // Fund the pool
        uint256 tokenId = mockNft.nextTokenId();
        pool.recordPrediction(predictor, marketId, outcome, uint128(stake));

        vm.prank(rewardDistributorAddress);
        vm.expectRevert(abi.encodeWithSelector(PredictionManager.MarketNotResolved.selector, marketId));
        pool.claimReward(tokenId);
    }

    function testClaimReward_Reverts_IncorrectPrediction() public {
        uint256 marketId = 16;
        address predictor = user1;
        uint256 stake = 1 ether;
        PredictionTypes.Outcome predictedOutcome = PredictionTypes.Outcome.Bearish;
        PredictionTypes.Outcome actualWinningOutcome = PredictionTypes.Outcome.Bullish;

        vm.prank(owner);
        pool.createMarket(marketId);

        vm.prank(predictor);
        vm.deal(address(pool), stake); // Fund the pool
        uint256 tokenId = mockNft.nextTokenId();
        pool.recordPrediction(predictor, marketId, predictedOutcome, uint128(stake));

        vm.prank(oracleResolverAddress);
        pool.resolveMarket(marketId, actualWinningOutcome, 1000);

        vm.prank(rewardDistributorAddress);
        vm.expectRevert(abi.encodeWithSelector(PredictionManager.NotWinningNFT.selector));
        pool.claimReward(tokenId);
    }

    function testClaimReward_Reverts_RewardTransferFailed() public {
        uint256 marketIdToTest = 123;
        uint256 tokenIdToClaim = 0;

        MockRevertingReceiver localRevertingReceiver = new MockRevertingReceiver();
        address predictorAccount = address(localRevertingReceiver);

        vm.deal(predictorAccount, 1 ether);

        vm.prank(owner);
        pool.createMarket(marketIdToTest);

        vm.prank(predictorAccount);
        vm.deal(address(pool), 1 ether); // Fund the pool
        pool.recordPrediction(predictorAccount, marketIdToTest, PredictionTypes.Outcome.Bearish, uint128(1 ether));

        vm.prank(oracleResolverAddress);
        pool.resolveMarket(marketIdToTest, PredictionTypes.Outcome.Bearish, 1000);

        uint256 netStake = (1 ether * (10000 - initialFeeBasisPoints)) / 10000;
        vm.mockCall(
            address(mockNft),
            abi.encodeWithSelector(ISwapCastNFT.getPredictionDetails.selector, tokenIdToClaim),
            abi.encode(marketIdToTest, PredictionTypes.Outcome.Bearish, netStake, predictorAccount)
        );

        vm.prank(rewardDistributorAddress);
        vm.expectRevert(abi.encodeWithSelector(PredictionManager.RewardTransferFailed.selector));
        pool.claimReward(tokenIdToClaim);
    }

    function testClaimReward_Reverts_MarketDoesNotExistForNFTsMarket() public {
        uint256 nonExistentMarketIdForNFT = 888;
        uint256 tokenIdForNonExistentMarket = 88;

        vm.prank(owner);
        pool.createMarket(1);
        vm.prank(oracleResolverAddress);
        pool.resolveMarket(1, PredictionTypes.Outcome.Bullish, 0);

        vm.prank(owner);
        pool.createMarket(nonExistentMarketIdForNFT);

        vm.mockCall(
            address(mockNft),
            abi.encodeWithSelector(ISwapCastNFT.getPredictionDetails.selector, tokenIdForNonExistentMarket),
            abi.encode(nonExistentMarketIdForNFT, PredictionTypes.Outcome.Bearish, 1 ether, user1)
        );

        vm.prank(rewardDistributorAddress);
        vm.expectRevert(abi.encodeWithSelector(PredictionManager.MarketNotResolved.selector, nonExistentMarketIdForNFT));
        pool.claimReward(tokenIdForNonExistentMarket);
    }
}
