// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {UrbanRightToken} from "./UrbanRightToken.sol";
import {BasketVault} from "./BasketVault.sol";

interface ITradable {
    function isTradable(uint256 id) external view returns (bool);
}

contract UrbanMarketplace is ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Listing {
        address seller;
        address token;
        uint256 rightId;
        uint256 remaining;
        uint256 unitPrice;
        bool cancelled;
    }
    address public immutable rights;
    address public immutable baskets;
    IERC20 public immutable paymentToken;
    uint256 public nextListingId = 1;
    mapping(uint256 => Listing) public listings;
    event ListingCreated(
        uint256 indexed listingId,
        address indexed seller,
        address indexed token,
        uint256 rightId,
        uint256 amount,
        uint256 unitPrice
    );
    event ListingPurchased(
        uint256 indexed listingId,
        address indexed buyer,
        address indexed seller,
        address token,
        uint256 rightId,
        uint256 amount,
        uint256 totalPrice
    );
    event ListingCancelled(uint256 indexed listingId, address indexed seller);

    constructor(UrbanRightToken r, BasketVault b, address cash) {
        rights = address(r);
        baskets = address(b);
        paymentToken = IERC20(cash);
    }

    function createListing(address token, uint256 id, uint256 amount, uint256 price)
        external
        returns (uint256 listingId)
    {
        require((token == rights || token == baskets) && ITradable(token).isTradable(id), "Not tradable");
        require(
            amount > 0 && price > 0 && IERC1155(token).balanceOf(msg.sender, id) >= amount
                && IERC1155(token).isApprovedForAll(msg.sender, address(this)),
            "Balance or approval"
        );
        listingId = nextListingId++;
        listings[listingId] = Listing(msg.sender, token, id, amount, price, false);
        emit ListingCreated(listingId, msg.sender, token, id, amount, price);
    }

    function purchase(uint256 id, uint256 amount) external nonReentrant {
        Listing storage l = listings[id];
        require(
            l.seller != address(0) && !l.cancelled && amount > 0 && amount <= l.remaining && msg.sender != l.seller,
            "Invalid order"
        );
        require(ITradable(l.token).isTradable(l.rightId), "Not tradable");
        l.remaining -= amount;
        uint256 total = amount * l.unitPrice;
        paymentToken.safeTransferFrom(msg.sender, l.seller, total);
        IERC1155(l.token).safeTransferFrom(l.seller, msg.sender, l.rightId, amount, "");
        emit ListingPurchased(id, msg.sender, l.seller, l.token, l.rightId, amount, total);
    }

    function cancelListing(uint256 id) external {
        Listing storage l = listings[id];
        require(l.seller == msg.sender && !l.cancelled, "Not seller");
        l.cancelled = true;
        emit ListingCancelled(id, msg.sender);
    }
}
