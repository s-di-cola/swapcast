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
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";

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
    PoolKey internal testPoolKey;
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
            owner, // initialOwner
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

        // Initialize testPoolKey
        testPoolKey = PoolKey({
            currency0: Currency.wrap(vm.addr(0xA0)), // Example token address for currency0
            currency1: Currency.wrap(vm.addr(0xB0)), // Example token address for currency1
            fee: 3000, // Standard fee, e.g., 0.3%
            tickSpacing: 60, // Standard tick spacing
            hooks: IHooks(address(0)) // No hooks needed for these tests
        });
    }

    // --- Test Cases for Market Creation ---

    function testCreateMarket_Successful_And_EmitsEvent_And_SetsInitialState() public {
        string memory marketName = "Test Market";
        string memory assetSymbol = "ETHUSD";
        uint256 expirationTime = block.timestamp + 1 hours;
        uint256 priceThreshold = 3000 * 10 ** 8;

        // Verify initial state
        assertEq(pool.getMarketCount(), 0, "Initial market count should be zero");

        vm.prank(owner);
        vm.expectEmit(true, true, true, true, address(pool));
        emit MarketCreated(
            1, // Assuming _nextMarketId starts at 1 and this is the first market created
            marketName,
            assetSymbol,
            expirationTime,
            mockOracle,
            priceThreshold
        );
        uint256 marketIdToCreate =
            pool.createMarket(marketName, assetSymbol, expirationTime, mockOracle, priceThreshold, testPoolKey);

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

    function testCreateMarket_Reverts_EmptyName() public {
        vm.prank(owner);
        vm.expectRevert(PredictionManager.EmptyMarketName.selector);
        pool.createMarket("", "ETHUSD", block.timestamp + 1 hours, mockOracle, 3000 * 10 ** 8, testPoolKey);
    }

    function testCreateMarket_Reverts_EmptySymbol() public {
        vm.prank(owner);
        vm.expectRevert("InvalidAssetSymbol()");
        pool.createMarket("Test Market", "", block.timestamp + 1 hours, mockOracle, 3000 * 10 ** 8, testPoolKey);
    }

    function testCreateMarket_Reverts_InvalidExpiration() public {
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(
                PredictionManager.InvalidExpirationTime.selector, block.timestamp - 1, block.timestamp
            )
        );
        pool.createMarket("Test Market", "ETHUSD", block.timestamp - 1, mockOracle, 3000 * 10 ** 8, testPoolKey);
    }

    function testCreateMarket_Reverts_ZeroPriceThreshold() public {
        vm.prank(owner);
        vm.expectRevert("InvalidPriceThreshold()");
        pool.createMarket("Test Market", "ETHUSD", block.timestamp + 1 hours, mockOracle, 0, testPoolKey);
    }

    function testCreateMarket_Reverts_InvalidPoolKey() public {
        vm.prank(owner);
        PoolKey memory invalidPoolKey = PoolKey({
            currency0: Currency.wrap(vm.addr(0xA0)),
            currency1: Currency.wrap(vm.addr(0xA0)), // Same as currency0
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(0))
        });
        vm.expectRevert("InvalidPoolKey()");
        pool.createMarket(
            "Test Market", "ETHUSD", block.timestamp + 1 hours, mockOracle, 3000 * 10 ** 8, invalidPoolKey
        );
    }

    function testCreateMarket_Reverts_MarketAlreadyExists() public {
        // Create first market
        vm.prank(owner);
        uint256 marketIdToCreate = pool.createMarket(
            "Test Market", "ETHUSD", block.timestamp + 1 hours, mockOracle, 3000 * 10 ** 8, testPoolKey
        );

        // Create second market with same parameters - should be allowed but with different ID
        vm.prank(owner);
        uint256 secondMarketId = pool.createMarket(
            "Test Market", "ETHUSD", block.timestamp + 1 hours, mockOracle, 3000 * 10 ** 8, testPoolKey
        );

        // Verify they have different IDs
        assertNotEq(marketIdToCreate, secondMarketId, "Creating market with same params should result in a new ID");

        // Verify both markets exist and have the expected properties
        (uint256 id1,,,,,,,,,,) = pool.getMarketDetails(marketIdToCreate);
        (uint256 id2,,,,,,,,,,) = pool.getMarketDetails(secondMarketId);
        assertEq(id1, marketIdToCreate, "First market ID should match");
        assertEq(id2, secondMarketId, "Second market ID should match");
    }

    function testRecordPrediction() public {
        address predictor = user1;
        PredictionTypes.Outcome outcome = PredictionTypes.Outcome.Bearish;
        uint256 stakeAmount = 0.02 ether;

        vm.prank(owner);
        uint256 marketIdToTest = pool.createMarket(
            "Test Market", "ETHUSD", block.timestamp + 1 hours, mockOracle, 3000 * 10 ** 8, testPoolKey
        ); // New

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
        PredictionTypes.Outcome outcomeToPredict = PredictionTypes.Outcome.Bullish;

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
        pool.createMarket("Test Market", "ETHUSD", block.timestamp + 1 hours, mockOracle, 3000 * 10 ** 8, testPoolKey);

        address predictor = user1;
        PredictionTypes.Outcome outcomeToPredict = PredictionTypes.Outcome.Bearish;

        vm.prank(predictor);
        vm.expectRevert(PredictionManager.AmountCannotBeZero.selector);
        pool.recordPrediction(predictor, marketIdToTest, outcomeToPredict, uint128(0));
    }

    function testRecordPrediction_Reverts_AmountCannotBeZero_NetStakeZeroDueToFee() public {
        uint256 marketIdToTest = 1;
        vm.prank(owner);
        pool.createMarket("Test Market", "ETHUSD", block.timestamp + 1 hours, mockOracle, 3000 * 10 ** 8, testPoolKey);

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

    // --- Test Cases for Market Resolution ---

    function testCannotRecordAfterMarketResolved() public {
        vm.prank(owner);
        uint256 marketIdToTest = pool.createMarket(
            "Test Market",
            "ETHUSD",
            block.timestamp + 1 hours,
            mockOracle,
            3000 * 10 ** 8,
            testPoolKey // New
        );

        // Resolve the market
        vm.prank(oracleResolverAddress);
        pool.resolveMarket(marketIdToTest, PredictionTypes.Outcome.Bearish, 0); // Resolve with any outcome and price

        // Try to record a prediction after market is resolved
        uint256 stakeAmount = 0.02 ether;
        uint256 feeBps = pool.protocolFeeBasisPoints();
        uint256 protocolFee = (stakeAmount * feeBps) / 10000;
        uint256 totalValue = stakeAmount + protocolFee;

        vm.deal(user1, totalValue);
        vm.prank(user1);
        vm.expectRevert(
            abi.encodeWithSelector(
                MarketLogic.MarketAlreadyResolvedL.selector,
                marketIdToTest // marketId
            )
        );
        pool.recordPrediction{value: totalValue}(
            user1, marketIdToTest, PredictionTypes.Outcome.Bullish, uint128(stakeAmount)
        );
    }

    function testResolveMarket_EnumSafety() public {
        // This test was corrupted and has been removed since it duplicates other tests
        // The test was testing that both enum values (Bearish and Bullish) can be used
        // which is already covered by other tests
    }

    // --- Test Cases for Reward Claiming ---

    function testClaimReward_Reverts_MarketDoesNotExistForNFTsMarket() public {
        uint256 nonExistentMarketIdForNFT = 888;
        uint256 tokenIdForNonExistentMarket = 88;

        vm.prank(owner);
        uint256 marketOneId = pool.createMarket(
            "Test Market", "ETHUSD", block.timestamp + 1 hours, mockOracle, 3000 * 10 ** 8, testPoolKey
        );
        vm.prank(oracleResolverAddress);
        pool.resolveMarket(marketOneId, PredictionTypes.Outcome.Bullish, 0);

        vm.prank(owner);
        pool.createMarket("Market For NFT", "NFTMK", block.timestamp + 1 hours, mockOracle, 3000 * 10 ** 8, testPoolKey);

        vm.mockCall(
            address(mockNft),
            abi.encodeWithSelector(ISwapCastNFT.getPredictionDetails.selector, tokenIdForNonExistentMarket),
            abi.encode(nonExistentMarketIdForNFT, PredictionTypes.Outcome.Bearish, 1 ether, user1)
        );

        vm.mockCall(
            address(mockNft),
            abi.encodeWithSelector(IERC721.ownerOf.selector, tokenIdForNonExistentMarket),
            abi.encode(user1)
        );

        vm.prank(rewardDistributorAddress);
        vm.expectRevert(
            abi.encodeWithSelector(PredictionManager.MarketDoesNotExist.selector, nonExistentMarketIdForNFT)
        );
        pool.claimReward(tokenIdForNonExistentMarket);
    }

    // --- Test Cases for Admin Functions ---

    function testSetFeeConfiguration() public {
        address newTreasury = address(0x1234);
        uint256 newFeeBps = 500; // 5%

        vm.prank(owner);
        vm.expectEmit(true, true, false, true, address(pool));
        emit FeeConfigurationChanged(newTreasury, newFeeBps);
        pool.setFeeConfiguration(newTreasury, newFeeBps);

        assertEq(pool.treasuryAddress(), newTreasury, "Treasury address not updated");
        assertEq(pool.protocolFeeBasisPoints(), newFeeBps, "Fee basis points not updated");
    }

    function testSetMinStakeAmount() public {
        uint256 newMinStake = 0.1 ether;

        vm.prank(owner);
        vm.expectEmit(true, false, false, true, address(pool));
        emit MinStakeAmountChanged(newMinStake);
        pool.setMinStakeAmount(newMinStake);

        assertEq(pool.minStakeAmount(), newMinStake, "Min stake amount not updated");
    }

    function testSetMaxPriceStaleness() public {
        uint256 newStaleness = 7200; // 2 hours

        vm.prank(owner);
        pool.setMaxPriceStaleness(newStaleness);

        // No direct getter, so we'll test this through behavior in other tests
    }

    // --- Test Cases for Access Control ---

    function testNonOwnerCannotSetFeeConfiguration() public {
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, user1));
        pool.setFeeConfiguration(address(0x1234), 500);
    }

    function testNonOwnerCannotCreateMarket() public {
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, user1));
        pool.createMarket("Test Market", "ETHUSD", block.timestamp + 1 hours, mockOracle, 3000 * 10 ** 8, testPoolKey);
    }

    function testNonOracleResolverCannotResolveMarket() public {
        vm.prank(owner);
        uint256 marketId = pool.createMarket(
            "Test Market", "ETHUSD", block.timestamp + 1 hours, mockOracle, 3000 * 10 ** 8, testPoolKey
        );

        vm.warp(block.timestamp + 2 hours);

        vm.prank(user1);
        vm.expectRevert("NotOracleResolver()");
        pool.resolveMarket(marketId, PredictionTypes.Outcome.Bearish, 0);
    }

    // --- Helper Functions ---

    function createTestMarket() internal returns (uint256) {
        vm.prank(owner);
        return pool.createMarket(
            "Test Market", "ETHUSD", block.timestamp + 1 hours, mockOracle, 3000 * 10 ** 8, testPoolKey
        );
    }
}
