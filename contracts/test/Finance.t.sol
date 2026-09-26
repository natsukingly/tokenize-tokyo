// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import {ProtocolBase} from "./Protocol.t.sol";
import {FractionVault} from "../src/FractionVault.sol";
import {RentalEscrow} from "../src/RentalEscrow.sol";
import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import {UrbanRightToken} from "../src/UrbanRightToken.sol";

contract FractionReentrantReceiver is ERC1155Holder {
    FractionVault public vault;
    bool public blocked;

    function wrap(UrbanRightToken rights, FractionVault v, uint256 id) external {
        vault = v;
        rights.setApprovalForAll(address(v), true);
        v.createPool(id, 1, 1000);
    }

    function onERC1155Received(address, address, uint256 id, uint256, bytes memory) public override returns (bytes4) {
        if (msg.sender == address(vault)) {
            (bool ok,) = address(vault).call(abi.encodeCall(FractionVault.redeem, (id, 1000)));
            blocked = !ok;
        }
        return this.onERC1155Received.selector;
    }
}

contract FractionTest is ProtocolBase {
    FractionVault fractions;

    function setUp() public override {
        super.setUp();
        fractions = new FractionVault(rights, revenue);
        rights.activateRight(solar);
        rights.activateRight(solarB);
        vm.prank(owner);
        rights.setApprovalForAll(address(fractions), true);
        vm.prank(buyer);
        cash.approve(address(fractions), type(uint256).max);
    }

    function pool() internal returns (uint256 id) {
        vm.prank(owner);
        id = fractions.createPool(solar, 1, 1000);
    }

    function depositRevenue(uint256 amount) internal {
        vm.prank(owner);
        revenue.depositRevenue(solar, amount);
    }

    function testCustodyBeforeSharesAndWholeUnitRedemption() public {
        uint256 id = pool();
        assertEq(rights.balanceOf(address(fractions), solar), 1);
        assertEq(fractions.balanceOf(owner, id), 1000);
        vm.startPrank(owner);
        vm.expectRevert("Whole underlying units required");
        fractions.redeem(id, 999);
        fractions.redeem(id, 1000);
        vm.stopPrank();
        assertEq(rights.balanceOf(owner, solar), 100);
        assertEq(fractions.totalSupply(id), 0);
        assertEq(fractions.getPool(id).underlyingUnits, 0);
    }

    function testRejectsUsageRestrictedAndUnapprovedRights() public {
        uint256 usage = issue(0, 0, 0);
        uint256 restricted = issue(0, 1, 1);
        vm.startPrank(owner);
        vm.expectRevert("Incompatible revenue right");
        fractions.createPool(usage, 1, 1000);
        vm.expectRevert("Incompatible revenue right");
        fractions.createPool(restricted, 1, 1000);
        rights.setApprovalForAll(address(fractions), false);
        vm.expectRevert();
        fractions.createPool(solar, 1, 1000);
        vm.stopPrank();
        assertEq(fractions.nextPoolId(), 1);
    }

    function testOnlyOnePoolPerRightAndNoUnsolicitedCustody() public {
        pool();
        vm.startPrank(owner);
        vm.expectRevert("Pool already exists");
        fractions.createPool(solar, 1, 100);
        vm.expectRevert();
        rights.safeTransferFrom(owner, address(fractions), solar, 1, "");
        vm.stopPrank();
    }

    function testPreWrapRevenueRemainsWithOriginalHolder() public {
        depositRevenue(10000 ether);
        uint256 id = pool();
        assertEq(fractions.claimable(id, owner), 0);
        assertEq(revenue.claimable(solar, owner), 10000 ether);
    }

    function testTransferDoesNotSellPastIncome() public {
        uint256 id = pool();
        depositRevenue(10000 ether);
        vm.prank(owner);
        fractions.safeTransferFrom(owner, buyer, id, 500, "");
        assertEq(fractions.claimable(id, owner), 100 ether);
        assertEq(fractions.claimable(id, buyer), 0);
        depositRevenue(10000 ether);
        assertEq(fractions.claimable(id, owner), 150 ether);
        assertEq(fractions.claimable(id, buyer), 50 ether);
        vm.prank(buyer);
        assertEq(fractions.claimRevenue(id), 50 ether);
        assertEq(fractions.claimable(id, buyer), 0);
    }

    function testDepositDoesNotDiluteAccruedIncome() public {
        uint256 id = pool();
        depositRevenue(10000 ether);
        vm.prank(owner);
        rights.safeTransferFrom(owner, buyer, solar, 1, "");
        vm.startPrank(buyer);
        rights.setApprovalForAll(address(fractions), true);
        fractions.deposit(id, 1);
        vm.stopPrank();
        assertEq(fractions.claimable(id, owner), 100 ether);
        assertEq(fractions.claimable(id, buyer), 0);
        depositRevenue(10000 ether);
        assertEq(fractions.claimable(id, owner), 200 ether);
        assertEq(fractions.claimable(id, buyer), 100 ether);
    }

    function testFractionSaleAndCancellation() public {
        uint256 id = pool();
        vm.prank(owner);
        uint256 listing = fractions.createListing(id, 250, 2 ether);
        uint256 beforeCash = cash.balanceOf(owner);
        vm.prank(buyer);
        fractions.purchase(listing, 100);
        assertEq(fractions.balanceOf(buyer, id), 100);
        assertEq(cash.balanceOf(owner), beforeCash + 200 ether);
        assertEq(fractions.getListing(listing).remaining, 150);
        vm.prank(buyer);
        vm.expectRevert("Seller required");
        fractions.cancelListing(listing);
        vm.prank(owner);
        fractions.cancelListing(listing);
        vm.prank(buyer);
        vm.expectRevert("Invalid order");
        fractions.purchase(listing, 1);
    }

    function testRedeemAndClaimAfterExpiry() public {
        uint256 id = pool();
        depositRevenue(10000 ether);
        vm.warp(block.timestamp + 366 days);
        vm.startPrank(owner);
        vm.expectRevert("Pool not tradable");
        fractions.createListing(id, 1, 1 ether);
        fractions.redeem(id, 1000);
        assertEq(fractions.claimRevenue(id), 100 ether);
        vm.stopPrank();
        assertEq(rights.balanceOf(owner, solar), 100);
    }

    function testPoolsDoNotShareRevenue() public {
        uint256 first = pool();
        vm.prank(owner);
        uint256 second = fractions.createPool(solarB, 1, 1000);
        depositRevenue(10000 ether);
        assertEq(fractions.claimable(first, owner), 100 ether);
        assertEq(fractions.claimable(second, owner), 0);
    }

    function testFuzzSupplyAlwaysMatchesCustody(uint8 units, uint32 ratio) public {
        uint256 u = bound(units, 1, 100);
        uint256 r = bound(ratio, 2, 1000000);
        vm.startPrank(owner);
        uint256 id = fractions.createPool(solar, u, r);
        assertEq(fractions.totalSupply(id), rights.balanceOf(address(fractions), solar) * r);
        fractions.redeem(id, u * r);
        vm.stopPrank();
        assertEq(fractions.totalSupply(id), 0);
        assertEq(rights.balanceOf(address(fractions), solar), 0);
    }

    function testInvalidArgumentsAndUnknownPools() public {
        vm.startPrank(owner);
        vm.expectRevert("Invalid ratio");
        fractions.createPool(solar, 1, 1);
        vm.expectRevert("Invalid ratio");
        fractions.createPool(solar, 1, 1000001);
        vm.expectRevert("Invalid units");
        fractions.createPool(solar, 0, 1000);
        vm.expectRevert("Unknown pool");
        fractions.getPool(99);
        vm.expectRevert("Unknown pool");
        fractions.claimRevenue(99);
        vm.expectRevert("Unknown listing");
        fractions.getListing(99);
        vm.stopPrank();
    }

    function testBatchTransferAndMetadata() public {
        uint256 id = pool();
        assertEq(fractions.uri(id), rights.uri(solar));
        assertTrue(fractions.supportsInterface(0xd9b67a26));
        uint256[] memory ids = new uint256[](1);
        ids[0] = id;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 200;
        vm.prank(owner);
        fractions.safeBatchTransferFrom(owner, buyer, ids, amounts, "");
        assertEq(fractions.balanceOf(buyer, id), 200);
        amounts[0] = 1;
        vm.prank(owner);
        vm.expectRevert();
        rights.safeBatchTransferFrom(owner, address(fractions), ids, amounts, "");
    }

    function testStaleListingCannotTakeBuyersMoney() public {
        uint256 id = pool();
        vm.startPrank(owner);
        uint256 listing = fractions.createListing(id, 1000, 1 ether);
        fractions.redeem(id, 1000);
        vm.stopPrank();
        uint256 balance = cash.balanceOf(buyer);
        vm.prank(buyer);
        vm.expectRevert();
        fractions.purchase(listing, 1);
        assertEq(cash.balanceOf(buyer), balance);
        assertEq(fractions.getListing(listing).remaining, 1000);
    }

    function testReceiverCannotReenterDuringMint() public {
        FractionReentrantReceiver receiver = new FractionReentrantReceiver();
        vm.prank(owner);
        rights.safeTransferFrom(owner, address(receiver), solar, 1, "");
        receiver.wrap(rights, fractions, solar);
        assertTrue(receiver.blocked());
        assertEq(fractions.balanceOf(address(receiver), 1), 1000);
        assertEq(rights.balanceOf(address(fractions), solar), 1);
    }

    function testClosedPoolsBlockNewCapitalAndTradesButPreserveClaims() public {
        uint256 id = pool();
        vm.startPrank(owner);
        uint256 listing = fractions.createListing(id, 10, 1 ether);
        vm.stopPrank();
        rights.closeRight(solar);
        vm.startPrank(owner);
        vm.expectRevert("Pool not tradable");
        fractions.deposit(id, 1);
        vm.expectRevert("Pool not tradable");
        fractions.safeTransferFrom(owner, buyer, id, 1, "");
        fractions.redeem(id, 1000);
        assertEq(fractions.claimRevenue(id), 0);
        assertEq(fractions.claimable(id, owner), 0);
        vm.stopPrank();
        vm.prank(buyer);
        vm.expectRevert("Pool not tradable");
        fractions.purchase(listing, 1);
    }

    function testInvalidFractionOrdersAndSelfTransfer() public {
        uint256 id = pool();
        vm.startPrank(owner);
        vm.expectRevert("Invalid listing");
        fractions.createListing(id, 0, 1 ether);
        vm.expectRevert("Invalid listing");
        fractions.createListing(id, 1001, 1 ether);
        vm.expectRevert("Invalid listing");
        fractions.createListing(id, 1, 0);
        vm.expectRevert("Invalid listing");
        fractions.createListing(id, 1, 1e31);
        uint256 listing = fractions.createListing(id, 10, 1 ether);
        vm.expectRevert("Invalid order");
        fractions.purchase(listing, 1);
        fractions.safeTransferFrom(owner, owner, id, 1, "");
        assertEq(fractions.balanceOf(owner, id), 1000);
        vm.stopPrank();
        vm.startPrank(buyer);
        vm.expectRevert("Invalid order");
        fractions.purchase(listing, 0);
        vm.expectRevert("Invalid order");
        fractions.purchase(listing, 11);
        vm.expectRevert("Invalid order");
        fractions.purchase(99, 1);
        vm.stopPrank();
    }
}

