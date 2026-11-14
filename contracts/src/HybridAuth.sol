// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {QorePQC} from "./QorePQC.sol";

/// @title HybridAuth
/// @notice Authorise a contract action with two signatures over one intent: the
///         signer's secp256k1 key and the ML-DSA-87 key the chain has on record
///         for the same account.
///
/// @dev QoreChain requires this pair on every native-lane transaction. The EVM
///      lane cannot ask for it per transaction, because an EVM wallet signs with
///      secp256k1 only; the chain bounds that exposure with an EVM authorisation
///      window instead. Inside an open window a holder of the secp256k1 key can
///      still call any admitted contract. This base lets a contract demand the
///      second signature itself, for the actions that matter.
///
///      An intent is `abi.encode(TYPEHASH, field, ...)`, the EIP-712 struct
///      encoding. The two layers sign different bytes derived from it:
///
///      - classical: the EIP-712 digest, so wallets can display what is signed;
///      - post-quantum: the whole intent behind a domain tag (`hybridSignBytes`),
///        not a 256-bit hash of it.
///
///      The post-quantum key is read from the chain at verification time, so a
///      key rotation on the native lane takes effect here at once and old
///      signatures stop working.
abstract contract HybridAuth is EIP712 {
    enum PqCheck {
        Valid,
        KeyUnavailable,
        SignatureMalformed,
        SignatureInvalid
    }

    error ClassicalSignatureRejected();
    error PostQuantumSignatureRejected(PqCheck reason);

    /// @notice First bytes of everything the post-quantum key signs for this scheme.
    /// @dev Every sign-bytes format the chain itself uses starts with "qorechain-",
    ///      so an ML-DSA-87 signature published in a native transaction can never
    ///      be presented here, and a signature made for this scheme can never be
    ///      attached to a native transaction.
    bytes public constant PQ_DOMAIN_TAG = "\x19Qore Hybrid Intent v1\n";

    constructor(string memory name, string memory version) EIP712(name, version) {}

    /// @notice What the secp256k1 key signs: the EIP-712 digest of `intent`.
    function hybridDigest(bytes memory intent) public view returns (bytes32) {
        return _hashTypedDataV4(keccak256(intent));
    }

    /// @notice What the ML-DSA-87 key signs.
    /// @dev tag, chain id, this contract, signer, intent, concatenated. Every field before
    ///      the intent has a fixed length, so the encoding is unambiguous.
    function hybridSignBytes(address signer, bytes memory intent) public view returns (bytes memory) {
        return abi.encodePacked(PQ_DOMAIN_TAG, block.chainid, address(this), signer, intent);
    }

    /// @dev A transaction sent by `signer` already carries its secp256k1 signature,
    ///      so it satisfies this layer without a separate one.
    function _classicalLayer(address signer, bytes memory intent, bytes calldata signature)
        internal
        view
        returns (bool)
    {
        if (msg.sender == signer) return true;
        (address recovered, ECDSA.RecoverError err,) = ECDSA.tryRecover(hybridDigest(intent), signature);
        return err == ECDSA.RecoverError.NoError && recovered == signer;
    }

    function _postQuantumLayer(address signer, bytes memory intent, bytes calldata signature)
        internal
        view
        returns (PqCheck)
    {
        QorePQC.Key memory key = QorePQC.keyOf(signer);
        if (!QorePQC.isUsable(key)) return PqCheck.KeyUnavailable;
        if (signature.length != QorePQC.SIGNATURE_LENGTH) return PqCheck.SignatureMalformed;
        return QorePQC.verify(key.publicKey, signature, hybridSignBytes(signer, intent))
            ? PqCheck.Valid
            : PqCheck.SignatureInvalid;
    }

    /// @notice Reverts unless both layers accept `intent` for `signer`.
    function _requireHybrid(address signer, bytes memory intent, bytes calldata classical, bytes calldata postQuantum)
        internal
        view
    {
        if (!_classicalLayer(signer, intent, classical)) revert ClassicalSignatureRejected();
        PqCheck check = _postQuantumLayer(signer, intent, postQuantum);
        if (check != PqCheck.Valid) revert PostQuantumSignatureRejected(check);
    }
}
