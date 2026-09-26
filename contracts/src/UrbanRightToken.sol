// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {ERC1155Supply} from "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import {UrbanAssetRegistry} from "./UrbanAssetRegistry.sol";
import {IUrbanNamespaceAuthority} from "./ens/IENSv2.sol";

interface IRevenueCheckpoint {
    function checkpoint(uint256 id, address account) external;
}

contract UrbanRightToken is ERC1155Supply {
    enum Status {
        PENDING_VERIFICATION,
        VERIFIED,
        ACTIVE,
        CLOSED,
        REJECTED
    }

    struct Right {
        uint256 assetId;
        address issuer;
        uint8 rightType;
        uint8 transferPolicy;
        Status status;
        uint64 startAt;
        uint64 endAt;
        bytes32 termsHash;
        string termsURI;
    }

    struct RightRequest {
        uint256 assetId;
        uint8 kind;
        uint256 supply;
        string terms;
        bytes32 termsHash;
        uint64 start;
        uint64 end;
        uint8 policy;
        uint8 scope;
        bytes32 purpose;
        bool exclusive;
    }

    struct SpatialScope {
        uint8 scope;
        bytes32 purpose;
        bool exclusive;
    }
    mapping(uint256 => SpatialScope) public spatialScopes;
    mapping(uint256 => uint256[]) private assetRights;
    event RightScopeDefined(
        uint256 indexed rightId, uint256 indexed assetId, uint8 scope, bytes32 purpose, bool exclusive
    );
    UrbanAssetRegistry public immutable registry;
    address public immutable paymentToken;
    address public revenueVault;
    IUrbanNamespaceAuthority public namespaceAuthority;
    event NamespaceAuthorityConfigured(address indexed authority);
    event DelegatedRightCreated(uint256 indexed rightId, bytes32 indexed bindingId, address indexed operator, address issuer);
    uint256 public nextRightId = 1;
    mapping(uint256 => Right) private rights;
    mapping(uint256 => mapping(address => bool)) public allowed;
    event RightCreated(
        uint256 indexed rightId,
        uint256 indexed assetId,
        address indexed issuer,
        uint8 rightType,
        uint256 supply,
        string termsURI,
        bytes32 termsHash,
        uint64 startAt,
        uint64 endAt,
        uint8 transferPolicy
    );
    event RightVerified(uint256 indexed rightId, bool approved);
    event RightActivated(uint256 indexed rightId, uint256 indexed assetId);
    event RightClosed(uint256 indexed rightId);
    event TransferPermissionUpdated(uint256 indexed rightId, address indexed account, bool allowed);

    constructor(UrbanAssetRegistry r, address token) ERC1155("") {
        registry = r;
        paymentToken = token;
    }
    modifier verifier() {
        require(registry.hasRole(registry.VERIFIER_ROLE(), msg.sender), "Verifier required");
        _;
    }

    function setRevenueVault(address vault) external {
        require(
            registry.hasRole(bytes32(0), msg.sender) && revenueVault == address(0) && vault.code.length > 0,
            "Invalid vault"
        );
        revenueVault = vault;
    }

    function setNamespaceAuthority(IUrbanNamespaceAuthority authority) external {
        require(registry.hasRole(bytes32(0), msg.sender) && address(namespaceAuthority) == address(0)
            && address(authority).code.length > 0 && authority.rightsToken() == address(this)
            && authority.assetRegistry() == address(registry), "Invalid namespace authority");
        namespaceAuthority = authority;
        emit NamespaceAuthorityConfigured(address(authority));
    }

    function createRight(
        uint256 assetId,
        uint8 kind,
        uint256 supply,
        string calldata terms,
        bytes32 termsHash,
        uint64 start,
        uint64 end,
        uint8 policy
    ) external returns (uint256 id) {
        return _create(
            RightRequest(
                assetId,
                kind,
                supply,
                terms,
                termsHash,
                start,
                end,
                policy,
                kind == 1 ? 0 : 4,
                keccak256("GENERAL"),
                kind != 1
            ), msg.sender
        );
    }

    function createScopedRight(RightRequest calldata request) external returns (uint256) {
        return _create(request, msg.sender);
    }

    function createScopedRightForIssuer(RightRequest calldata q) external returns (uint256 id) {
        require(address(namespaceAuthority) != address(0), "ENS authority not configured");
        bytes32 binding = namespaceAuthority.consume(msg.sender, q.assetId, q.scope, q.purpose, q.kind,
            q.policy, q.exclusive, q.start, q.end, q.supply);
        address issuer = registry.issuerOf(q.assetId);
        id = _create(q, issuer);
        emit DelegatedRightCreated(id, binding, msg.sender, issuer);
    }

    function _create(RightRequest memory q, address issuer) private returns (uint256 id) {
        require(
            registry.isVerified(q.assetId) && registry.issuerOf(q.assetId) == issuer, "Verified issuer required"
        );
        require(
            q.kind <= 3 && q.policy <= 2 && q.supply > 0 && q.supply <= 1e12 && q.end > q.start
                && q.end > block.timestamp && bytes(q.terms).length > 0 && bytes(q.terms).length <= 4096
                && q.termsHash != bytes32(0),
            "Invalid terms"
        );
        require(!q.exclusive || q.supply == 1, "Exclusive usage is indivisible");
        require(q.scope <= 4 && q.purpose != bytes32(0) && !(q.kind == 1 && q.exclusive), "Invalid spatial scope");
        require(assetRights[q.assetId].length < 128, "Asset right limit");
        require(
            q.kind == 1 || findConflict(q.assetId, q.scope, q.start, q.end, q.exclusive) == 0, "Spatial right conflict"
        );
        require(revenueVault != address(0), "Revenue vault required");
        id = nextRightId++;
        rights[id] = Right(
            q.assetId, issuer, q.kind, q.policy, Status.PENDING_VERIFICATION, q.start, q.end, q.termsHash, q.terms
        );
        spatialScopes[id] = SpatialScope(q.scope, q.purpose, q.exclusive);
        assetRights[q.assetId].push(id);
        allowed[id][issuer] = true;
        emit RightCreated(id, q.assetId, issuer, q.kind, q.supply, q.terms, q.termsHash, q.start, q.end, q.policy);
        emit RightScopeDefined(id, q.assetId, q.scope, q.purpose, q.exclusive);
        _mint(issuer, id, q.supply, "");
    }

    /// @notice Canonical scopes: roof=0, interior=1, wall=2, land=3, whole asset=4.
    /// Half-open intervals [start,end): adjacent periods do not conflict.
    function findConflict(uint256 assetId, uint8 scope, uint64 start, uint64 end, bool exclusive)
        public
        view
        returns (uint256)
    {
        uint256[] storage ids = assetRights[assetId];
        for (uint256 i; i < ids.length; i++) {
            Right storage r = rights[ids[i]];
            SpatialScope storage s = spatialScopes[ids[i]];
            if (r.rightType == 1 || (r.status != Status.VERIFIED && r.status != Status.ACTIVE)) continue;
            if (
                (exclusive || s.exclusive) && (scope == s.scope || scope == 4 || s.scope == 4) && start < r.endAt
                    && r.startAt < end
            ) return ids[i];
        }
        return 0;
    }

    function getRight(uint256 id) external view returns (Right memory) {
        require(rights[id].issuer != address(0), "Unknown right");
        return rights[id];
    }

    function uri(uint256 id) public view override returns (string memory) {
        return rights[id].termsURI;
    }

    function verifyRight(uint256 id, bool approved) external verifier {
        require(rights[id].issuer != address(0) && rights[id].status == Status.PENDING_VERIFICATION, "Not pending");
        Right storage r = rights[id];
        SpatialScope storage s = spatialScopes[id];
        if (approved && r.rightType != 1) {
            require(findConflict(r.assetId, s.scope, r.startAt, r.endAt, s.exclusive) == 0, "Spatial right conflict");
        }
        rights[id].status = approved ? Status.VERIFIED : Status.REJECTED;
        emit RightVerified(id, approved);
    }

    function activateRight(uint256 id) external verifier {
        require(
            isTradable(id) && rights[id].status == Status.VERIFIED && block.timestamp >= rights[id].startAt,
            "Not activatable"
        );
        rights[id].status = Status.ACTIVE;
        emit RightActivated(id, rights[id].assetId);
    }

    function closeRight(uint256 id) external verifier {
        require(rights[id].status == Status.ACTIVE || rights[id].status == Status.VERIFIED, "Not live");
        rights[id].status = Status.CLOSED;
        emit RightClosed(id);
    }

    function setAllowed(uint256 id, address who, bool yes) external verifier {
        require(rights[id].issuer != address(0));
        allowed[id][who] = yes;
        emit TransferPermissionUpdated(id, who, yes);
    }

    function isTradable(uint256 id) public view returns (bool) {
        Right storage r = rights[id];
        return r.issuer != address(0) && (r.status == Status.VERIFIED || r.status == Status.ACTIVE)
            && block.timestamp < r.endAt && r.transferPolicy != 2;
    }

    function isRevenue(uint256 id) external view returns (bool) {
        return rights[id].issuer != address(0) && rights[id].rightType == 1;
    }

    function isOperating(uint256 id) external view returns (bool) {
        return rights[id].status == Status.ACTIVE && block.timestamp >= rights[id].startAt
            && block.timestamp < rights[id].endAt;
    }

    function isBasketCompatible(uint256 id) external view returns (bool) {
        return isTradable(id) && rights[id].rightType == 1 && rights[id].transferPolicy == 0;
    }

    function burn(uint256 id, uint256 amount) external {
        _burn(msg.sender, id, amount);
    }

    function _update(address from, address to, uint256[] memory ids, uint256[] memory amounts) internal override {
        for (uint256 i; i < ids.length; i++) {
            Right storage r = rights[ids[i]];
            if (from != address(0) && to != address(0)) {
                // Expired/closed receipts can be returned by vaults; marketplaces separately reject trading them.
                require(
                    r.status == Status.VERIFIED || r.status == Status.ACTIVE || r.status == Status.CLOSED,
                    "Unverified right"
                );
                require(r.transferPolicy != 2, "Nontransferable");
                if (r.transferPolicy == 1) {
                    require(allowed[ids[i]][from] && allowed[ids[i]][to], "Restricted transfer");
                }
            }
            if (r.rightType == 1 && revenueVault != address(0)) {
                if (from != address(0)) IRevenueCheckpoint(revenueVault).checkpoint(ids[i], from);
                if (to != address(0) && to != from) IRevenueCheckpoint(revenueVault).checkpoint(ids[i], to);
            }
        }
        super._update(from, to, ids, amounts);
    }
}
