// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import {Test} from "forge-std/Test.sol";
import {UrbanAssetRegistry} from "../src/UrbanAssetRegistry.sol";
import {UrbanRightToken} from "../src/UrbanRightToken.sol";
import {RevenueVault} from "../src/RevenueVault.sol";
import {BasketVault} from "../src/BasketVault.sol";
import {UrbanMarketplace} from "../src/UrbanMarketplace.sol";
import {MockJPY} from "../src/MockJPY.sol";

abstract contract ProtocolBase is Test {
    UrbanAssetRegistry registry;
    UrbanRightToken rights;
    RevenueVault revenue;
    BasketVault baskets;
    UrbanMarketplace market;
    MockJPY cash;
    address owner = address(0xA);
    address buyer = address(0xB);
    address carol = address(0xC);
    uint256 solar;
    uint256 solarB;

    function setUp() public {
        registry = new UrbanAssetRegistry(address(this));
        cash = new MockJPY();
        rights = new UrbanRightToken(registry, address(cash));
        revenue = new RevenueVault(rights);
        rights.setRevenueVault(address(revenue));
        baskets = new BasketVault(rights, revenue);
        market = new UrbanMarketplace(rights, baskets, address(cash));
        cash.mint(owner, 1_000_000 ether);
        cash.mint(buyer, 1_000_000 ether);
        cash.mint(carol, 1_000_000 ether);
        for (uint256 i; i < 3; i++) {
            address who = i == 0 ? owner : i == 1 ? buyer : carol;
            vm.startPrank(who);
            cash.approve(address(market), type(uint256).max);
            cash.approve(address(revenue), type(uint256).max);
            rights.setApprovalForAll(address(market), true);
            rights.setApprovalForAll(address(baskets), true);
            baskets.setApprovalForAll(address(market), true);
            vm.stopPrank();
        }
        solar = issue(0, 1, 0);
        solarB = issue(0, 1, 0);
    }

    function issue(uint8 assetType, uint8 rightType, uint8 policy) internal returns (uint256 id) {
        uint256 next = registry.nextAssetId();
        vm.prank(owner);
        uint256 asset = registry.registerAsset(bytes32(next), "ipfs://demo", assetType);
        vm.prank(owner);
        registry.requestVerification(asset);
        registry.verifyAsset(asset, true);
        vm.prank(owner);
        id = rights.createRight(
            asset,
            rightType,
            rightType == 1 ? 100 : 1,
            "ipfs://terms",
            keccak256("terms"),
            uint64(block.timestamp),
            uint64(block.timestamp + 365 days),
            policy
        );
        rights.verifyRight(id, true);
    }

    function basket() internal returns (uint256 id) {
        uint256[] memory ids = new uint256[](2);
        ids[0] = solar;
        ids[1] = solarB;
        uint256[] memory units = new uint256[](2);
        units[0] = 2;
        units[1] = 3;
        vm.prank(owner);
        id = baskets.createBasket(ids, units, "ipfs://basket");
    }
}

