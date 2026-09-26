// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import {Script} from "forge-std/Script.sol";
import {UrbanMarketplace} from "../src/UrbanMarketplace.sol";
import {CardPurchaseExecutor} from "../src/CardPurchaseExecutor.sol";

contract DeployCardCheckout is Script {
    function run() external {
        string memory core = vm.readFile(vm.envString("DEPLOYMENT_FILE"));
        require(vm.parseJsonUint(core, ".chainId") == block.chainid, "Wrong chain");
        address market = vm.parseJsonAddress(core, ".market");
        address operator = vm.envAddress("MULTIBAAS_OPERATOR_ADDRESS");
        uint256 start = block.number;
        vm.startBroadcast(vm.envAddress("DEPLOYER_ADDRESS"));
        CardPurchaseExecutor executor = new CardPurchaseExecutor(UrbanMarketplace(market), operator);
        vm.stopBroadcast();
        string memory key = "card-checkout";
        vm.serializeUint(key, "chainId", block.chainid);
        vm.serializeUint(key, "startingBlock", start);
        vm.serializeAddress(key, "market", market);
        vm.serializeAddress(key, "operator", operator);
        string memory result = vm.serializeAddress(key, "executor", address(executor));
        vm.writeJson(result, string.concat("../deployments/card-checkout-", vm.toString(block.chainid), ".json"));
    }
}
