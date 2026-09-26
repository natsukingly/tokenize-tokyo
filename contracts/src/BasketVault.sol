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

contract BasketVault is ERC1155Supply, ERC1155Holder, ReentrancyGuard {
    using SafeERC20 for IERC20;
    uint256 private constant SCALE = 1e27;

    struct Basket {
        uint256[] rightIds;
        uint256[] unitsPerShare;
        string metadataURI;
    }
    UrbanRightToken public immutable rights;
    RevenueVault public immutable revenue;
    address public immutable paymentToken;
    uint256 public nextBasketId = 1;
    mapping(uint256 => Basket) private baskets;
    // Each right belongs to one basket pool, so harvested revenue cannot cross-subsidize pools.
    mapping(uint256 => uint256) public basketOfRight;
    mapping(uint256 => uint256) public rewardPerShare;
    mapping(uint256 => mapping(address => uint256)) private lastIndex;
    mapping(uint256 => mapping(address => uint256)) private accruedScaled;
    bool private accepting;
    event BasketCreated(
        uint256 indexed basketId,
        address indexed creator,
        uint256[] rightIds,
        uint256[] unitsPerShare,
        string metadataURI
    );
    event UnderlyingDeposited(
        uint256 indexed basketId, address indexed holder, uint256 indexed rightId, uint256 amount
    );
    event BasketMinted(uint256 indexed basketId, address indexed holder, uint256 shares);
    event BasketRedeemed(uint256 indexed basketId, address indexed holder, uint256 shares);
    event BasketRevenueClaimed(uint256 indexed basketId, address indexed holder, uint256 amount);

    constructor(UrbanRightToken r, RevenueVault v) ERC1155("") {
        rights = r;
        revenue = v;
        paymentToken = r.paymentToken();
    }

    function createBasket(uint256[] calldata ids, uint256[] calldata units, string calldata metadata)
        external
        returns (uint256 id)
    {
        require(
            ids.length >= 2 && ids.length <= 8 && ids.length == units.length && bytes(metadata).length > 0
                && bytes(metadata).length <= 4096,
            "Invalid basket"
        );
        id = nextBasketId++;
        for (uint256 i; i < ids.length; i++) {
            _reserveUnderlying(ids[i], units[i], id);
        }
        baskets[id] = Basket(ids, units, metadata);
        emit BasketCreated(id, msg.sender, ids, units, metadata);
    }

    function _reserveUnderlying(uint256 rightId, uint256 units, uint256 id) private {
        require(
            rights.isBasketCompatible(rightId) && units > 0 && units <= 1e12 && basketOfRight[rightId] == 0,
            "Incompatible right"
        );
        require(rights.balanceOf(msg.sender, rightId) >= units, "Must hold underlying");
        basketOfRight[rightId] = id;
    }

    function getBasket(uint256 id) external view returns (Basket memory) {
        require(baskets[id].rightIds.length > 0, "Unknown basket");
        return baskets[id];
    }

    function uri(uint256 id) public view override returns (string memory) {
        return baskets[id].metadataURI;
    }

    function isTradable(uint256 id) public view returns (bool) {
        Basket storage b = baskets[id];
        if (b.rightIds.length == 0) return false;
        for (uint256 i; i < b.rightIds.length; i++) {
            if (!rights.isBasketCompatible(b.rightIds[i])) return false;
        }
        return true;
    }

    // Both entry points are atomic custody + issuance. There is no unbacked mint stage.
    function depositUnderlying(uint256 id, uint256 shares) external nonReentrant {
        _deposit(id, shares);
    }

    function mintBasketShares(uint256 id, uint256 shares) external nonReentrant {
        _deposit(id, shares);
    }

    function _deposit(uint256 id, uint256 shares) private {
        require(isTradable(id) && shares > 0 && shares <= 1e12, "Invalid deposit");
        _harvest(id);
        Basket storage b = baskets[id];
        accepting = true;
        for (uint256 i; i < b.rightIds.length; i++) {
            uint256 amount = shares * b.unitsPerShare[i];
            rights.safeTransferFrom(msg.sender, address(this), b.rightIds[i], amount, "");
            emit UnderlyingDeposited(id, msg.sender, b.rightIds[i], amount);
        }
        accepting = false;
        _mint(msg.sender, id, shares, "");
        emit BasketMinted(id, msg.sender, shares);
    }

    function redeem(uint256 id, uint256 shares) external nonReentrant {
        require(shares > 0, "Zero shares");
        _burn(msg.sender, id, shares);
        Basket storage b = baskets[id];
        for (uint256 i; i < b.rightIds.length; i++) {
            rights.safeTransferFrom(address(this), msg.sender, b.rightIds[i], shares * b.unitsPerShare[i], "");
        }
        emit BasketRedeemed(id, msg.sender, shares);
    }

    function _harvest(uint256 id) private {
        uint256 supply = totalSupply(id);
        if (supply == 0) return;
        uint256 amount;
        Basket storage b = baskets[id];
        for (uint256 i; i < b.rightIds.length; i++) {
            amount += revenue.claim(b.rightIds[i]);
        }
        rewardPerShare[id] += amount * SCALE / supply;
    }

    function _checkpoint(uint256 id, address holder) private {
        accruedScaled[id][holder] += balanceOf(holder, id) * (rewardPerShare[id] - lastIndex[id][holder]);
        lastIndex[id][holder] = rewardPerShare[id];
    }

    function claimable(uint256 id, address holder) public view returns (uint256) {
        uint256 index = rewardPerShare[id];
        uint256 supply = totalSupply(id);
        if (supply > 0) {
            uint256 pending;
            Basket storage b = baskets[id];
            for (uint256 i; i < b.rightIds.length; i++) {
                pending += revenue.claimable(b.rightIds[i], address(this));
            }
            index += pending * SCALE / supply;
        }
        return (accruedScaled[id][holder] + balanceOf(holder, id) * (index - lastIndex[id][holder])) / SCALE;
    }

    function claimRevenue(uint256 id) external nonReentrant returns (uint256 amount) {
        _harvest(id);
        _checkpoint(id, msg.sender);
        amount = accruedScaled[id][msg.sender] / SCALE;
        accruedScaled[id][msg.sender] -= amount * SCALE;
        if (amount > 0) {
            IERC20(paymentToken).safeTransfer(msg.sender, amount);
            emit BasketRevenueClaimed(id, msg.sender, amount);
        }
    }

    function _update(address from, address to, uint256[] memory ids, uint256[] memory amounts) internal override {
        for (uint256 i; i < ids.length; i++) {
            _harvest(ids[i]);
            if (from != address(0)) _checkpoint(ids[i], from);
            if (to != address(0) && to != from) _checkpoint(ids[i], to);
        }
        super._update(from, to, ids, amounts);
    }

    function supportsInterface(bytes4 id) public view override(ERC1155, ERC1155Holder) returns (bool) {
        return super.supportsInterface(id);
    }

    function onERC1155Received(address, address, uint256, uint256, bytes memory) public view override returns (bytes4) {
        require(msg.sender == address(rights) && accepting, "Use depositUnderlying");
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(address, address, uint256[] memory, uint256[] memory, bytes memory)
        public
        pure
        override
        returns (bytes4)
    {
        revert("Use depositUnderlying");
    }
}
