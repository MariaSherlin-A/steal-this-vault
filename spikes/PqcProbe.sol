// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// Spike contract: proves a contract can check an ML-DSA-87 signature against
/// the owner's chain-registered key, and record failed attempts instead of reverting.
contract PqcProbe {
    address constant PQC_VERIFY = 0x0000000000000000000000000000000000000a01;
    address constant PQC_KEY_STATUS = 0x0000000000000000000000000000000000000a02;

    address public immutable owner;
    uint256 public passed;
    uint256 public failed;

    event Checked(address indexed caller, bool valid);

    constructor() {
        owner = msg.sender;
    }

    function keyOf(address a)
        public
        view
        returns (bool registered, uint8 algorithmId, bytes memory pubkey, bool possessionProven)
    {
        (bool ok, bytes memory ret) = PQC_KEY_STATUS.staticcall(abi.encodeWithSignature("pqcKeyStatus(address)", a));
        require(ok && ret.length >= 96, "key status precompile unavailable");
        return abi.decode(ret, (bool, uint8, bytes, bool));
    }

    function verify(bytes memory pubkey, bytes calldata signature, bytes calldata message) public view returns (bool) {
        (bool ok, bytes memory ret) = PQC_VERIFY.staticcall(
            abi.encodeWithSignature("pqcVerify(bytes,bytes,bytes)", pubkey, signature, message)
        );
        // An inactive precompile returns empty data: treat that as "not verified".
        if (!ok || ret.length < 32) return false;
        return abi.decode(ret, (bool));
    }

    /// Checks `signature` over `message` against the owner's registered key.
    /// Never reverts on a bad signature: it counts it.
    function check(bytes calldata signature, bytes calldata message) external returns (bool valid) {
        (bool registered,, bytes memory pubkey, bool pop) = keyOf(owner);
        valid = registered && pop && verify(pubkey, signature, message);
        if (valid) passed++;
        else failed++;
        emit Checked(msg.sender, valid);
    }
}
