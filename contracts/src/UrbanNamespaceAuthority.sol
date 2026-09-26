// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {UrbanAssetRegistry} from "./UrbanAssetRegistry.sol";
import {IENSv2Registry, IENSv2Factory} from "./ens/IENSv2.sol";

/// @notice Issuer-approved, bounded issuance checked against a locked, canonical ENSv2 path.
/// ENS permissions do not prove property ownership, replace verification, or transfer existing rights.
contract UrbanNamespaceAuthority {
    uint256 public constant ENS_OPERATOR_ROLE = 1 << 24; // ROLE_SET_RESOLVER, name-scoped
    uint256 private constant SET_SUBREGISTRY = 1 << 20;
    uint256 private constant SET_PARENT = 1 << 8;
    uint256 private constant TRANSFER = (1 << 28) << 128;
    address public immutable rightsToken;
    UrbanAssetRegistry public immutable assetRegistry;
    IENSv2Registry public immutable anchor;
    IENSv2Factory public immutable factory;
    address public immutable userRegistryImplementation;
    uint256 public immutable chainId;

    struct Node { address registry; string label; uint256 resource; address controller; }
    struct Binding { uint256 assetId; uint8 scope; address issuer; bytes32 geoReference; uint64 nonce; Node[] path; }
    struct Limits {
        bytes32 purpose; uint8 kind; uint8 policy; bool exclusive;
        uint64 minStart; uint64 maxEnd; uint64 validUntil; uint256 maxSupply;
    }
    struct Grant { uint64 bindingNonce; Limits limits; uint256 usedSupply; bool enabled; }
    mapping(bytes32 => Binding) private bindings;
    mapping(bytes32 => mapping(address => Grant)) private grants;

    event SpaceNamespaceBound(bytes32 indexed bindingId, uint256 indexed assetId, uint8 scope, address indexed issuer,
        address leafRegistry, string label, bytes32 geoReference, uint64 nonce);
    event IssuanceDelegated(bytes32 indexed bindingId, address indexed issuer, address indexed operator, Limits limits);
    event IssuanceRevoked(bytes32 indexed bindingId, address indexed operator);
    event IssuanceConsumed(bytes32 indexed bindingId, address indexed operator, uint256 supply, uint256 usedSupply);

    constructor(UrbanAssetRegistry assets, address rights, IENSv2Registry ensAnchor, IENSv2Factory ensFactory, address impl) {
        require(address(assets).code.length > 0 && rights.code.length > 0 && address(ensAnchor).code.length > 0
            && address(ensFactory).code.length > 0 && impl.code.length > 0, "Contract required");
        assetRegistry = assets; rightsToken = rights; anchor = ensAnchor; factory = ensFactory;
        userRegistryImplementation = impl; chainId = block.chainid;
    }

    function bindingKey(uint256 assetId, uint8 scope) public pure returns (bytes32) {
        return keccak256(abi.encode(assetId, scope));
    }
    function getBinding(bytes32 id) external view returns (Binding memory) { return bindings[id]; }
    function getGrant(bytes32 id, address operator) external view returns (Grant memory) { return grants[id][operator]; }
    function bindingExpiry(bytes32 id) external view returns (uint64) { return _validatePath(bindings[id]); }

    /// @param labels Parent label / district / building-ID / canonical scope, below trusted .eth anchor.
    /// @dev Every child must be the official factory's pinned UserRegistry implementation.
    function bindSpace(uint256 assetId, uint8 scope, string[] calldata labels) external returns (bytes32 id) {
        require(block.chainid == chainId && labels.length == 4 && scope <= 4, "Invalid namespace path");
        UrbanAssetRegistry.UrbanAsset memory asset = assetRegistry.getAsset(assetId);
        require(assetRegistry.isVerified(assetId) && asset.issuer == msg.sender, "Verified issuer required");
        require(keccak256(bytes(labels[2])) == keccak256(bytes(string.concat("building-", Strings.toString(assetId))))
            && keccak256(bytes(labels[3])) == keccak256(bytes(_scopeLabel(scope))), "Space label mismatch");
        id = bindingKey(assetId, scope);
        Binding storage b = bindings[id];
        delete b.path;
        b.assetId = assetId; b.scope = scope; b.issuer = msg.sender; b.geoReference = asset.geoReference; b.nonce++;
        address current = address(anchor);
        for (uint256 i; i < labels.length; i++) {
            _checkLabel(labels[i]);
            IENSv2Registry r = IENSv2Registry(current);
            uint256 hash = uint256(keccak256(bytes(labels[i])));
            IENSv2Registry.State memory s = r.getState(hash);
            require(s.status == 2 && s.expiry > block.timestamp && s.latestOwner != address(0), "Inactive ENS name");
            require(_locked(r, hash, i < labels.length - 1), "ENS path must be locked");
            b.path.push(Node(current, labels[i], s.resource, s.latestOwner));
            if (i + 1 < labels.length) {
                address child = r.getSubregistry(labels[i]);
                require(factory.verifyContract(child) == userRegistryImplementation, "Untrusted ENS registry");
                (address parent, string memory label) = IENSv2Registry(child).getParent();
                require(parent == current && keccak256(bytes(label)) == bytes32(hash), "Detached ENS path");
                require(!IENSv2Registry(child).hasAssignees(0, SET_PARENT | (SET_PARENT << 128)), "Mutable ENS parent");
                current = child;
            } else {
                require(s.latestOwner == asset.issuer, "ENS controller must be issuer");
            }
        }
        Node storage leaf = b.path[b.path.length - 1];
        emit SpaceNamespaceBound(id, assetId, scope, msg.sender, leaf.registry, leaf.label, asset.geoReference, b.nonce);
    }

    function grantIssuance(bytes32 id, address operator, Limits calldata limits) external {
        Binding storage b = bindings[id];
        require(b.issuer == msg.sender && operator != address(0), "Issuer required");
        uint64 expiry = _validatePath(b);
        require(limits.kind <= 3 && limits.policy <= 2 && limits.purpose != bytes32(0)
            && limits.maxSupply > 0 && limits.maxSupply <= 1e12 && limits.maxEnd > limits.minStart
            && limits.validUntil > block.timestamp && limits.validUntil <= expiry
            && limits.maxEnd <= expiry && limits.validUntil <= limits.maxEnd
            && (!limits.exclusive || (limits.kind != 1 && limits.maxSupply == 1)), "Invalid grant limits");
        _requireEnsRole(b, operator);
        grants[id][operator] = Grant(b.nonce, limits, 0, true);
        emit IssuanceDelegated(id, msg.sender, operator, limits);
    }

    function revokeIssuance(bytes32 id, address operator) external {
        require(bindings[id].issuer == msg.sender, "Issuer required");
        grants[id][operator].enabled = false;
        emit IssuanceRevoked(id, operator);
    }

    function consume(address operator, uint256 assetId, uint8 scope, bytes32 purpose, uint8 kind,
        uint8 policy, bool exclusive, uint64 start, uint64 end, uint256 supply) external returns (bytes32 id) {
        require(msg.sender == rightsToken, "Rights contract only");
        id = bindingKey(assetId, scope);
        Binding storage b = bindings[id];
        _validatePath(b);
        _requireEnsRole(b, operator);
        Grant storage g = grants[id][operator];
        Limits storage l = g.limits;
        require(g.enabled && g.bindingNonce == b.nonce && block.timestamp < l.validUntil, "No active issuance grant");
        require(l.purpose == purpose && l.kind == kind && l.policy == policy && l.exclusive == exclusive
            && start >= l.minStart && end <= l.maxEnd && supply > 0
            && supply <= l.maxSupply - g.usedSupply, "Outside issuance grant");
        g.usedSupply += supply;
        emit IssuanceConsumed(id, operator, supply, g.usedSupply);
    }

    /// @notice Readiness check for the UI; mint repeats all checks atomically.
    function issuanceAvailable(bytes32 id, address operator) external view returns (uint256 remaining) {
        Binding storage b = bindings[id];
        _validatePath(b); _requireEnsRole(b, operator);
        Grant storage g = grants[id][operator];
        require(g.enabled && g.bindingNonce == b.nonce && block.timestamp < g.limits.validUntil, "No active issuance grant");
        return g.limits.maxSupply - g.usedSupply;
    }

    function _validatePath(Binding storage b) private view returns (uint64 expiry) {
        require(block.chainid == chainId && b.path.length == 4 && assetRegistry.isVerified(b.assetId)
            && assetRegistry.issuerOf(b.assetId) == b.issuer, "Inactive space binding");
        require(assetRegistry.getAsset(b.assetId).geoReference == b.geoReference, "Geometry changed");
        expiry = type(uint64).max;
        for (uint256 i; i < b.path.length; i++) {
            Node storage n = b.path[i];
            IENSv2Registry r = IENSv2Registry(n.registry);
            uint256 hash = uint256(keccak256(bytes(n.label)));
            IENSv2Registry.State memory s = r.getState(hash);
            require(s.status == 2 && s.expiry > block.timestamp && s.resource == n.resource
                && s.latestOwner == n.controller && _locked(r, hash, i + 1 < b.path.length), "ENS binding changed");
            if (s.expiry < expiry) expiry = s.expiry;
            if (i > 0) {
                require(factory.verifyContract(n.registry) == userRegistryImplementation, "ENS implementation changed");
                Node storage parentNode = b.path[i - 1];
                require(IENSv2Registry(parentNode.registry).getSubregistry(parentNode.label) == n.registry, "Detached ENS path");
                (address parent, string memory label) = r.getParent();
                require(parent == parentNode.registry && keccak256(bytes(label)) == keccak256(bytes(parentNode.label))
                    && !r.hasAssignees(0, SET_PARENT | (SET_PARENT << 128)), "ENS parent changed");
            }
        }
    }
    function _locked(IENSv2Registry r, uint256 hash, bool hasChild) private view returns (bool) {
        uint256 frozen = TRANSFER | (hasChild ? SET_SUBREGISTRY | (SET_SUBREGISTRY << 128) : 0);
        return r.isEmancipated() && !r.hasAssignees(hash, frozen) && !r.hasAssignees(0, frozen);
    }
    function _requireEnsRole(Binding storage b, address operator) private view {
        require(b.path.length == 4, "Unknown space binding");
        Node storage leaf = b.path[3];
        require(IENSv2Registry(leaf.registry).hasRoles(uint256(keccak256(bytes(leaf.label))), ENS_OPERATOR_ROLE, operator), "ENS role required");
    }
    function _scopeLabel(uint8 scope) private pure returns (string memory) {
        if (scope == 0) return "rooftop"; if (scope == 1) return "interior";
        if (scope == 2) return "wall"; if (scope == 3) return "land"; return "whole";
    }
    function _checkLabel(string memory label) private pure {
        bytes memory chars = bytes(label);
        require(chars.length > 0 && chars.length <= 63 && chars[0] != "-" && chars[chars.length - 1] != "-", "Invalid label");
        for (uint256 i; i < chars.length; i++) require((chars[i] >= "a" && chars[i] <= "z")
            || (chars[i] >= "0" && chars[i] <= "9") || chars[i] == "-", "Invalid label");
    }
}
