// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import {ProtocolBase} from "./Protocol.t.sol";
import {UrbanRightToken} from "../src/UrbanRightToken.sol";
import {UrbanNamespaceAuthority} from "../src/UrbanNamespaceAuthority.sol";
import {IENSv2Registry, IENSv2Factory, IUrbanNamespaceAuthority} from "../src/ens/IENSv2.sol";

interface ENSWrite is IENSv2Registry {
    function register(string calldata label,address owner,address child,address resolver,uint256 roles,uint64 expiry) external returns (uint256);
    function setParent(address parent,string calldata label) external;
    function setSubregistry(uint256 id,address child) external;
    function setResolver(uint256 id,address resolver) external;
    function grantRoles(uint256 id,uint256 roles,address who) external;
    function revokeRoles(uint256 id,uint256 roles,address who) external;
    function revokeRootRoles(uint256 roles,address who) external;
    function unregister(uint256 id) external;
    function unsafeTransfer(address to,uint256 tokenId,bytes calldata data) external;
}
interface ENSFactory is IENSv2Factory {
    function deployProxy(address impl,uint256 salt,bytes calldata data) external returns(address);
}
interface ENSResolver {
    function setText(bytes calldata name,string calldata key,string calldata value) external;
    function grantSetterRoles(bytes calldata setter,address account) external returns(bool);
    function revokeRoles(uint256 resource,uint256 roles,address account) external returns(bool);
}
interface UniversalResolver {
    function resolve(bytes calldata name,bytes calldata data) external view returns(bytes memory,address);
    function resolveWithGateways(bytes calldata name,bytes calldata data,string[] calldata gateways) external view returns(bytes memory,address);
}

