// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {ERC1155Supply} from "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {UrbanRightToken} from "./UrbanRightToken.sol";
import {RevenueVault} from "./RevenueVault.sol";

/// Fixed-ratio fractions of open-transfer revenue rights, backed by ERC-1155 custody.
contract FractionVault is ERC1155Supply, ERC1155Holder, ReentrancyGuard {
    using SafeERC20 for IERC20;
    uint256 private constant SCALE = 1e27;

    struct Pool {
        uint256 rightId;
        uint256 sharesPerUnit;
        uint256 underlyingUnits;
    }

    struct Listing {
        uint256 poolId;
        address seller;
        uint256 remaining;
        uint256 unitPrice;
        bool cancelled;
    }
    UrbanRightToken public immutable rights;
    RevenueVault public immutable revenue;
    address public immutable paymentToken;
    uint256 public nextPoolId = 1;
    uint256 public nextListingId = 1;
    mapping(uint256 => Pool) private pools;
    mapping(uint256 => Listing) private listings;
    // A single pool receives this vault's revenue for each underlying right.
    mapping(uint256 => uint256) public poolOfRight;
    mapping(uint256 => uint256) public rewardPerShare;
    mapping(uint256 => mapping(address => uint256)) private lastIndex;
    mapping(uint256 => mapping(address => uint256)) private accruedScaled;
    address private expectedFrom;
    uint256 private expectedId;
    uint256 private expectedAmount;
    event FractionPoolCreated(
        uint256 indexed poolId, address indexed creator, uint256 indexed rightId, uint256 sharesPerUnit
    );
    event FractionDeposited(uint256 indexed poolId, address indexed holder, uint256 units, uint256 shares);
    event FractionRedeemed(uint256 indexed poolId, address indexed holder, uint256 units, uint256 shares);
    event FractionRevenueClaimed(uint256 indexed poolId, address indexed holder, uint256 amount);
    event FractionListed(
        uint256 indexed listingId, uint256 indexed poolId, address indexed seller, uint256 shares, uint256 unitPrice
    );
    event FractionPurchased(uint256 indexed listingId, address indexed buyer, uint256 shares, uint256 totalPrice);
    event FractionListingCancelled(uint256 indexed listingId);

    constructor(UrbanRightToken r, RevenueVault v) ERC1155("") {
        require(address(v.rights()) == address(r) && r.revenueVault() == address(v), "Wrong revenue vault");
        rights = r;
        revenue = v;
        paymentToken = r.paymentToken();
    }

    function getPool(uint256 id) public view returns (Pool memory) {
        require(pools[id].rightId != 0, "Unknown pool");
        return pools[id];
    }

    function getListing(uint256 id) external view returns (Listing memory) {
        require(listings[id].seller != address(0), "Unknown listing");
        return listings[id];
    }

    function uri(uint256 id) public view override returns (string memory) {
        return rights.uri(getPool(id).rightId);
    }

    function isTradable(uint256 id) public view returns (bool) {
        return pools[id].rightId != 0 && rights.isBasketCompatible(pools[id].rightId);
    }

    function createPool(uint256 rightId, uint256 units, uint256 sharesPerUnit)
        external
        nonReentrant
        returns (uint256 id)
    {
        require(rights.isBasketCompatible(rightId), "Incompatible revenue right");
        require(poolOfRight[rightId] == 0, "Pool already exists");
        require(sharesPerUnit >= 2 && sharesPerUnit <= 1e6, "Invalid ratio");
        id = nextPoolId++;
        pools[id] = Pool(rightId, sharesPerUnit, 0);
        poolOfRight[rightId] = id;
        emit FractionPoolCreated(id, msg.sender, rightId, sharesPerUnit);
        _deposit(id, units);
    }

    function deposit(uint256 id, uint256 units) external nonReentrant {
        _deposit(id, units);
    }

    function _deposit(uint256 id, uint256 units) private {
        require(isTradable(id), "Pool not tradable");
        require(units > 0 && units <= 1e12, "Invalid units");
        _harvest(id);
        Pool storage p = pools[id];
        p.underlyingUnits += units;
        expectedFrom = msg.sender;
        expectedId = p.rightId;
        expectedAmount = units;
        rights.safeTransferFrom(msg.sender, address(this), p.rightId, units, "");
        expectedFrom = address(0);
        uint256 shares = units * p.sharesPerUnit;
        _mint(msg.sender, id, shares, "");
        emit FractionDeposited(id, msg.sender, units, shares);
    }

    function redeem(uint256 id, uint256 shares) external nonReentrant {
        Pool storage p = pools[id];
        require(p.rightId != 0 && shares > 0 && shares % p.sharesPerUnit == 0, "Whole underlying units required");
        uint256 units = shares / p.sharesPerUnit;
        _burn(msg.sender, id, shares);
        p.underlyingUnits -= units;
        rights.safeTransferFrom(address(this), msg.sender, p.rightId, units, "");
        emit FractionRedeemed(id, msg.sender, units, shares);
    }

    function _harvest(uint256 id) private {
        uint256 supply = totalSupply(id);
        if (supply > 0) rewardPerShare[id] += revenue.claim(pools[id].rightId) * SCALE / supply;
    }

    function _checkpoint(uint256 id, address holder) private {
        accruedScaled[id][holder] += balanceOf(holder, id) * (rewardPerShare[id] - lastIndex[id][holder]);
        lastIndex[id][holder] = rewardPerShare[id];
    }

    function claimable(uint256 id, address holder) public view returns (uint256) {
        getPool(id);
        uint256 index = rewardPerShare[id];
        uint256 supply = totalSupply(id);
        if (supply > 0) index += revenue.claimable(pools[id].rightId, address(this)) * SCALE / supply;
        return (accruedScaled[id][holder] + balanceOf(holder, id) * (index - lastIndex[id][holder])) / SCALE;
    }

    function claimRevenue(uint256 id) external nonReentrant returns (uint256 amount) {
        getPool(id);
        _harvest(id);
        _checkpoint(id, msg.sender);
        amount = accruedScaled[id][msg.sender] / SCALE;
        accruedScaled[id][msg.sender] -= amount * SCALE;
        if (amount > 0) IERC20(paymentToken).safeTransfer(msg.sender, amount);
        emit FractionRevenueClaimed(id, msg.sender, amount);
    }

    function createListing(uint256 id, uint256 shares, uint256 unitPrice)
        external
        nonReentrant
        returns (uint256 listingId)
    {
        require(isTradable(id), "Pool not tradable");
        require(
            shares > 0 && shares <= balanceOf(msg.sender, id) && unitPrice > 0 && unitPrice <= 1e30, "Invalid listing"
        );
        listingId = nextListingId++;
        listings[listingId] = Listing(id, msg.sender, shares, unitPrice, false);
        emit FractionListed(listingId, id, msg.sender, shares, unitPrice);
    }

    function purchase(uint256 listingId, uint256 shares) external nonReentrant {
        Listing storage l = listings[listingId];
        require(
            l.seller != address(0) && msg.sender != l.seller && !l.cancelled && shares > 0 && shares <= l.remaining,
            "Invalid order"
        );
        require(isTradable(l.poolId), "Pool not tradable");
        l.remaining -= shares;
        uint256 total = shares * l.unitPrice;
        IERC20(paymentToken).safeTransferFrom(msg.sender, l.seller, total);
        _safeTransferFrom(l.seller, msg.sender, l.poolId, shares, "");
        emit FractionPurchased(listingId, msg.sender, shares, total);
    }

    function cancelListing(uint256 id) external nonReentrant {
        require(listings[id].seller == msg.sender, "Seller required");
        listings[id].cancelled = true;
        emit FractionListingCancelled(id);
    }

    function safeTransferFrom(address from, address to, uint256 id, uint256 value, bytes memory data)
        public
        override
        nonReentrant
    {
        super.safeTransferFrom(from, to, id, value, data);
    }

    function safeBatchTransferFrom(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory values,
        bytes memory data
    ) public override nonReentrant {
        super.safeBatchTransferFrom(from, to, ids, values, data);
    }

    function _update(address from, address to, uint256[] memory ids, uint256[] memory amounts) internal override {
        for (uint256 i; i < ids.length; i++) {
            if (from != address(0) && to != address(0)) require(isTradable(ids[i]), "Pool not tradable");
            _harvest(ids[i]);
            if (from != address(0)) _checkpoint(ids[i], from);
            if (to != address(0) && to != from) _checkpoint(ids[i], to);
        }
        super._update(from, to, ids, amounts);
    }

    function supportsInterface(bytes4 id) public view override(ERC1155, ERC1155Holder) returns (bool) {
        return super.supportsInterface(id);
    }

    function onERC1155Received(address operator, address from, uint256 id, uint256 amount, bytes memory)
        public
        view
        override
        returns (bytes4)
    {
        require(
            msg.sender == address(rights) && operator == address(this) && expectedFrom != address(0)
                && from == expectedFrom && id == expectedId && amount == expectedAmount,
            "Use deposit"
        );
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(address, address, uint256[] memory, uint256[] memory, bytes memory)
        public
        pure
        override
        returns (bytes4)
    {
        revert("Use deposit");
    }
}
