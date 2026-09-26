// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import {ProtocolBase} from "./Protocol.t.sol";
import {CardPurchaseExecutor} from "../src/CardPurchaseExecutor.sol";

contract CardPurchaseTest is ProtocolBase {
    CardPurchaseExecutor executor;
    uint256 listing;
    bytes32 orderId = keccak256("stripe-order-1");
    address operator = address(0xD);

    function setUp() public override {
        super.setUp();
        executor = new CardPurchaseExecutor(market, operator);
        cash.mint(address(executor), 10_000 ether);
        vm.prank(owner);
        listing = market.createListing(address(rights), solar, 20, 100 ether);
    }

    function testOperatorBuysAndDeliversAtomically() public {
        uint256 beforeCash = cash.balanceOf(owner);
        vm.prank(operator);
        executor.fulfill(orderId, listing, 2, buyer, 200 ether);
        assertEq(rights.balanceOf(buyer, solar), 2);
        assertEq(rights.balanceOf(operator, solar), 0);
        assertEq(rights.balanceOf(address(executor), solar), 0);
        assertEq(cash.balanceOf(owner), beforeCash + 200 ether);
        assertEq(cash.allowance(address(executor), address(market)), 0);
        assertEq(executor.fulfilled(orderId), keccak256(abi.encode(listing, uint256(2), buyer, uint256(200 ether))));
    }

    function testReplayAndUnauthorizedCallsFail() public {
        vm.prank(buyer);
        vm.expectRevert("Operator only");
        executor.fulfill(orderId, listing, 1, buyer, 100 ether);
        vm.startPrank(operator);
        executor.fulfill(orderId, listing, 1, buyer, 100 ether);
        vm.expectRevert("Order already fulfilled");
        executor.fulfill(orderId, listing, 1, carol, 100 ether);
        vm.stopPrank();
        assertEq(rights.balanceOf(buyer, solar), 1);
        assertEq(rights.balanceOf(carol, solar), 0);
    }

    function testWrongPriceAndSoldOutFailWithoutSpending() public {
        vm.startPrank(operator);
        vm.expectRevert("Price changed");
        executor.fulfill(orderId, listing, 1, buyer, 99 ether);
        vm.expectRevert("Invalid order");
        executor.fulfill(orderId, listing, 21, buyer, 2100 ether);
        vm.stopPrank();
        assertEq(executor.fulfilled(orderId), bytes32(0));
        assertEq(cash.balanceOf(address(executor)), 10_000 ether);
    }

    function testRecipientRejectingTokensRollsBackPurchaseAndPayment() public {
        // The marketplace is not an ERC1155 receiver.
        vm.prank(operator);
        vm.expectRevert();
        executor.fulfill(orderId, listing, 1, address(market), 100 ether);
        assertEq(executor.fulfilled(orderId), bytes32(0));
        assertEq(cash.balanceOf(address(executor)), 10_000 ether);
        (,,,uint256 remaining,,) = market.listings(listing);
        assertEq(remaining, 20);
    }

    function testBasketDelivery() public {
        uint256 id = basket();
        vm.startPrank(owner);
        baskets.depositUnderlying(id, 3);
        uint256 offer = market.createListing(address(baskets), id, 3, 100 ether);
        vm.stopPrank();
        vm.prank(operator);
        executor.fulfill(orderId, offer, 2, buyer, 200 ether);
        assertEq(baskets.balanceOf(buyer, id), 2);
        assertEq(baskets.balanceOf(address(executor), id), 0);
    }

    function testRejectsMainnetDeployment() public {
        vm.chainId(1);
        vm.expectRevert("Testnet only");
        new CardPurchaseExecutor(market, operator);
    }
}
