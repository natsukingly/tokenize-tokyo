// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @dev Minimal ABI of official ENSv2 Sepolia revision 71a3b7339dbc55ab47667abdfe8303bac4f4c24e.
interface IENSv2Registry {
    struct State { uint8 status; uint64 expiry; address latestOwner; uint256 tokenId; uint256 resource; }
    function getState(uint256 anyId) external view returns (State memory);
    function getSubregistry(string calldata label) external view returns (address);
    function getParent() external view returns (address parent, string memory label);
    function isEmancipated() external view returns (bool);
    function hasRoles(uint256 anyId, uint256 roles, address account) external view returns (bool);
    function hasAssignees(uint256 anyId, uint256 roles) external view returns (bool);
}
interface IENSv2Factory {
    function verifyContract(address proxy) external view returns (address implementation);
}
interface IUrbanNamespaceAuthority {
    function rightsToken() external view returns (address);
    function assetRegistry() external view returns (address);
    function consume(address operator, uint256 assetId, uint8 scope, bytes32 purpose, uint8 kind,
        uint8 policy, bool exclusive, uint64 start, uint64 end, uint256 supply) external returns (bytes32 bindingId);
}
