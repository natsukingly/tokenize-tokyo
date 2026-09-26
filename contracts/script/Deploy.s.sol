// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import {Script} from "forge-std/Script.sol";
import {UrbanAssetRegistry} from "../src/UrbanAssetRegistry.sol";
import {UrbanRightToken} from "../src/UrbanRightToken.sol";
import {UrbanMarketplace} from "../src/UrbanMarketplace.sol";
import {RevenueVault} from "../src/RevenueVault.sol";
import {BasketVault} from "../src/BasketVault.sol";
import {MockJPY} from "../src/MockJPY.sol";

contract Deploy is Script {
    function run() external {
        address deployer = vm.envAddress("DEPLOYER_ADDRESS");
        address admin = vm.envOr("ADMIN_ADDRESS", deployer);
        uint256 startingBlock = block.number;
        vm.startBroadcast(deployer);
        UrbanAssetRegistry registry = new UrbanAssetRegistry(deployer);
        MockJPY cash = new MockJPY();
        UrbanRightToken rights = new UrbanRightToken(registry, address(cash));
        RevenueVault revenue = new RevenueVault(rights);
        rights.setRevenueVault(address(revenue));
        BasketVault basket = new BasketVault(rights, revenue);
        UrbanMarketplace market = new UrbanMarketplace(rights, basket, address(cash));
        if (admin != deployer) {
            registry.grantRole(registry.DEFAULT_ADMIN_ROLE(), admin);
            registry.grantRole(registry.VERIFIER_ROLE(), admin);
            registry.renounceRole(registry.VERIFIER_ROLE(), deployer);
            registry.renounceRole(registry.DEFAULT_ADMIN_ROLE(), deployer);
        }
        vm.stopBroadcast();
        string memory key = "deployment";
        vm.serializeUint(key, "chainId", block.chainid);
        vm.serializeUint(key, "startingBlock", startingBlock);
        vm.serializeAddress(key, "admin", admin);
        vm.serializeAddress(key, "registry", address(registry));
        vm.serializeAddress(key, "rights", address(rights));
        vm.serializeAddress(key, "market", address(market));
        vm.serializeAddress(key, "revenue", address(revenue));
        vm.serializeAddress(key, "basket", address(basket));
        string memory json = vm.serializeAddress(key, "settlement", address(cash));
        vm.writeJson(json, string.concat("../deployments/", vm.toString(block.chainid), ".json"));
    }
}
