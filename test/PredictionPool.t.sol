// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import "src/PredictionPool.sol";

import {SwapCastNFT} from "src/SwapCastNFT.sol";

contract TestableSwapCastNFT is SwapCastNFT {
    // address public predictionPool; // This variable is not used by SwapCastNFT constructor

    constructor(address _initialOwner, string memory _name, string memory _symbol) 
        SwapCastNFT(_initialOwner, _name, _symbol) {}

    // function setPredictionPool(address _pool) public { // This function is not directly relevant to SwapCastNFT constructor
    //     predictionPool = _pool;
    // }
}

contract PredictionPoolTest is Test {
    PredictionPool pool;
    TestableSwapCastNFT nft;
    address treasury = address(0x123);
    uint256 feeBasisPoints = 100; // 1%

    function setUp() public {
        // Instantiate TestableSwapCastNFT with owner, name, symbol
        nft = new TestableSwapCastNFT(address(this), "TestNFT", "TNFT");
        // Instantiate PredictionPool with nft address, treasury, fee, owner
        pool = new PredictionPool(address(nft), treasury, feeBasisPoints, address(this));
        // If SwapCastNFT needs to know about PredictionPool for mint/burn, that would be set on the nft instance.
        // Assuming SwapCastNFT's setPredictionPoolAddress is how it's done:
        // nft.setPredictionPoolAddress(address(pool)); // This would require setPredictionPoolAddress on SwapCastNFT if it exists
    }

    /// @notice Test that market creation emits the correct event and stores correct data
    function testCreateMarket() public {
        uint256 marketIdToCreate = 0;
        // uint256 endTime = block.timestamp + 1 days; // endTime not part of current Market struct or createMarket

        vm.expectEmit(true, false, false, true); // Check emitter, topic1, topic2, data
        emit PredictionPool.MarketCreated(marketIdToCreate);
        
        pool.createMarket(marketIdToCreate);
        
        (uint256 mId, bool exists, bool resolved, uint8 winningOutcome, uint256 tsOutcome0, uint256 tsOutcome1) = pool.markets(marketIdToCreate);
        
        assertTrue(exists, "Market should exist after creation");
        assertEq(mId, marketIdToCreate, "Stored marketId mismatch");
        // assertEq(storedEndTime, endTime); // endTime is not part of the Market struct
    }

    /// @notice Test that recording a prediction emits the correct event and stores data
    function testRecordPrediction() public {
        uint256 marketIdToTest = 1;
        pool.createMarket(marketIdToTest);
        // uint256 endTime = block.timestamp + 1 days; // Not used by createMarket
        // uint256 marketId = pool.createMarket("Test Market", endTime); // Incorrect createMarket usage

        vm.expectEmit(true, false, false, true); // Adjusted for PredictionRecorded event signature
        // PredictionRecorded(address indexed user, uint256 indexed marketId, uint8 outcome, uint256 stakeAmount, uint256 feeAmount);
        // The actual event emitted from PredictionPool.recordPrediction is StakeRecorded and FeePaid.
        // For now, let's assume the test intent was to check if a prediction was made.
        // The original emit PredictionPool.PredictionRecorded(address(1), marketId, 0, 100) does not match any event in PredictionPool.sol.
        // Let's use the StakeRecorded event: event StakeRecorded(uint256 indexed marketId, address indexed user, uint8 outcome, uint256 stakeAmount);
        uint256 stake = 100 wei;
        uint256 expectedFee = (stake * feeBasisPoints) / 10000;
        uint256 expectedStakeAmount = stake - expectedFee;

        // Check for StakeRecorded event
        vm.expectEmit(true, true, true, true); // marketId, user, outcome, stakeAmount
        emit PredictionPool.StakeRecorded(marketIdToTest, address(1), 0, expectedStakeAmount);

        pool.recordPrediction{value: stake}(address(1), marketIdToTest, 0);
        
        // (address user,,,,) = pool.positionsByMarket(marketId, 0); // positionsByMarket does not exist
        // To verify, one might need to check the market's total stakes or a specific user's prediction count (if exposed)
        (,,,, uint256 totalStakeOutcome0, ) = pool.markets(marketIdToTest);
        assertEq(totalStakeOutcome0, expectedStakeAmount, "Total stake for outcome 0 mismatch");
    }

    /// @notice Test that recording after market end reverts with custom error
    function testCannotRecordAfterMarketResolved() public { // Renamed for clarity, as Market doesn't have an 'endTime'
        uint256 marketIdToTest = 2;
        pool.createMarket(marketIdToTest);
        // uint256 endTime = block.timestamp + 1; // Not used
        // uint256 marketId = pool.createMarket("Test Market", endTime); // Incorrect

        // Resolve the market first
        pool.resolveMarket(marketIdToTest, 0); // Assuming resolveMarket is onlyOwner or callable for test

        // vm.warp(endTime + 1); // Not relevant as market resolution is the key
        vm.expectRevert(abi.encodeWithSelector(PredictionPool.MarketAlreadyResolved.selector, marketIdToTest));
        pool.recordPrediction{value: 100 wei}(address(1), marketIdToTest, 0);
    }

    /// @notice Test that creating a market with zero address NFT was part of constructor logic - now testing constructor directly
    function testConstructorWithZeroNftAddressReverts() public {
        // PredictionPool constructor: address _swapCastNFTAddress, address _treasuryAddress, uint256 _initialFeeBasisPoints, address _initialOwner
        vm.expectRevert(abi.encodeWithSelector(PredictionPool.ZeroAddressInput.selector));
        new PredictionPool(address(0), treasury, feeBasisPoints, address(this));
    }

    /// @notice Test that duplicate predictions revert
    function testDuplicatePredictionReverts() public {
        uint256 marketIdToTest = 3;
        pool.createMarket(marketIdToTest);
        // uint256 endTime = block.timestamp + 1 days; // Not used
        // uint256 marketId = pool.createMarket("Test Market", endTime);

        pool.recordPrediction{value: 100 wei}(address(1), marketIdToTest, 0);
        vm.expectRevert(abi.encodeWithSelector(PredictionPool.AlreadyPredicted.selector, marketIdToTest, address(1)));
        pool.recordPrediction{value: 200 wei}(address(1), marketIdToTest, 0);
    }

    /// @notice Test that prediction with invalid outcome reverts
    function testInvalidOutcomeReverts() public {
        uint256 marketIdToTest = 4;
        pool.createMarket(marketIdToTest);
        // uint256 endTime = block.timestamp + 1 days; // Not used
        // uint256 marketId = pool.createMarket("Test Market", endTime);

        vm.expectRevert(abi.encodeWithSelector(PredictionPool.InvalidOutcome.selector, 3));
        pool.recordPrediction{value: 100 wei}(address(1), marketIdToTest, 3);
    }

    /// @notice Test that zero address cannot record prediction - this refers to user address
    function testZeroUserAddressPredictionReverts() public {
        uint256 marketIdToTest = 5;
        pool.createMarket(marketIdToTest);
        // uint256 endTime = block.timestamp + 1 days;
        // uint256 marketId = pool.createMarket("Test Market", endTime);
        // The error for user address(0) in recordPrediction might be different, or might not be explicitly checked.
        // PredictionPool.sol's recordPrediction has: if (_user == address(0)) revert ZeroAddressInput();
        vm.expectRevert(abi.encodeWithSelector(PredictionPool.ZeroAddressInput.selector));
        pool.recordPrediction{value: 100 wei}(address(0), marketIdToTest, 0);
    }

    function testResolveMarket() public {
        uint256 marketIdToTest = 6;
        pool.createMarket(marketIdToTest);
        // uint256 endTime = block.timestamp + 1; // Not used
        // uint256 marketId = pool.createMarket("Test Market", endTime);
        // vm.warp(endTime + 1); // Not relevant as market doesn't have endTime

        pool.resolveMarket(marketIdToTest, 1); // Assuming resolveMarket is callable (e.g. by owner)
        
        (uint256 mId, bool exists, bool resolved, uint8 outcomeFromMarket, uint256 tsOutcome0, uint256 tsOutcome1) = pool.markets(marketIdToTest);
        
        assertTrue(resolved, "Market should be resolved");
        assertEq(outcomeFromMarket, 1, "Winning outcome mismatch");
    }

    // getOdds function does not exist in PredictionPool.sol, commenting out this test
    // function testGetOdds() public {
    //     uint256 marketIdToTest = 7;
    //     pool.createMarket(marketIdToTest);
    //     // uint256 endTime = block.timestamp + 1 days;
    //     // uint256 marketId = pool.createMarket("Test Market", endTime);
    //     pool.recordPrediction{value: 50 wei}(address(1), marketIdToTest, 0);
    //     pool.recordPrediction{value: 150 wei}(address(2), marketIdToTest, 1);
    //     uint256 odds0 = pool.getOdds(marketIdToTest, 0);
    //     uint256 odds1 = pool.getOdds(marketIdToTest, 1);
    //     assertEq(odds0, 25e16); // 50/200 = 0.25
    //     assertEq(odds1, 75e16); // 150/200 = 0.75
    // }
}
