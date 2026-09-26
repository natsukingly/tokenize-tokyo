// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {UrbanMarketplace} from "./UrbanMarketplace.sol";

/// @notice Testnet-only bridge from a server-verified card payment to an existing listing.
/// The operator pays gas; this contract spends prefunded MockJPY. No fiat is handled on chain.
contract CardPurchaseExecutor is ERC1155Holder, ReentrancyGuard {
    using SafeERC20 for IERC20;

    UrbanMarketplace public immutable market;
    address public immutable operator;
    mapping(bytes32 => bytes32) public fulfilled;
    event CardPurchaseFulfilled(bytes32 indexed orderId, address indexed recipient, uint256 indexed listingId,
        uint256 quantity, uint256 total, bytes32 commitment);

    constructor(UrbanMarketplace m, address signer) {
        require(block.chainid == 31337 || block.chainid == 11155111 || block.chainid == 2017072401, "Testnet only");
        require(address(m).code.length > 0 && signer != address(0), "Invalid configuration");
        market = m;
        operator = signer;
    }

    function fulfill(bytes32 orderId, uint256 listingId, uint256 quantity, address recipient, uint256 expectedTotal)
        external nonReentrant
    {
        require(msg.sender == operator, "Operator only");
        require(orderId != bytes32(0) && fulfilled[orderId] == bytes32(0), "Order already fulfilled");
        require(recipient != address(0) && recipient != address(this) && recipient != operator, "Invalid recipient");
        (address seller, address token, uint256 rightId, uint256 remaining, uint256 price, bool cancelled) =
            market.listings(listingId);
        require(!cancelled && quantity > 0 && quantity <= remaining && recipient != seller, "Invalid order");
        uint256 total = quantity * price;
        require(total == expectedTotal && total > 0, "Price changed");
        bytes32 commitment = keccak256(abi.encode(listingId, quantity, recipient, total));
        fulfilled[orderId] = commitment;
        IERC20 cash = market.paymentToken();
        cash.forceApprove(address(market), total);
        market.purchase(listingId, quantity);
        IERC1155(token).safeTransferFrom(address(this), recipient, rightId, quantity, "");
        emit CardPurchaseFulfilled(orderId, recipient, listingId, quantity, total, commitment);
    }
}
