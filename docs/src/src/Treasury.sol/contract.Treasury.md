# Treasury
[Git Source](https://github.com/s-di-cola/swapcast/blob/78d83b3891b75427036d031bae98f2a70765843d/src/Treasury.sol)

**Inherits:**
Ownable, ReentrancyGuard

**Author:**
Simone Di Cola

Holds protocol fees (ETH) collected, primarily from the PredictionManager, and allows the owner to withdraw them.

*This contract uses a `receive()` fallback to accept ETH deposits. Only the owner, designated
at deployment, can initiate withdrawals. It employs standard OpenZeppelin Ownable for access control
and ReentrancyGuard to prevent reentrancy attacks during withdrawals.
The contract has the following key features:
1. Secure ETH storage with reentrancy protection on withdrawals
2. Owner-only withdrawal functions with comprehensive validation
3. Detailed event emissions for all fund movements
4. Comprehensive error handling with descriptive error messages*

**Note:**
security-contact: security@swapcast.xyz


## Functions
### constructor

Contract constructor that initializes the Treasury with an owner address.

*Sets up the owner who will have withdrawal privileges. The owner address is validated
to ensure it's not the zero address, which would lock the contract's funds permanently.*

**Note:**
reverts: ZeroAddress If the initialOwner is the zero address.


```solidity
constructor(address initialOwner) Ownable(initialOwner);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`initialOwner`|`address`|The initial owner of this Treasury contract, who will have withdrawal privileges.|


### receive

Allows the Treasury to receive ETH. This is the primary mechanism for fee deposits.

*This `receive()` external payable function is called when ETH is sent to this contract's address
without any specific function signature. It emits a [FeeReceived](/src/Treasury.sol/contract.Treasury.md#feereceived) event if value is greater than zero,
providing transparency for all incoming funds.
Primarily intended for use by the PredictionManager contract to transfer collected protocol fees,
but can receive ETH from any source. No access control is applied to incoming transfers.
The function is intentionally kept simple and gas-efficient, with minimal logic to reduce the
chance of failures when receiving funds.*


```solidity
receive() external payable;
```

### withdraw

Allows the contract owner to withdraw a specified amount of ETH from the Treasury.

*This function includes multiple security features:
1. Owner-only access control via the onlyOwner modifier
2. Reentrancy protection via the nonReentrant modifier
3. Comprehensive input validation for both address and amount
4. Balance verification before attempting the transfer
5. Low-level call with success verification
The function performs the following steps:
1. Validates that the recipient address is not zero
2. Validates that the withdrawal amount is not zero
3. Checks that the requested amount does not exceed the available balance
4. Performs the ETH transfer using a low-level call
5. Verifies the success of the transfer
6. Emits an OwnerWithdrawal event with details of the transaction*

**Notes:**
- reverts: ZeroAddress If the recipient address is the zero address or the amount is zero.

- reverts: NotEnoughBalance If the requested amount exceeds the contract's balance.

- reverts: WithdrawalFailed If the ETH transfer fails for any reason.

- emits: OwnerWithdrawal On successful withdrawal with recipient and amount.


```solidity
function withdraw(uint256 _amount, address payable _to) external onlyOwner nonReentrant;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_amount`|`uint256`|The amount of ETH to withdraw.|
|`_to`|`address payable`|The payable address to which the ETH should be sent.|


### withdrawAll

Allows the contract owner to withdraw the entire ETH balance from the Treasury in a single transaction.

*This is a convenience function that withdraws all available ETH at once. It includes the same
security features as the withdraw function:
1. Owner-only access control via the onlyOwner modifier
2. Reentrancy protection via the nonReentrant modifier
3. Comprehensive input validation for the recipient address
4. Balance verification to prevent empty withdrawals
5. Low-level call with success verification
The function performs the following steps:
1. Validates that the recipient address is not zero
2. Retrieves and validates the current contract balance
3. Performs the ETH transfer using a low-level call
4. Verifies the success of the transfer
5. Emits an OwnerWithdrawal event with details of the transaction*

**Notes:**
- reverts: ZeroAddress If the recipient address is the zero address.

- reverts: NotEnoughBalance If the Treasury's balance is zero.

- reverts: WithdrawalFailed If the ETH transfer fails for any reason.

- emits: OwnerWithdrawal On successful withdrawal with recipient and the full balance amount.


```solidity
function withdrawAll(address payable _to) external onlyOwner nonReentrant;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_to`|`address payable`|The payable address to which the entire balance should be sent.|


## Events
### FeeReceived
Emitted when ETH is successfully received by the Treasury via the `receive()` function.


```solidity
event FeeReceived(address indexed from, uint256 amount);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`from`|`address`|The address that sent the ETH (e.g., PredictionPool).|
|`amount`|`uint256`|The amount of ETH received.|

### OwnerWithdrawal
Emitted when the owner successfully withdraws ETH from the Treasury.


```solidity
event OwnerWithdrawal(address indexed to, uint256 amount);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`to`|`address`|The address to which the ETH was sent.|
|`amount`|`uint256`|The amount of ETH withdrawn.|

## Errors
### WithdrawalFailed
Thrown when an ETH withdrawal call fails due to a low-level error.

*This can happen if the recipient is a contract that reverts in its receive function,
or if there's a gas-related issue during the transfer.*


```solidity
error WithdrawalFailed();
```

### NotEnoughBalance
Thrown when a withdrawal is attempted for an amount greater than the Treasury's current balance.

*This error includes both the requested amount and available balance to provide clear feedback.
It's also used when attempting to withdraw all funds from an empty treasury.*


```solidity
error NotEnoughBalance(uint256 requested, uint256 available);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`requested`|`uint256`|The amount of ETH requested for withdrawal.|
|`available`|`uint256`|The current ETH balance available in the Treasury.|

### ZeroAddress
Thrown when an operation is attempted with a zero address or zero amount where it's not allowed.

*This error includes a descriptive message to clarify the specific context of the error,
such as "Withdrawal address cannot be zero" or "Withdrawal amount cannot be zero".*


```solidity
error ZeroAddress(string message);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`message`|`string`|A descriptive message explaining the context of the zero address or zero value error.|

