// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {UrbanRightToken} from "./UrbanRightToken.sol";

contract RevenueVault is ReentrancyGuard {
    using SafeERC20 for IERC20;
    uint256 public constant SCALE = 1e27;
    UrbanRightToken public immutable rights;
    IERC20 public immutable paymentToken;
    mapping(uint256 => uint256) public rewardPerShare;
    mapping(uint256 => mapping(address => uint256)) public lastIndex;
    mapping(uint256 => mapping(address => uint256)) private accruedScaled;
    event RevenueDeposited(uint256 indexed rightId, address indexed operator, uint256 amount);
    event RevenueClaimed(uint256 indexed rightId, address indexed holder, uint256 amount);

    constructor(UrbanRightToken r) {
        rights = r;
        paymentToken = IERC20(r.paymentToken());
    }

    function checkpoint(uint256 id, address holder) external {
        require(msg.sender == address(rights), "Rights only");
        _checkpoint(id, holder);
    }

    function _checkpoint(uint256 id, address holder) private {
        accruedScaled[id][holder] += rights.balanceOf(holder, id) * (rewardPerShare[id] - lastIndex[id][holder]);
        lastIndex[id][holder] = rewardPerShare[id];
    }

    function depositRevenue(uint256 id, uint256 amount) external nonReentrant {
        require(rights.isRevenue(id) && rights.isOperating(id) && amount > 0 && amount <= 1e36, "Invalid revenue");
        uint256 supply = rights.totalSupply(id);
        require(supply > 0, "No holders");
        uint256 beforeBalance = paymentToken.balanceOf(address(this));
        paymentToken.safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = paymentToken.balanceOf(address(this)) - beforeBalance;
        require(received == amount, "Unsupported payment token");
        rewardPerShare[id] += received * SCALE / supply;
        emit RevenueDeposited(id, msg.sender, received);
    }

    function claimable(uint256 id, address holder) public view returns (uint256) {
        return (accruedScaled[id][holder] + rights.balanceOf(holder, id) * (rewardPerShare[id] - lastIndex[id][holder]))
            / SCALE;
    }

    function claim(uint256 id) external nonReentrant returns (uint256 amount) {
        _checkpoint(id, msg.sender);
        amount = accruedScaled[id][msg.sender] / SCALE;
        accruedScaled[id][msg.sender] -= amount * SCALE;
        if (amount > 0) paymentToken.safeTransfer(msg.sender, amount);
        emit RevenueClaimed(id, msg.sender, amount);
    }
}
