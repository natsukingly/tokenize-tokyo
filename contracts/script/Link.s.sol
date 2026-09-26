// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import {Script} from "forge-std/Script.sol";
import {MultiBaas} from "forge-multibaas/MultiBaas.sol";

/// Run after broadcast. FFI linking never happens during a deployment simulation.
contract Link is Script {
    function run() external {
        string memory json = vm.readFile(vm.envString("DEPLOYMENT_FILE"));
        require(vm.parseJsonUint(json, ".chainId") == block.chainid, "Wrong chain");
        string memory start = vm.toString(vm.parseJsonUint(json, ".startingBlock"));
        link(json, "UrbanAssetRegistry", "registry", "urbanassetregistry", start);
        link(json, "UrbanRightToken", "rights", "urbanrighttoken", start);
        link(json, "UrbanMarketplace", "market", "urbanmarketplace", start);
        link(json, "RevenueVault", "revenue", "revenuevault", start);
        link(json, "BasketVault", "basket", "basketvault", start);
        link(json, "MockJPY", "settlement", "mockjpy", start);
    }

    function link(string memory json, string memory name, string memory key, string memory label, string memory start)
        internal
    {
        address deployed = vm.parseJsonAddress(json, string.concat(".", key));
        require(deployed.code.length > 0, "Contract not deployed");
        MultiBaas.linkContractWithOptions(name, deployed, MultiBaas.withOptions(label, label, "1.0", start));
    }
}
