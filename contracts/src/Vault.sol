// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuardTransient} from "@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol";
import {HybridAuth} from "./HybridAuth.sol";
import {QorePQC} from "./QorePQC.sol";

/// @title Vault
/// @notice Holds native QOR for `owner` and pays out against a withdrawal intent.
///
/// One contract, two configurations, chosen at deployment:
///
///   postQuantum = false   the control. A withdrawal needs the owner's secp256k1
///                         authority only, as on any EVM chain.
///   postQuantum = true    the same, plus an ML-DSA-87 signature over the intent,
///                         checked against the key the chain has on record for the owner.
///
/// Both are the same bytecode with one immutable flag, so two instances with the
/// same owner form a controlled experiment: publish the owner's secp256k1 key and
/// the first can be emptied by anyone, the second by no one who lacks the
/// post-quantum key.
///
/// @dev A refused withdrawal does not revert. It is counted and logged, so the
///      record of attempts lives in contract storage and can be read by anyone
///      without trusting an indexer or a website. `withdraw` therefore returns
///      a `Refusal`; `Refusal.None` means the payment was made.
contract Vault is HybridAuth, ReentrancyGuardTransient {
    /// @notice Why a withdrawal was refused, in the order the checks run.
    enum Refusal {
        None, // paid
        Expired, // the intent's deadline has passed
        WrongNonce, // the intent was already used, or is out of order
        NotAuthorized, // no secp256k1 authority from the owner
        PqKeyUnavailable, // the owner has no usable ML-DSA-87 key on record (or the precompile is off)
        PqSignatureMalformed, // the post-quantum signature is missing or has the wrong length
        PqSignatureInvalid // the post-quantum signature does not verify
    }

    /// @dev One storage slot per entry of the recent-activity ring.
    struct Entry {
        address caller;
        uint48 blockNumber;
        uint8 refusal;
        bool keyholder;
    }

    struct Stats {
        uint256 balance;
        uint256 nonce;
        uint256 paidTotal;
        uint256 counterfactualLoss;
        uint64 paidCount;
        uint64 refusedCount;
        uint64 keyholderRefusedCount;
        uint64 counterfactualThefts;
        uint64 deployedAt;
        uint64 lastPaidAt;
        uint64 lastRefusedAt;
        uint64[7] refusedBy;
    }

    struct Counters {
        uint64 paid;
        uint64 refused;
        uint64 keyholderRefused;
        uint64 counterfactualThefts;
    }

    struct Marks {
        uint64 lastPaidAt;
        uint64 lastRefusedAt;
        uint64 cursor;
    }

    event Paid(address indexed to, uint256 amount, uint256 nonce, address indexed caller);
    event Refused(
        address indexed caller, address indexed to, uint256 amount, uint256 nonce, Refusal reason, bool keyholder
    );
    event Deposited(address indexed from, uint256 amount);

    error ZeroOwner();
    error OwnerCannotDeposit();
    error InsufficientBalance(uint256 requested, uint256 available);
    error TransferFailed();

    bytes32 public constant WITHDRAW_TYPEHASH =
        keccak256("Withdraw(address to,uint256 amount,uint256 nonce,uint256 deadline)");

    /// @notice How many recent attempts are kept in storage.
    uint256 public constant RECENT = 16;

    /// @notice The account whose two keys authorise withdrawals.
    address public immutable owner;

    /// @notice Whether withdrawals also need the owner's ML-DSA-87 signature.
    bool public immutable postQuantum;

    uint64 public immutable deployedAt;

    /// @notice The nonce the next withdrawal intent must carry.
    uint256 public nonce;

    /// @notice Total paid out.
    uint256 public paidTotal;

    /// @notice What refused attempts would have taken from a vault with the classical lock alone.
    /// @dev Sum, over attempts that passed the deadline, nonce and classical checks and were
    ///      stopped only by the post-quantum layer, of min(requested amount, balance at the time).
    uint256 public counterfactualLoss;

    Counters private _counters;
    Marks private _marks;
    uint64[7] private _refusedBy;
    Entry[RECENT] private _recent;

    constructor(address owner_, bool postQuantum_) HybridAuth("Steal This Vault", "1") {
        if (owner_ == address(0)) revert ZeroOwner();
        owner = owner_;
        postQuantum = postQuantum_;
        deployedAt = uint64(block.number);
    }

    /// @notice Anyone except the owner account may add QOR over the EVM.
    /// @dev An EVM authorisation window scoped to this contract limits where the
    ///      owner account may send transactions, not how much value they carry.
    ///      If this contract took the owner's QOR over the EVM and then released
    ///      it on classical authority, it would be a forwarder for the owner's
    ///      liquid balance. So the owner funds the vault from the native lane,
    ///      where the transfer itself needs the post-quantum signature.
    receive() external payable {
        if (msg.sender == owner) revert OwnerCannotDeposit();
        emit Deposited(msg.sender, msg.value);
    }

    /// @notice Pay `amount` to `to` if the intent is authorised; otherwise record the refusal.
    /// @param to Recipient named in the intent.
    /// @param amount Amount in wei named in the intent.
    /// @param nonce_ Nonce named in the intent; must equal `nonce`.
    /// @param deadline Last second, in block time, at which the intent is valid.
    /// @param classicalSignature 65-byte secp256k1 signature of `withdrawDigest`. May be empty
    ///        when the owner account itself sends the transaction.
    /// @param postQuantumSignature ML-DSA-87 signature of `withdrawSignBytes`. Ignored by a
    ///        vault deployed with `postQuantum = false`.
    /// @return refusal `Refusal.None` when paid.
    /// @dev Anyone may submit an intent. Authority comes from the signatures, so a relayer,
    ///      or a front-runner copying the transaction, can only cause the same payment.
    function withdraw(
        address payable to,
        uint256 amount,
        uint256 nonce_,
        uint256 deadline,
        bytes calldata classicalSignature,
        bytes calldata postQuantumSignature
    ) external nonReentrant returns (Refusal refusal) {
        bool keyholder;
        (refusal, keyholder) = _judge(to, amount, nonce_, deadline, classicalSignature, postQuantumSignature);

        if (refusal != Refusal.None) {
            _recordRefusal(refusal, keyholder, to, amount, nonce_);
            return refusal;
        }

        uint256 available = address(this).balance;
        if (amount > available) revert InsufficientBalance(amount, available);

        nonce = nonce_ + 1;
        paidTotal += amount;
        _counters.paid += 1;
        _push(Refusal.None, true);
        emit Paid(to, amount, nonce_, msg.sender);

        (bool sent,) = to.call{value: amount}("");
        if (!sent) revert TransferFailed();
    }

    /// @notice What `withdraw` would decide for the caller, without changing anything.
    /// @dev Call it with `eth_call` and a `from` address to ask the vault a question for free.
    function judge(
        address payable to,
        uint256 amount,
        uint256 nonce_,
        uint256 deadline,
        bytes calldata classicalSignature,
        bytes calldata postQuantumSignature
    ) external view returns (Refusal refusal, bool keyholder) {
        return _judge(to, amount, nonce_, deadline, classicalSignature, postQuantumSignature);
    }

    /// @notice The intent both keys sign for a withdrawal: the EIP-712 struct encoding.
    function withdrawIntent(address to, uint256 amount, uint256 nonce_, uint256 deadline)
        public
        pure
        returns (bytes memory)
    {
        return abi.encode(WITHDRAW_TYPEHASH, to, amount, nonce_, deadline);
    }

    /// @notice The EIP-712 digest the owner's secp256k1 key signs.
    function withdrawDigest(address to, uint256 amount, uint256 nonce_, uint256 deadline)
        external
        view
        returns (bytes32)
    {
        return hybridDigest(withdrawIntent(to, amount, nonce_, deadline));
    }

    /// @notice The bytes the owner's ML-DSA-87 key signs.
    function withdrawSignBytes(address to, uint256 amount, uint256 nonce_, uint256 deadline)
        external
        view
        returns (bytes memory)
    {
        return hybridSignBytes(owner, withdrawIntent(to, amount, nonce_, deadline));
    }

    /// @notice The owner's post-quantum key as the chain reports it right now.
    function ownerKey()
        external
        view
        returns (bool usable, bool registered, bool possessionProven, uint8 algorithmId, bytes memory publicKey)
    {
        QorePQC.Key memory key = QorePQC.keyOf(owner);
        return (QorePQC.isUsable(key), key.registered, key.possessionProven, key.algorithmId, key.publicKey);
    }

    /// @notice Every counter in one call.
    function stats() external view returns (Stats memory s) {
        Counters memory c = _counters;
        Marks memory m = _marks;
        s.balance = address(this).balance;
        s.nonce = nonce;
        s.paidTotal = paidTotal;
        s.counterfactualLoss = counterfactualLoss;
        s.paidCount = c.paid;
        s.refusedCount = c.refused;
        s.keyholderRefusedCount = c.keyholderRefused;
        s.counterfactualThefts = c.counterfactualThefts;
        s.deployedAt = deployedAt;
        s.lastPaidAt = m.lastPaidAt;
        s.lastRefusedAt = m.lastRefusedAt;
        s.refusedBy = _refusedBy;
    }

    /// @notice The latest attempts, newest first. At most `RECENT` entries.
    /// @dev Kept in storage because the network prunes old blocks and their logs.
    function recent() external view returns (Entry[] memory entries) {
        uint256 cursor = _marks.cursor;
        uint256 count = cursor < RECENT ? cursor : RECENT;
        entries = new Entry[](count);
        for (uint256 i = 0; i < count; i++) {
            entries[i] = _recent[(cursor - 1 - i) % RECENT];
        }
    }

    function _judge(
        address payable to,
        uint256 amount,
        uint256 nonce_,
        uint256 deadline,
        bytes calldata classicalSignature,
        bytes calldata postQuantumSignature
    ) private view returns (Refusal, bool keyholder) {
        bytes memory intent = withdrawIntent(to, amount, nonce_, deadline);
        keyholder = _classicalLayer(owner, intent, classicalSignature);

        if (block.timestamp > deadline) return (Refusal.Expired, keyholder);
        if (nonce_ != nonce) return (Refusal.WrongNonce, keyholder);
        if (!keyholder) return (Refusal.NotAuthorized, false);
        if (!postQuantum) return (Refusal.None, true);

        PqCheck check = _postQuantumLayer(owner, intent, postQuantumSignature);
        if (check == PqCheck.Valid) return (Refusal.None, true);
        if (check == PqCheck.KeyUnavailable) return (Refusal.PqKeyUnavailable, true);
        if (check == PqCheck.SignatureMalformed) return (Refusal.PqSignatureMalformed, true);
        return (Refusal.PqSignatureInvalid, true);
    }

    function _recordRefusal(Refusal refusal, bool keyholder, address to, uint256 amount, uint256 nonce_) private {
        Counters memory c = _counters;
        c.refused += 1;
        if (keyholder) c.keyholderRefused += 1;
        if (uint8(refusal) >= uint8(Refusal.PqKeyUnavailable)) {
            // The deadline, the nonce and the classical layer all passed. A vault with
            // the classical lock alone would have paid this.
            c.counterfactualThefts += 1;
            uint256 available = address(this).balance;
            counterfactualLoss += amount < available ? amount : available;
        }
        _counters = c;
        _refusedBy[uint8(refusal)] += 1;
        _push(refusal, keyholder);
        emit Refused(msg.sender, to, amount, nonce_, refusal, keyholder);
    }

    function _push(Refusal refusal, bool keyholder) private {
        Marks memory m = _marks;
        _recent[m.cursor % RECENT] = Entry(msg.sender, uint48(block.number), uint8(refusal), keyholder);
        m.cursor += 1;
        if (refusal == Refusal.None) m.lastPaidAt = uint64(block.number);
        else m.lastRefusedAt = uint64(block.number);
        _marks = m;
    }
}