contract RentalTest is ProtocolBase {
    RentalEscrow rental;
    uint256 usage;

    function setUp() public override {
        super.setUp();
        rental = new RentalEscrow(rights);
        usage = issue(0, 0, 0);
        rights.activateRight(usage);
        vm.prank(owner);
        rights.setApprovalForAll(address(rental), true);
        vm.prank(buyer);
        cash.approve(address(rental), type(uint256).max);
        vm.prank(carol);
        cash.approve(address(rental), type(uint256).max);
    }

    function offer() internal returns (uint256 id) {
        vm.prank(owner);
        id = rental.createOffer(usage, 100 ether, 30);
    }

    function testRentEscrowsRightAndSettlesPayment() public {
        uint256 id = offer();
        assertTrue(rental.available(id));
        assertTrue(rental.withdrawable(id));
        assertEq(rights.balanceOf(owner, usage), 0);
        assertEq(rights.balanceOf(address(rental), usage), 1);
        uint256 beforeCash = cash.balanceOf(owner);
        vm.prank(buyer);
        rental.rent(id, 2);
        assertEq(rental.userOf(id), buyer);
        assertEq(cash.balanceOf(owner), beforeCash + 200 ether);
        assertEq(rights.balanceOf(buyer, usage), 0);
        assertFalse(rental.available(id));
        assertFalse(rental.withdrawable(id));
    }

    function testCannotDoubleRentOrWithdrawDuringLease() public {
        uint256 id = offer();
        vm.prank(buyer);
        rental.rent(id, 2);
        vm.prank(carol);
        vm.expectRevert("Rental active");
        rental.rent(id, 1);
        vm.prank(owner);
        vm.expectRevert("Rental active");
        rental.withdraw(id);
        vm.prank(carol);
        vm.expectRevert("Renter required");
        rental.returnRental(id);
    }

    function testEarlyReturnThenOwnerRecoversWithoutRefund() public {
        uint256 id = offer();
        uint256 beforeCash = cash.balanceOf(buyer);
        vm.startPrank(buyer);
        rental.rent(id, 2);
        rental.returnRental(id);
        vm.stopPrank();
        assertEq(rental.userOf(id), address(0));
        assertEq(cash.balanceOf(buyer), beforeCash - 200 ether);
        vm.prank(owner);
        rental.withdraw(id);
        assertEq(rights.balanceOf(owner, usage), 1);
        vm.prank(buyer);
        vm.expectRevert("Offer unavailable");
        rental.rent(id, 1);
    }

    function testExpiryNeedsNoRenterActionAndAllowsReRent() public {
        uint256 id = offer();
        vm.prank(buyer);
        rental.rent(id, 1);
        vm.warp(rental.getOffer(id).endsAt);
        assertEq(rental.userOf(id), address(0));
        vm.prank(carol);
        rental.rent(id, 1);
        assertEq(rental.userOf(id), carol);
        vm.warp(rental.getOffer(id).endsAt);
        vm.prank(owner);
        rental.withdraw(id);
        assertEq(rights.balanceOf(owner, usage), 1);
    }

    function testTermLimitsAndWrongKinds() public {
        vm.startPrank(owner);
        vm.expectRevert("Exclusive open usage right required");
        rental.createOffer(solar, 1 ether, 30);
        vm.stopPrank();
        uint256 id = offer();
        vm.startPrank(buyer);
        vm.expectRevert("Invalid duration");
        rental.rent(id, 0);
        vm.expectRevert("Invalid duration");
        rental.rent(id, 31);
        vm.stopPrank();
        vm.warp(block.timestamp + 364 days);
        vm.prank(buyer);
        vm.expectRevert("Outside right period");
        rental.rent(id, 2);
    }

    function testStrangersCannotWithdrawAndUnsolicitedTransfersFail() public {
        uint256 id = offer();
        vm.prank(buyer);
        vm.expectRevert("Lender required");
        rental.withdraw(id);
        vm.prank(owner);
        vm.expectRevert();
        rights.safeTransferFrom(owner, address(rental), solar, 1, "");
    }

    function testClosedRightCannotBeUsedButCanBeRecoveredAfterExpiry() public {
        uint256 id = offer();
        vm.prank(buyer);
        rental.rent(id, 1);
        rights.closeRight(usage);
        assertEq(rental.userOf(id), address(0));
        vm.warp(block.timestamp + 1 days);
        vm.prank(owner);
        rental.withdraw(id);
        assertEq(rights.balanceOf(owner, usage), 1);
    }

    function testInvalidFeesDurationAndSelfRental() public {
        vm.startPrank(owner);
        vm.expectRevert("Invalid rental terms");
        rental.createOffer(usage, 0, 30);
        vm.expectRevert("Invalid rental terms");
        rental.createOffer(usage, 1 ether, 0);
        vm.expectRevert("Invalid rental terms");
        rental.createOffer(usage, 1 ether, 366);
        vm.stopPrank();
        uint256 id = offer();
        vm.prank(owner);
        vm.expectRevert("Offer unavailable");
        rental.rent(id, 1);
        vm.expectRevert("Unknown offer");
        rental.getOffer(99);
        assertFalse(rental.available(99));
        assertFalse(rental.withdrawable(99));
    }

    function testInactiveRightExpiryAndDuplicateWithdrawal() public {
        uint256 inactive = issue(0, 0, 0);
        vm.prank(owner);
        uint256 id = rental.createOffer(inactive, 1 ether, 7);
        assertFalse(rental.available(id));
        vm.prank(buyer);
        vm.expectRevert("Outside right period");
        rental.rent(id, 1);
        rights.activateRight(inactive);
        vm.prank(buyer);
        rental.rent(id, 1);
        vm.warp(rental.getOffer(id).endsAt);
        vm.prank(buyer);
        vm.expectRevert("Renter required");
        rental.returnRental(id);
        vm.startPrank(owner);
        rental.withdraw(id);
        vm.expectRevert("Offer unavailable");
        rental.withdraw(id);
        vm.stopPrank();
    }

    function testRejectsBatchDepositsAndRestrictedUsage() public {
        uint256 restricted = issue(0, 0, 1);
        vm.prank(owner);
        vm.expectRevert("Exclusive open usage right required");
        rental.createOffer(restricted, 1 ether, 2);
        uint256[] memory ids = new uint256[](1);
        ids[0] = usage;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 1;
        vm.prank(owner);
        vm.expectRevert("Use createOffer");
        rights.safeBatchTransferFrom(owner, address(rental), ids, amounts, "");
    }
}
