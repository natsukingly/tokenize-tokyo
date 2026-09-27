import { encodeFunctionData, parseAbi, type Abi } from "viem";
import type { ContractKey } from "./config";

// Explicit application actions from contracts/src. Administrative deployment
// functions and arbitrary token transfers are deliberately not in this ABI.
const approval = "function setApprovalForAll(address operator,bool approved)";
export const coreWriteAbis: Record<ContractKey, Abi> = {
  registry: parseAbi([
    "function registerAsset(bytes32 geo,string metadata,uint8 kind) returns(uint256)",
    "function updateMetadata(uint256 id,string metadata)",
    "function requestVerification(uint256 id)",
    "function verifyAsset(uint256 id,bool approved)",
  ]),
  settlement: parseAbi([
    "function approve(address spender,uint256 amount) returns(bool)",
    "function mint(address to,uint256 amount)",
  ]),
  rights: parseAbi([
    approval,
    "struct RightRequest { uint256 assetId; uint8 kind; uint256 supply; string terms; bytes32 termsHash; uint64 start; uint64 end; uint8 policy; uint8 scope; bytes32 purpose; bool exclusive; }",
    "function createScopedRight(RightRequest request) returns(uint256)",
    "function createRight(uint256 assetId,uint8 kind,uint256 supply,string terms,bytes32 termsHash,uint64 start,uint64 end,uint8 policy) returns(uint256)",
    "function verifyRight(uint256 id,bool approved)",
    "function activateRight(uint256 id)",
    "function closeRight(uint256 id)",
  ]),
  market: parseAbi([
    "function createListing(address token,uint256 id,uint256 amount,uint256 price) returns(uint256)",
    "function purchase(uint256 id,uint256 amount)",
    "function cancelListing(uint256 id)",
  ]),
  revenue: parseAbi([
    "function depositRevenue(uint256 id,uint256 amount)",
    "function claim(uint256 id) returns(uint256)",
  ]),
  basket: parseAbi([
    approval,
    "function createBasket(uint256[] ids,uint256[] units,string metadata) returns(uint256)",
    "function depositUnderlying(uint256 id,uint256 shares)",
    "function mintBasketShares(uint256 id,uint256 shares)",
    "function redeem(uint256 id,uint256 shares)",
    "function claimRevenue(uint256 id) returns(uint256)",
  ]),
};

export function encodeCoreWrite(
  contract: ContractKey,
  method: string,
  args: unknown[],
) {
  return encodeFunctionData({
    abi: coreWriteAbis[contract],
    functionName: method,
    args,
  });
}
