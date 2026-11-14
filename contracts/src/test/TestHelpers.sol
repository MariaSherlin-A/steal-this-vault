// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

interface IVault {
    function withdraw(
        address payable to,
        uint256 amount,
        uint256 nonce_,
        uint256 deadline,
        bytes calldata classicalSignature,
        bytes calldata postQuantumSignature
    ) external returns (uint8);
}

/// @dev Test only. A recipient that calls back into the vault while being paid.
contract ReentrantReceiver {
    IVault public immutable vault;
    bytes public replay;
    bool public swallow;
    bool public reentered;
    bytes public innerError;

    constructor(IVault vault_) {
        vault = vault_;
    }

    /// @param replay_ Call data to send back to the vault from inside `receive`.
    /// @param swallow_ Whether to hide the inner failure so the outer payment can finish.
    function arm(bytes calldata replay_, bool swallow_) external {
        replay = replay_;
        swallow = swallow_;
    }

    receive() external payable {
        if (replay.length == 0) return;
        (bool ok, bytes memory ret) = address(vault).call(replay);
        reentered = true;
        innerError = ret;
        if (!ok && !swallow) {
            assembly {
                revert(add(ret, 32), mload(ret))
            }
        }
    }
}

/// @dev Test only. A recipient that refuses payment.
contract RejectingReceiver {
    receive() external payable {
        revert("no thanks");
    }
}

/// @dev Test only. A plain token for the HybridAccount example.
contract TestToken is ERC20 {
    constructor() ERC20("Test Token", "TEST") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
