// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title QorePQC
/// @notice Fail-closed wrappers for QoreChain's post-quantum precompiles.
/// @dev A precompile that is not active on a network answers a call with empty
///      data instead of reverting. Every function here treats anything other
///      than a complete, positive answer as "no", so a contract built on this
///      library can lock up when a precompile is missing, but can never be
///      opened by its absence.
library QorePQC {
    /// @dev `pqcVerify(bytes pubkey, bytes signature, bytes message) returns (bool)`
    address internal constant VERIFY = 0x0000000000000000000000000000000000000a01;

    /// @dev `pqcKeyStatus(address) returns (bool registered, uint8 algorithmId, bytes pubkey, bool possessionProven)`
    address internal constant KEY_STATUS = 0x0000000000000000000000000000000000000a02;

    /// @dev Algorithm id of ML-DSA-87 (FIPS 204, formerly Dilithium-5).
    uint8 internal constant ML_DSA_87 = 1;
    uint256 internal constant PUBLIC_KEY_LENGTH = 2592;
    uint256 internal constant SIGNATURE_LENGTH = 4627;

    /// @dev Smallest well-formed answer of `pqcKeyStatus`: four head words and the key's length word.
    uint256 private constant KEY_STATUS_MIN_RETURN = 160;

    struct Key {
        bool registered;
        uint8 algorithmId;
        bool possessionProven;
        bytes publicKey;
    }

    /// @notice The post-quantum key the chain has on record for `account`.
    /// @return key All-zero when the account has no key or the precompile gave no usable answer.
    function keyOf(address account) internal view returns (Key memory key) {
        (bool ok, bytes memory ret) = KEY_STATUS.staticcall(abi.encodeWithSignature("pqcKeyStatus(address)", account));
        if (!ok || ret.length < KEY_STATUS_MIN_RETURN) return key;
        (key.registered, key.algorithmId, key.publicKey, key.possessionProven) =
            abi.decode(ret, (bool, uint8, bytes, bool));
    }

    /// @notice True only for a registered ML-DSA-87 key of the right length whose
    ///         holder proved possession of the secret key when registering it.
    /// @dev Registration does not require a proof of possession, so `registered`
    ///      alone is not enough: without the proof, the key might belong to someone else.
    function isUsable(Key memory key) internal pure returns (bool) {
        return key.registered && key.possessionProven && key.algorithmId == ML_DSA_87
            && key.publicKey.length == PUBLIC_KEY_LENGTH;
    }

    /// @notice Checks an ML-DSA-87 signature. Never reverts.
    function verify(bytes memory publicKey, bytes memory signature, bytes memory message)
        internal
        view
        returns (bool)
    {
        (bool ok, bytes memory ret) =
            VERIFY.staticcall(abi.encodeWithSignature("pqcVerify(bytes,bytes,bytes)", publicKey, signature, message));
        return ok && ret.length == 32 && abi.decode(ret, (uint256)) == 1;
    }
}
