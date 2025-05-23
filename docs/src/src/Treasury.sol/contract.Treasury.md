# Treasury
[Git Source](https://github.com/s-di-cola/swapcast/blob/fd3e92ac000764a2f74374fcba21b9ac2c9b9c35/src/Treasury.sol)

**Inherits:**
Ownable, ReentrancyGuard

**Author:**
Simone Di Cola

Holds protocol fees (ETH) collected, primarily from the PredictionPool, and allows the owner to withdraw them.

*This contract uses a `receive()` fallback to accept ETH deposits. Only the owner, designated
at deployment, can initiate withdrawals. It employs standard OpenZeppelin Ownable for access control.*


## Functions
### constructor

Contract constructor.

*Reverts if initialOwner is address(0).*


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
without any specific function signature. Emits a [FeeReceived](/src/Treasury.sol/contract.Treasury.md#feereceived) event if value is greater than zero.
Primarily intended for use by the PredictionPool contract to transfer collected fees.*


```solidity
receive() external payable;
```

### withdraw

Allows the contract owner to withdraw a specified amount of ETH from the Treasury.

*Only callable by the owner. The recipient address `_to` must not be the zero address.
Reverts with [NotEnoughBalance](/src/Treasury.sol/contract.Treasury.md#notenoughbalance) if `_amount` exceeds the contract's balance.
Reverts with {WithdrawalFailed} if the ETH transfer fails.
Emits an {OwnerWithdrawal} event on successful withdrawal.*


```solidity
function withdraw(uint256 _amount, address payable _to) external onlyOwner nonReentrant;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_amount`|`uint256`|The amount of ETH to withdraw.|
|`_to`|`address payable`|The payable address to which the ETH should be sent.|


### withdrawAll

Allows the contract owner to withdraw the entire ETH balance from the Treasury.

*Only callable by the owner. The recipient address `_to` must not be the zero address.
Reverts if the Treasury's balance is zero using [NotEnoughBalance](/src/Treasury.sol/contract.Treasury.md#notenoughbalance).
Reverts with {WithdrawalFailed} if the ETH transfer fails.
Emits an {OwnerWithdrawal} event on successful withdrawal.*


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
Reverts if an ETH withdrawal call (e.g., to the owner's address) fails.


```solidity
error WithdrawalFailed();
```

### NotEnoughBalance
Reverts if a withdrawal is attempted for an amount greater than the Treasury's current balance.


```solidity
error NotEnoughBalance(uint256 requested, uint256 available);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`requested`|`uint256`|The amount of ETH requested for withdrawal.|
|`available`|`uint256`|The current ETH balance available in the Treasury.|

### ZeroAddress
Reverts if an operation is attempted with a zero address where it's not allowed (e.g., withdrawing to address(0)).


```solidity
error ZeroAddress(string message);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`message`|`string`|A descriptive message explaining the context of the zero address error.|

