// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import {ProtocolBase} from "./Protocol.t.sol";
import {UrbanRightToken} from "../src/UrbanRightToken.sol";

contract SpatialTest is ProtocolBase {
    function scoped(uint8 scope, uint64 start, uint64 end, bool exclusive, uint8 kind) internal returns (uint256) {
        UrbanRightToken.RightRequest memory r = UrbanRightToken.RightRequest(
            1, kind, 1, "ipfs://scoped", keccak256("scoped"), start, end, 0, scope, keccak256("SOLAR"), exclusive
        );
        vm.prank(owner);
        return rights.createScopedRight(r);
    }

    function testExclusiveSameScopeOverlapRejectedAndAdjacentAllowed() public {
        uint256 id = scoped(0, 100, 200, true, 0);
        rights.verifyRight(id, true);
        vm.expectRevert();
        scoped(0, 150, 250, true, 0);
        uint256 adjacent = scoped(0, 200, 300, true, 0);
        rights.verifyRight(adjacent, true);
        uint256 floor = scoped(1, 100, 200, true, 0);
        rights.verifyRight(floor, true);
    }

    function testWholeAssetConflictsWithRoofAndRevenueCanCoexist() public {
        uint256 id = scoped(0, 100, 200, true, 0);
        rights.verifyRight(id, true);
        vm.expectRevert();
        scoped(4, 120, 180, true, 0);
        uint256 income = scoped(0, 120, 180, false, 1);
        rights.verifyRight(income, true);
    }

    function testPendingRightsRaceRecheckedAtVerification() public {
        uint256 a = scoped(0, 100, 200, true, 0);
        uint256 b = scoped(0, 110, 190, true, 0);
        rights.verifyRight(a, true);
        vm.expectRevert();
        rights.verifyRight(b, true);
    }

    function testNoConflictBetweenNonexclusiveRevenueRights() public {
        uint256 a = scoped(0, 100, 200, false, 1);
        uint256 b = scoped(0, 100, 200, false, 1);
        rights.verifyRight(a, true);
        rights.verifyRight(b, true);
    }

    function testSharedUsageStillConflictsWithExclusiveUsage() public {
        uint256 a = scoped(0, 100, 200, true, 0);
        rights.verifyRight(a, true);
        vm.expectRevert();
        scoped(0, 120, 180, false, 0);
    }
}
