// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import {Script} from "forge-std/Script.sol";
import {UrbanRightToken} from "../src/UrbanRightToken.sol";
import {RevenueVault} from "../src/RevenueVault.sol";
import {FractionVault} from "../src/FractionVault.sol";
import {RentalEscrow} from "../src/RentalEscrow.sol";

/// Additive deployment: existing rights, balances and protocol addresses stay intact.
contract DeployFinance is Script {
    function run() external {
        require(
            block.chainid == 31337 || block.chainid == 11155111 || block.chainid == 2017072401, "Test networks only"
        );
        string memory core = vm.readFile(vm.envString("DEPLOYMENT_FILE"));
        require(vm.parseJsonUint(core, ".chainId") == block.chainid, "Wrong chain");
        address r = vm.parseJsonAddress(core, ".rights");
        address v = vm.parseJsonAddress(core, ".revenue");
        require(r.code.length > 0 && v.code.length > 0, "Core not deployed");
        uint256 start = block.number;
        vm.startBroadcast(vm.envAddress("DEPLOYER_ADDRESS"));
        FractionVault fraction = new FractionVault(UrbanRightToken(r), RevenueVault(v));
        RentalEscrow rental = new RentalEscrow(UrbanRightToken(r));
        vm.stopBroadcast();
        string memory key = "finance";
        vm.serializeUint(key, "chainId", block.chainid);
        vm.serializeUint(key, "startingBlock", start);
        vm.serializeAddress(key, "rights", r);
        vm.serializeAddress(key, "revenue", v);
        vm.serializeAddress(key, "settlement", UrbanRightToken(r).paymentToken());
        vm.serializeAddress(key, "fraction", address(fraction));
        string memory result = vm.serializeAddress(key, "rental", address(rental));
        vm.writeJson(result, string.concat("../deployments/finance-", vm.toString(block.chainid), ".json"));
    }
}
