// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {HybridAuth} from "../HybridAuth.sol";

/// @title HybridAccount
/// @notice Example of reusing `HybridAuth`: an account contract that makes any call
///         (a token transfer, an approval, a contract interaction) only when the
///         owner's secp256k1 key and registered ML-DSA-87 key both sign for it.
///
/// @dev Assets held here are out of reach of the owner's secp256k1 key alone, in
///      or out of an EVM authorisation window.
///
///      The call data enters the intent as its keccak256 hash, as EIP-712 does for
///      dynamic fields. Forging a different call against a signed intent therefore
///      needs a second preimage of keccak256.
///
///      This contract accepts value from anyone, the owner included. Value the
///      owner account sends in can only leave with both signatures.
contract HybridAccount is HybridAuth {
    event Executed(address indexed target, uint256 value, bytes data, uint256 nonce);

    error ZeroOwner();
    error Expired();
    error CallFailed(bytes returndata);

    bytes32 public constant EXECUTE_TYPEHASH =
        keccak256("Execute(address target,uint256 value,bytes32 dataHash,uint256 nonce,uint256 deadline)");

    address public immutable owner;
    uint256 public nonce;

    constructor(address owner_) HybridAuth("Hybrid Account", "1") {
        if (owner_ == address(0)) revert ZeroOwner();
        owner = owner_;
    }

    receive() external payable {}

    /// @notice The intent both keys sign for the next call.
    function executeIntent(address target, uint256 value, bytes calldata data, uint256 deadline)
        public
        view
        returns (bytes memory)
    {
        return abi.encode(EXECUTE_TYPEHASH, target, value, keccak256(data), nonce, deadline);
    }

    /// @notice Make a call from this account. Reverts unless both keys signed for exactly this call.
    function execute(
        address target,
        uint256 value,
        bytes calldata data,
        uint256 deadline,
        bytes calldata classicalSignature,
        bytes calldata postQuantumSignature
    ) external returns (bytes memory result) {
        if (block.timestamp > deadline) revert Expired();
        _requireHybrid(owner, executeIntent(target, value, data, deadline), classicalSignature, postQuantumSignature);

        uint256 used = nonce;
        nonce = used + 1;

        bool ok;
        (ok, result) = target.call{value: value}(data);
        if (!ok) revert CallFailed(result);
        emit Executed(target, value, data, used);
    }
}