contract ProtocolTest is ProtocolBase {
    function testAnyoneCanRegisterButNotVerify() public {
        vm.prank(buyer);
        uint256 a = registry.registerAsset(bytes32(uint256(999)), "ipfs://new", 1);
        vm.prank(buyer);
        registry.requestVerification(a);
        vm.prank(carol);
        vm.expectRevert();
        registry.verifyAsset(a, true);
        registry.verifyAsset(a, true);
        assertTrue(registry.isVerified(a));
    }

    function testUnverifiedAssetCannotIssue() public {
        vm.prank(owner);
        uint256 a = registry.registerAsset(bytes32(uint256(1)), "ipfs://new", 0);
        vm.prank(owner);
        vm.expectRevert();
        rights.createRight(a, 1, 100, "ipfs://terms", keccak256("t"), 1, uint64(block.timestamp + 1 days), 0);
    }

    function testUnauthorizedIssuerAndMetadataFrozen() public {
        vm.prank(carol);
        vm.expectRevert();
        rights.createRight(1, 1, 100, "ipfs://terms", keccak256("t"), 1, uint64(block.timestamp + 1 days), 0);
        vm.prank(carol);
        vm.expectRevert();
        registry.updateMetadata(1, "ipfs://fraud");
        vm.prank(owner);
        vm.expectRevert();
        registry.updateMetadata(1, "ipfs://changed");
        vm.prank(carol);
        vm.expectRevert();
        rights.verifyRight(solar, true);
    }

    function testPendingRightCannotList() public {
        vm.prank(owner);
        uint256 id = rights.createRight(1, 1, 5, "ipfs://terms", keccak256("t"), 1, uint64(block.timestamp + 1 days), 0);
        vm.prank(owner);
        vm.expectRevert();
        market.createListing(address(rights), id, 5, 10 ether);
    }

    function testPrimarySecondaryAndCancel() public {
        vm.prank(owner);
        uint256 listing = market.createListing(address(rights), solar, 30, 10 ether);
        uint256 beforeCash = cash.balanceOf(owner);
        vm.prank(buyer);
        market.purchase(listing, 20);
        assertEq(rights.balanceOf(buyer, solar), 20);
        assertEq(cash.balanceOf(owner), beforeCash + 200 ether);
        vm.prank(buyer);
        uint256 secondary = market.createListing(address(rights), solar, 10, 12 ether);
        vm.prank(carol);
        market.purchase(secondary, 10);
        assertEq(rights.balanceOf(carol, solar), 10);
        vm.prank(owner);
        market.cancelListing(listing);
        vm.prank(buyer);
        vm.expectRevert();
        market.purchase(listing, 1);
    }

    function testOversellingAndAtomicRollback() public {
        vm.prank(owner);
        vm.expectRevert();
        market.createListing(address(rights), solar, 101, 1 ether);
        vm.prank(owner);
        uint256 l = market.createListing(address(rights), solar, 100, 1 ether);
        vm.prank(owner);
        rights.safeTransferFrom(owner, carol, solar, 100, "");
        uint256 b = cash.balanceOf(buyer);
        vm.prank(buyer);
        vm.expectRevert();
        market.purchase(l, 1);
        assertEq(cash.balanceOf(buyer), b);
    }

    function testRevenueMustBeActiveAndFunded() public {
        vm.prank(owner);
        vm.expectRevert();
        revenue.depositRevenue(solar, 100 ether);
        rights.activateRight(solar);
        vm.prank(address(123));
        vm.expectRevert();
        revenue.depositRevenue(solar, 100 ether);
        assertEq(revenue.claimable(solar, owner), 0);
    }

    function testRevenueTransferAndDoubleClaim() public {
        rights.activateRight(solar);
        vm.prank(owner);
        revenue.depositRevenue(solar, 100 ether);
        vm.prank(owner);
        rights.safeTransferFrom(owner, buyer, solar, 40, "");
        assertEq(revenue.claimable(solar, owner), 100 ether);
        assertEq(revenue.claimable(solar, buyer), 0);
        vm.prank(owner);
        revenue.depositRevenue(solar, 200 ether);
        assertEq(revenue.claimable(solar, owner), 220 ether);
        assertEq(revenue.claimable(solar, buyer), 80 ether);
        vm.prank(owner);
        revenue.claim(solar);
        vm.prank(buyer);
        revenue.claim(solar);
        assertEq(revenue.claimable(solar, owner), 0);
        vm.prank(owner);
        assertEq(revenue.claim(solar), 0);
        assertEq(cash.balanceOf(address(revenue)), 0);
    }

    function testFuzzNoRoundingMoneyCreation(uint96 raw, uint8 transfers) public {
        uint256 amount = bound(raw, 1, 1e24);
        rights.activateRight(solar);
        vm.prank(owner);
        revenue.depositRevenue(solar, amount);
        for (uint256 i; i < uint256(transfers) % 20; i++) {
            vm.prank(owner);
            rights.safeTransferFrom(owner, buyer, solar, 1, "");
            vm.prank(buyer);
            rights.safeTransferFrom(buyer, owner, solar, 1, "");
        }
        assertLe(revenue.claimable(solar, owner) + revenue.claimable(solar, buyer), amount);
    }

    function testRestrictedRights() public {
        uint256 id = issue(1, 0, 1);
        vm.prank(owner);
        vm.expectRevert();
        rights.safeTransferFrom(owner, buyer, id, 1, "");
        rights.setAllowed(id, buyer, true);
        vm.prank(owner);
        rights.safeTransferFrom(owner, buyer, id, 1, "");
        uint256 locked = issue(1, 0, 2);
        vm.prank(owner);
        vm.expectRevert();
        rights.safeTransferFrom(owner, buyer, locked, 1, "");
    }

    function testBasketCustodyMintRedeemAndRevenue() public {
        uint256 id = basket();
        vm.prank(buyer);
        vm.expectRevert();
        baskets.mintBasketShares(id, 2);
        vm.prank(owner);
        baskets.depositUnderlying(id, 10);
        assertEq(rights.balanceOf(address(baskets), solar), 20);
        assertEq(rights.balanceOf(address(baskets), solarB), 30);
        assertEq(baskets.balanceOf(owner, id), 10);
        rights.activateRight(solar);
        vm.prank(owner);
        revenue.depositRevenue(solar, 100 ether);
        vm.prank(owner);
        baskets.safeTransferFrom(owner, buyer, id, 5, "");
        assertEq(baskets.claimable(id, owner), 20 ether);
        assertEq(baskets.claimable(id, buyer), 0);
        vm.prank(owner);
        revenue.depositRevenue(solar, 100 ether);
        vm.prank(buyer);
        baskets.claimRevenue(id);
        assertEq(baskets.claimable(id, owner), 30 ether);
        vm.prank(buyer);
        baskets.redeem(id, 5);
        assertEq(rights.balanceOf(buyer, solar), 10);
        assertEq(rights.balanceOf(buyer, solarB), 15);
        assertEq(baskets.totalSupply(id), 5);
    }

    function testBasketRejectsUsageAndRestrictedAndDuplicates() public {
        uint256 usage = issue(1, 0, 0);
        uint256 restricted = issue(0, 1, 1);
        uint256[] memory ids = new uint256[](2);
        uint256[] memory units = new uint256[](2);
        units[0] = 1;
        units[1] = 1;
        ids[0] = solar;
        ids[1] = usage;
        vm.expectRevert();
        baskets.createBasket(ids, units, "ipfs://x");
        ids[1] = restricted;
        vm.expectRevert();
        baskets.createBasket(ids, units, "ipfs://x");
        ids[1] = solar;
        vm.expectRevert();
        baskets.createBasket(ids, units, "ipfs://x");
    }

    function testBasketCanTradeInSameMarketplace() public {
        uint256 id = basket();
        vm.prank(owner);
        baskets.depositUnderlying(id, 4);
        vm.prank(owner);
        uint256 l = market.createListing(address(baskets), id, 2, 50 ether);
        vm.prank(buyer);
        market.purchase(l, 2);
        assertEq(baskets.balanceOf(buyer, id), 2);
    }
}
