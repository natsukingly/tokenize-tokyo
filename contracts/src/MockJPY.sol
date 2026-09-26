// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Valueless, unrestricted TEST faucet. Never deploy as real money.
contract MockJPY is ERC20 {
    constructor() ERC20("Mock JPY - TEST ONLY", "mJPY") {}

    function mint(address to, uint256 amount) external {
        require(amount <= 1_000_000 ether, "Faucet limit");
        _mint(to, amount);
    }
}
