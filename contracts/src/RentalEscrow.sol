// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {UrbanRightToken} from "./UrbanRightToken.sol";

/// Custody-backed temporary use, prepaid with no early-return refund. No collateral lending.
contract RentalEscrow is ERC1155Holder, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Offer {
        uint256 rightId;
        address lender;
        uint256 pricePerDay;
        uint256 maxDays;
        address renter;
        uint64 endsAt;
        bool withdrawn;
    }
    UrbanRightToken public immutable rights;
    address public immutable paymentToken;
    uint256 public nextOfferId = 1;
    mapping(uint256 => Offer) private offers;
    address private expectedFrom;
    uint256 private expectedId;
    event RentalOffered(
        uint256 indexed offerId, uint256 indexed rightId, address indexed lender, uint256 pricePerDay, uint256 maxDays
    );
    event RentalStarted(uint256 indexed offerId, address indexed renter, uint64 endsAt, uint256 totalPrice);
    event RentalReturned(uint256 indexed offerId, address indexed renter);
    event RentalWithdrawn(uint256 indexed offerId, address indexed lender);

    constructor(UrbanRightToken r) {
        rights = r;
        paymentToken = r.paymentToken();
    }

    function getOffer(uint256 id) public view returns (Offer memory) {
        require(offers[id].lender != address(0), "Unknown offer");
        return offers[id];
    }

    function createOffer(uint256 rightId, uint256 pricePerDay, uint256 maxDays)
        external
        nonReentrant
        returns (uint256 id)
    {
        UrbanRightToken.Right memory r = rights.getRight(rightId);
        (,, bool exclusive) = rights.spatialScopes(rightId);
        require(
            r.rightType == 0 && r.transferPolicy == 0 && exclusive && rights.isTradable(rightId),
            "Exclusive open usage right required"
        );
        require(pricePerDay > 0 && pricePerDay <= 1e30 && maxDays > 0 && maxDays <= 365, "Invalid rental terms");
        id = nextOfferId++;
        offers[id] = Offer(rightId, msg.sender, pricePerDay, maxDays, address(0), 0, false);
        expectedFrom = msg.sender;
        expectedId = rightId;
        rights.safeTransferFrom(msg.sender, address(this), rightId, 1, "");
        expectedFrom = address(0);
        emit RentalOffered(id, rightId, msg.sender, pricePerDay, maxDays);
    }

    function userOf(uint256 id) public view returns (address) {
        Offer storage o = offers[id];
        return !o.withdrawn && block.timestamp < o.endsAt && rights.isOperating(o.rightId) ? o.renter : address(0);
    }

    function available(uint256 id) external view returns (bool) {
        Offer storage o = offers[id];
        return o.lender != address(0) && !o.withdrawn && block.timestamp >= o.endsAt && rights.isOperating(o.rightId);
    }

    function withdrawable(uint256 id) external view returns (bool) {
        Offer storage o = offers[id];
        return o.lender != address(0) && !o.withdrawn && block.timestamp >= o.endsAt;
    }

    function rent(uint256 id, uint256 daysCount) external nonReentrant {
        Offer storage o = offers[id];
        require(o.lender != address(0) && !o.withdrawn && msg.sender != o.lender, "Offer unavailable");
        require(block.timestamp >= o.endsAt, "Rental active");
        require(daysCount > 0 && daysCount <= o.maxDays, "Invalid duration");
        UrbanRightToken.Right memory r = rights.getRight(o.rightId);
        uint256 end = block.timestamp + daysCount * 1 days;
        require(rights.isOperating(o.rightId) && end <= r.endAt, "Outside right period");
        o.renter = msg.sender;
        o.endsAt = uint64(end);
        uint256 total = daysCount * o.pricePerDay;
        IERC20(paymentToken).safeTransferFrom(msg.sender, o.lender, total);
        emit RentalStarted(id, msg.sender, uint64(end), total);
    }

    function returnRental(uint256 id) external nonReentrant {
        Offer storage o = offers[id];
        require(o.renter == msg.sender && !o.withdrawn && block.timestamp < o.endsAt, "Renter required");
        o.endsAt = uint64(block.timestamp);
        o.renter = address(0);
        emit RentalReturned(id, msg.sender);
    }

    function withdraw(uint256 id) external nonReentrant {
        Offer storage o = offers[id];
        require(o.lender == msg.sender, "Lender required");
        require(!o.withdrawn, "Offer unavailable");
        require(block.timestamp >= o.endsAt, "Rental active");
        o.withdrawn = true;
        rights.safeTransferFrom(address(this), msg.sender, o.rightId, 1, "");
        emit RentalWithdrawn(id, msg.sender);
    }

    function onERC1155Received(address operator, address from, uint256 id, uint256 value, bytes memory)
        public
        view
        override
        returns (bytes4)
    {
        require(
            msg.sender == address(rights) && operator == address(this) && from == expectedFrom
                && expectedFrom != address(0) && id == expectedId && value == 1,
            "Use createOffer"
        );
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(address, address, uint256[] memory, uint256[] memory, bytes memory)
        public
        pure
        override
        returns (bytes4)
    {
        revert("Use createOffer");
    }
}