/// Real, pinned official ENSv2 creation bytecode, deployed locally. No mock registry authorization.
contract ENSDelegationTest is ProtocolBase {
    uint256 constant REGISTRAR = 1;
    uint256 constant PARENT = 1 << 8;
    uint256 constant UNREGISTER = 1 << 12;
    uint256 constant RESOLVER = 1 << 24;
    uint256 constant TRANSFER = (1 << 28) << 128;
    uint256 constant SET_CHILD = 1 << 20;
    struct InitGrant {address account; uint256 roleBitmap;}
    ENSFactory ensFactory;
    ENSWrite ensRoot;
    ENSWrite ensEth;
    ENSWrite building;
    address userImpl;
    address resolver;
    UniversalResolver universal;
    UrbanNamespaceAuthority authority;
    bytes32 binding;
    uint64 expiry;
    uint256 roofHash = uint256(keccak256("rooftop"));
    string[] labels;

    function setUp() public override {
        super.setUp();
        expiry = uint64(block.timestamp + 365 days);
        ensFactory = ENSFactory(_artifact("VerifiableFactory", ""));
        address labelStore = _artifact("LabelStore", abi.encode(address(0)));
        userImpl = _artifact("UserRegistryImpl", abi.encode(labelStore,owner));
        ensRoot = ENSWrite(_artifact("ETHRegistry", abi.encode(labelStore,owner,REGISTRAR)));
        ensEth = ENSWrite(_artifact("ETHRegistry", abi.encode(labelStore,owner,REGISTRAR)));
        address resolverImpl = _artifact("PermissionedResolverImpl",abi.encode(owner));
        InitGrant[] memory g = new InitGrant[](1);
        g[0] = InitGrant(owner,0x1111111111111111111111111111111111111111111111111111111111111111);
        resolver = ensFactory.deployProxy(resolverImpl,9,abi.encodeWithSignature("initialize((address,uint256)[],bytes[])",g,new bytes[](0)));
        universal = UniversalResolver(_artifact("UniversalResolverV2",abi.encode(address(ensRoot),address(0),address(0))));
        vm.prank(owner); ensRoot.register("eth",owner,address(ensEth),address(0),0,expiry);
        labels.push("tokyo-test"); labels.push("chiyoda"); labels.push("building-1"); labels.push("rooftop");
        ENSWrite current = ensEth;
        for(uint256 i; i<3; i++) {
            g[0] = InitGrant(owner,REGISTRAR | PARENT | (PARENT << 128));
            address child = ensFactory.deployProxy(userImpl,i,abi.encodeWithSignature("initialize((address,uint256)[])",g));
            vm.startPrank(owner);
            current.register(labels[i],owner,child,address(0),0,expiry);
            ENSWrite(child).setParent(address(current),labels[i]);
            ENSWrite(child).revokeRootRoles(PARENT | (PARENT << 128),owner);
            vm.stopPrank(); current = ENSWrite(child);
        }
        building = current;
        vm.startPrank(owner);
        building.register("rooftop",owner,address(0),resolver,RESOLVER | (RESOLVER << 128) | UNREGISTER | (UNREGISTER << 128),expiry);
        building.register("interior",owner,address(0),resolver,RESOLVER | (RESOLVER << 128),expiry);
        vm.stopPrank();
        authority = new UrbanNamespaceAuthority(registry,address(rights),ensEth,ensFactory,userImpl);
        rights.setNamespaceAuthority(IUrbanNamespaceAuthority(address(authority)));
        vm.prank(owner); binding = authority.bindSpace(1,0,labels);
    }
    function _artifact(string memory name,bytes memory args) internal returns(address deployed) {
        bytes memory code = bytes.concat(vm.parseJsonBytes(vm.readFile(string.concat("test/fixtures/ensv2/",name,".json")),".bytecode"),args);
        assembly { deployed := create(0,add(code,32),mload(code)) }
        require(deployed != address(0),string.concat("Official ENS artifact deployment failed: ", name));
    }
    function _limits() internal view returns(UrbanNamespaceAuthority.Limits memory) {
        return UrbanNamespaceAuthority.Limits(keccak256("SOLAR"),1,0,false,uint64(block.timestamp),expiry-1,expiry-1,100);
    }
    function _grant() internal {
        vm.prank(owner); building.grantRoles(roofHash,RESOLVER,buyer);
        vm.prank(owner); authority.grantIssuance(binding,buyer,_limits());
    }
    function _request() internal view returns(UrbanRightToken.RightRequest memory) {
        return UrbanRightToken.RightRequest(1,1,40,"ipfs://delegated",keccak256("terms"),uint64(block.timestamp),expiry-1,0,0,keccak256("SOLAR"),false);
    }
    function testRoofDelegationMintsToIssuerAndPreservesVerification() public {
        _grant();
        vm.prank(buyer); uint256 id=rights.createScopedRightForIssuer(_request());
        assertEq(rights.balanceOf(owner,id),40); assertEq(rights.balanceOf(buyer,id),0);
        assertEq(rights.getRight(id).issuer,owner);
        assertEq(uint8(rights.getRight(id).status),uint8(UrbanRightToken.Status.PENDING_VERIFICATION));
        assertFalse(rights.isTradable(id));
        vm.prank(buyer); vm.expectRevert(); rights.verifyRight(id,true);
        rights.verifyRight(id,true); assertTrue(rights.isTradable(id));
        assertEq(authority.issuanceAvailable(binding,buyer),60);
    }
    function testReporterCanEditOnlyEnergyReportAndRevocationStopsWrites() public {
        bytes memory name = hex"07726f6f66746f700a6275696c64696e672d3107636869796f64610a746f6b796f2d746573740365746800";
        bytes memory setter=abi.encodeCall(ENSResolver.setText,(name,"urban.energyReport",""));
        vm.prank(owner); ENSResolver(resolver).grantSetterRoles(setter,buyer);
        vm.prank(buyer); ENSResolver(resolver).setText(name,"urban.energyReport","125.50 kWh");
        vm.prank(buyer); vm.expectRevert(); ENSResolver(resolver).setText(name,"urban.assetId","999");
        vm.prank(buyer); vm.expectRevert(); ENSResolver(resolver).setText(name,"urban.rightsContract","0x0000");
        vm.prank(buyer); vm.expectRevert(); building.setResolver(roofHash,buyer);
        vm.prank(buyer); vm.expectRevert(); rights.createScopedRightForIssuer(_request());
        vm.prank(owner); ENSResolver(resolver).revokeRoles(uint256(keccak256("urban.energyReport")),1 << 4,buyer);
        vm.prank(buyer); vm.expectRevert(); ENSResolver(resolver).setText(name,"urban.energyReport","999");
        (bytes memory value,)=universal.resolveWithGateways(name,abi.encodeWithSignature("text(bytes32,string)",bytes32(0),"urban.energyReport"),new string[](0));
        assertEq(abi.decode(value,(string)),"125.50 kWh");
    }
    function testRoofOperatorCannotIssueInteriorOrOtherAsset() public {
        _grant(); UrbanRightToken.RightRequest memory q=_request(); q.scope=1;
        vm.prank(buyer); vm.expectRevert(); rights.createScopedRightForIssuer(q);
        q.scope=0; q.assetId=2;
        vm.prank(buyer); vm.expectRevert(); rights.createScopedRightForIssuer(q);
    }
    function testEacAloneDoesNotGrantIssuanceAndIssuerCannotGrantWithoutEac() public {
        vm.prank(owner); vm.expectRevert(); authority.grantIssuance(binding,buyer,_limits());
        vm.prank(owner); building.grantRoles(roofHash,RESOLVER,buyer);
        vm.prank(buyer); vm.expectRevert(); rights.createScopedRightForIssuer(_request());
    }
    function testEnsRevocationStopsIssuanceWithoutBurningExistingRights() public {
        _grant(); vm.prank(buyer); uint256 id=rights.createScopedRightForIssuer(_request());
        vm.prank(owner); building.revokeRoles(roofHash,RESOLVER,buyer);
        vm.prank(buyer); vm.expectRevert(); rights.createScopedRightForIssuer(_request());
        assertEq(rights.balanceOf(owner,id),40);
    }
    function testAppRevocationStopsIssuanceEvenWithEnsRole() public {
        _grant(); vm.prank(owner); authority.revokeIssuance(binding,buyer);
        vm.prank(buyer); vm.expectRevert(); rights.createScopedRightForIssuer(_request());
        assertTrue(building.hasRoles(roofHash,RESOLVER,buyer));
    }
    function testLimitsPreventChangingPurposePolicyPeriodKindOrQuantity() public {
        _grant(); UrbanRightToken.RightRequest memory q=_request();
        q.purpose=keccak256("RESTAURANT"); vm.prank(buyer); vm.expectRevert(); rights.createScopedRightForIssuer(q);
        q=_request(); q.policy=1; vm.prank(buyer); vm.expectRevert(); rights.createScopedRightForIssuer(q);
        q=_request(); q.kind=0; vm.prank(buyer); vm.expectRevert(); rights.createScopedRightForIssuer(q);
        q=_request(); q.end=expiry; vm.prank(buyer); vm.expectRevert(); rights.createScopedRightForIssuer(q);
        q=_request(); q.supply=101; vm.prank(buyer); vm.expectRevert(); rights.createScopedRightForIssuer(q);
        q=_request(); vm.prank(buyer); rights.createScopedRightForIssuer(q);
        vm.prank(buyer); rights.createScopedRightForIssuer(q);
        vm.prank(buyer); vm.expectRevert(); rights.createScopedRightForIssuer(q);
        assertEq(authority.issuanceAvailable(binding,buyer),20);
    }
    function testExpiredNameAndGrantCannotIssue() public {
        _grant(); UrbanRightToken.RightRequest memory q=_request(); vm.warp(expiry);
        vm.prank(buyer); vm.expectRevert(); rights.createScopedRightForIssuer(q);
    }
    function testReregistrationDoesNotRestoreOldGrant() public {
        _grant(); vm.startPrank(owner);
        building.unregister(roofHash);
        building.register("rooftop",owner,address(0),resolver,RESOLVER | (RESOLVER << 128),expiry);
        building.grantRoles(roofHash,RESOLVER,buyer);
        vm.stopPrank();
        vm.prank(buyer); vm.expectRevert(); rights.createScopedRightForIssuer(_request());
    }
    function testLockedNameCannotTransferAwayAndBack() public {
        _grant(); uint256 token=building.getState(roofHash).tokenId;
        vm.prank(owner); vm.expectRevert(); building.unsafeTransfer(carol,token,"");
        vm.prank(owner); vm.expectRevert(); building.grantRoles(roofHash,TRANSFER,owner);
    }
    function testRebindingInvalidatesExistingAppGrants() public {
        _grant(); vm.prank(owner); authority.bindSpace(1,0,labels);
        vm.prank(buyer); vm.expectRevert(); rights.createScopedRightForIssuer(_request());
    }
    function testOnlyIssuerCanBindGrantOrRevokeAndOnlyRightsCanConsume() public {
        vm.startPrank(carol); vm.expectRevert(); authority.bindSpace(1,0,labels);
        vm.expectRevert(); authority.grantIssuance(binding,buyer,_limits());
        vm.expectRevert(); authority.revokeIssuance(binding,buyer);
        vm.expectRevert(); authority.consume(buyer,1,0,keccak256("SOLAR"),1,0,false,1,expiry,1);
        vm.stopPrank();
    }
    function testSpatialConflictRollsBackDelegatedQuota() public {
        vm.prank(owner); building.grantRoles(roofHash,RESOLVER,buyer);
        UrbanNamespaceAuthority.Limits memory l=_limits(); l.kind=0; l.exclusive=true; l.maxSupply=1;
        vm.prank(owner); authority.grantIssuance(binding,buyer,l);
        UrbanRightToken.RightRequest memory q=_request(); q.kind=0; q.exclusive=true; q.supply=1;
        vm.prank(owner); uint256 existing=rights.createScopedRight(q);
        rights.verifyRight(existing,true);
        vm.prank(buyer); vm.expectRevert(); rights.createScopedRightForIssuer(q);
        assertEq(authority.issuanceAvailable(binding,buyer),1);
    }
    function testWrongChainCannotConsumeSameBinding() public {
        _grant(); vm.chainId(block.chainid+1);
        vm.prank(buyer); vm.expectRevert(); rights.createScopedRightForIssuer(_request());
    }
    function testFuzzQuotaCannotExceedGrant(uint256 quantity) public {
        _grant(); quantity=bound(quantity,1,100);
        UrbanRightToken.RightRequest memory q=_request(); q.supply=quantity;
        vm.prank(buyer); rights.createScopedRightForIssuer(q);
        q.supply=101-quantity;
        vm.prank(buyer); vm.expectRevert(); rights.createScopedRightForIssuer(q);
        assertEq(authority.issuanceAvailable(binding,buyer),100-quantity);
    }
    function testUniversalResolverResolvesProtocolReferenceThroughRealHierarchy() public {
        bytes memory name=hex"07726f6f66746f700a6275696c64696e672d3107636869796f64610a746f6b796f2d746573740365746800";
        vm.prank(owner); ENSResolver(resolver).setText(name,"urban.assetId","1");
        (bytes memory value,address usedResolver)=universal.resolveWithGateways(name,abi.encodeWithSignature("text(bytes32,string)",bytes32(0),"urban.assetId"),new string[](0));
        assertEq(abi.decode(value,(string)),"1"); assertEq(usedResolver,resolver);
    }
}
