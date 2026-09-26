// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

contract UrbanAssetRegistry is AccessControl {
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    enum Status {
        DRAFT,
        PENDING_VERIFICATION,
        VERIFIED,
        REJECTED
    }

    struct UrbanAsset {
        address issuer;
        bytes32 geoReference;
        string metadataURI;
        uint8 assetType;
        Status status;
    }
    mapping(bytes32 => uint256) public verifiedAssetByGeo;
    uint256 public nextAssetId = 1;
    mapping(uint256 => UrbanAsset) private assets;
    event AssetRegistered(
        uint256 indexed assetId, address indexed issuer, bytes32 geoReference, string metadataURI, uint8 assetType
    );
    event AssetVerificationRequested(uint256 indexed assetId);
    event AssetVerified(uint256 indexed assetId, address indexed verifier);
    event AssetRejected(uint256 indexed assetId);
    event AssetUpdated(uint256 indexed assetId, string metadataURI);

    constructor(address admin) {
        require(admin != address(0));
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(VERIFIER_ROLE, admin);
    }

    function registerAsset(bytes32 geo, string calldata metadata, uint8 kind) external returns (uint256 id) {
        require(
            geo != bytes32(0) && bytes(metadata).length > 0 && bytes(metadata).length <= 4096 && kind <= 3,
            "Invalid asset"
        );
        id = nextAssetId++;
        assets[id] = UrbanAsset(msg.sender, geo, metadata, kind, Status.DRAFT);
        emit AssetRegistered(id, msg.sender, geo, metadata, kind);
    }

    function getAsset(uint256 id) external view returns (UrbanAsset memory) {
        require(assets[id].issuer != address(0), "Unknown asset");
        return assets[id];
    }

    function issuerOf(uint256 id) external view returns (address) {
        return assets[id].issuer;
    }

    function isVerified(uint256 id) external view returns (bool) {
        return assets[id].issuer != address(0) && assets[id].status == Status.VERIFIED;
    }

    function updateMetadata(uint256 id, string calldata metadata) external {
        UrbanAsset storage a = assets[id];
        require(
            a.issuer == msg.sender && (a.status == Status.DRAFT || a.status == Status.REJECTED),
            "Frozen or unauthorized"
        );
        require(bytes(metadata).length > 0 && bytes(metadata).length <= 4096, "Invalid metadata");
        a.metadataURI = metadata;
        a.status = Status.DRAFT;
        emit AssetUpdated(id, metadata);
    }

    function requestVerification(uint256 id) external {
        UrbanAsset storage a = assets[id];
        require(a.issuer == msg.sender && a.status == Status.DRAFT, "Invalid lifecycle");
        a.status = Status.PENDING_VERIFICATION;
        emit AssetVerificationRequested(id);
    }

    function verifyAsset(uint256 id, bool approved) external onlyRole(VERIFIER_ROLE) {
        UrbanAsset storage a = assets[id];
        require(a.status == Status.PENDING_VERIFICATION, "Not pending");
        if (approved) {
            require(verifiedAssetByGeo[a.geoReference] == 0, "Canonical space already verified");
            verifiedAssetByGeo[a.geoReference] = id;
        }
        a.status = approved ? Status.VERIFIED : Status.REJECTED;
        if (approved) emit AssetVerified(id, msg.sender);
        else emit AssetRejected(id);
    }
}
