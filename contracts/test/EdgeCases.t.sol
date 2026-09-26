// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import {ProtocolBase} from "./Protocol.t.sol";

contract EdgeCasesTest is ProtocolBase {
    function testDuplicateCanonicalSpaceCannotBeVerifiedTwice() public {
        vm.prank(carol);
        uint256 a = registry.registerAsset(bytes32(uint256(1)), "ipfs://duplicate", 0);
        vm.prank(carol);
        registry.requestVerification(a);
        vm.expectRevert();
        registry.verifyAsset(a, true);
    }

    function testRejectedAssetCanReviseAndResubmit() public {
        vm.prank(owner);
        uint256 a = registry.registerAsset(bytes32(uint256(999)), "ipfs://draft", 0);
        vm.prank(owner);
        registry.requestVerification(a);
        registry.verifyAsset(a, false);
        vm.prank(owner);
        registry.updateMetadata(a, "ipfs://revised");
        vm.prank(owner);
        registry.requestVerification(a);
        registry.verifyAsset(a, true);
        assertTrue(registry.isVerified(a));
        assertEq(registry.getAsset(a).metadataURI, "ipfs://revised");
    }

    function testExpiredRightsCannotTradeButBasketCanRedeem() public {
        uint256 id = basket();
        vm.prank(owner);
        baskets.depositUnderlying(id, 2);
        vm.warp(block.timestamp + 366 days);
        assertFalse(rights.isTradable(solar));
        assertFalse(baskets.isTradable(id));
        vm.prank(owner);
        baskets.redeem(id, 2);
        assertEq(rights.balanceOf(owner, solar), 100);
    }

    function testBurnPreservesEarnedRevenue() public {
        rights.activateRight(solar);
        vm.prank(owner);
        revenue.depositRevenue(solar, 100 ether);
        vm.prank(owner);
        rights.burn(solar, 50);
        assertEq(revenue.claimable(solar, owner), 100 ether);
        vm.prank(owner);
        revenue.depositRevenue(solar, 50 ether);
        assertEq(revenue.claimable(solar, owner), 150 ether);
    }

    function testDirectDonationCannotMintAndCannotReplaceVault() public {
        vm.prank(owner);
        vm.expectRevert();
        rights.safeTransferFrom(owner, address(baskets), solar, 1, "");
        vm.expectRevert();
        rights.setRevenueVault(address(baskets));
        vm.prank(carol);
        vm.expectRevert();
        rights.activateRight(solar);
    }

    function testClosingRightStopsNewDepositsAndSales() public {
        rights.activateRight(solar);
        vm.prank(owner);
        revenue.depositRevenue(solar, 100 ether);
        rights.closeRight(solar);
        vm.prank(owner);
        vm.expectRevert();
        revenue.depositRevenue(solar, 100 ether);
        assertFalse(rights.isTradable(solar));
        vm.prank(owner);
        assertEq(revenue.claim(solar), 100 ether);
    }

    function testBatchAndSelfTransfersPreserveClaims() public {
        rights.activateRight(solar);
        rights.activateRight(solarB);
        vm.prank(owner);
        revenue.depositRevenue(solar, 100 ether);
        vm.prank(owner);
        revenue.depositRevenue(solarB, 200 ether);
        uint256[] memory ids = new uint256[](2);
        ids[0] = solar;
        ids[1] = solarB;
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 10;
        amounts[1] = 20;
        vm.prank(owner);
        rights.safeBatchTransferFrom(owner, buyer, ids, amounts, "");
        vm.prank(buyer);
        rights.safeTransferFrom(buyer, buyer, solar, 5, "");
        assertEq(revenue.claimable(solar, owner), 100 ether);
        assertEq(revenue.claimable(solarB, owner), 200 ether);
        assertEq(revenue.claimable(solar, buyer), 0);
    }
}
