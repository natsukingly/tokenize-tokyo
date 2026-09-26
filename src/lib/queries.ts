import {
  FieldType,
  type EventQuery,
  type EventQueryFilter,
} from "@curvegrid/multibaas-sdk";
import type { ContractKey } from "./config";
export const events: Record<
  string,
  { contract: ContractKey; signature: string; fields: string[] }
> = {
  AssetRegistered: {
    contract: "registry",
    signature: "AssetRegistered(uint256,address,bytes32,string,uint8)",
    fields: ["assetId", "issuer", "geoReference", "metadataURI", "assetType"],
  },
  AssetVerificationRequested: {
    contract: "registry",
    signature: "AssetVerificationRequested(uint256)",
    fields: ["assetId"],
  },
  AssetVerified: {
    contract: "registry",
    signature: "AssetVerified(uint256,address)",
    fields: ["assetId", "verifier"],
  },
  AssetRejected: {
    contract: "registry",
    signature: "AssetRejected(uint256)",
    fields: ["assetId"],
  },
  AssetUpdated: {
    contract: "registry",
    signature: "AssetUpdated(uint256,string)",
    fields: ["assetId", "metadataURI"],
  },
  RightCreated: {
    contract: "rights",
    signature:
      "RightCreated(uint256,uint256,address,uint8,uint256,string,bytes32,uint64,uint64,uint8)",
    fields: [
      "rightId",
      "assetId",
      "issuer",
      "rightType",
      "supply",
      "termsURI",
      "termsHash",
      "startAt",
      "endAt",
      "transferPolicy",
    ],
  },
  RightScopeDefined: {
    contract: "rights",
    signature: "RightScopeDefined(uint256,uint256,uint8,bytes32,bool)",
    fields: ["rightId", "assetId", "scope", "purpose", "exclusive"],
  },
  RightVerified: {
    contract: "rights",
    signature: "RightVerified(uint256,bool)",
    fields: ["rightId", "approved"],
  },
  RightActivated: {
    contract: "rights",
    signature: "RightActivated(uint256,uint256)",
    fields: ["rightId", "assetId"],
  },
  RightClosed: {
    contract: "rights",
    signature: "RightClosed(uint256)",
    fields: ["rightId"],
  },
  ListingCreated: {
    contract: "market",
    signature:
      "ListingCreated(uint256,address,address,uint256,uint256,uint256)",
    fields: ["listingId", "seller", "token", "rightId", "amount", "unitPrice"],
  },
  ListingPurchased: {
    contract: "market",
    signature:
      "ListingPurchased(uint256,address,address,address,uint256,uint256,uint256)",
    fields: [
      "listingId",
      "buyer",
      "seller",
      "token",
      "rightId",
      "amount",
      "totalPrice",
    ],
  },
  ListingCancelled: {
    contract: "market",
    signature: "ListingCancelled(uint256,address)",
    fields: ["listingId", "seller"],
  },
  RevenueDeposited: {
    contract: "revenue",
    signature: "RevenueDeposited(uint256,address,uint256)",
    fields: ["rightId", "operator", "amount"],
  },
  RevenueClaimed: {
    contract: "revenue",
    signature: "RevenueClaimed(uint256,address,uint256)",
    fields: ["rightId", "holder", "amount"],
  },
  BasketCreated: {
    contract: "basket",
    signature: "BasketCreated(uint256,address,uint256[],uint256[],string)",
    fields: ["basketId", "creator", "rightIds", "unitsPerShare", "metadataURI"],
  },
  UnderlyingDeposited: {
    contract: "basket",
    signature: "UnderlyingDeposited(uint256,address,uint256,uint256)",
    fields: ["basketId", "holder", "rightId", "amount"],
  },
  BasketMinted: {
    contract: "basket",
    signature: "BasketMinted(uint256,address,uint256)",
    fields: ["basketId", "holder", "shares"],
  },
  BasketRedeemed: {
    contract: "basket",
    signature: "BasketRedeemed(uint256,address,uint256)",
    fields: ["basketId", "holder", "shares"],
  },
  BasketRevenueClaimed: {
    contract: "basket",
    signature: "BasketRevenueClaimed(uint256,address,uint256)",
    fields: ["basketId", "holder", "amount"],
  },
  TransferSingle: {
    contract: "rights",
    signature: "TransferSingle(address,address,address,uint256,uint256)",
    fields: ["operator", "from", "to", "id", "value"],
  },
  TransferBatch: {
    contract: "rights",
    signature: "TransferBatch(address,address,address,uint256[],uint256[])",
    fields: ["operator", "from", "to", "ids", "values"],
  },
  BasketTransferSingle: {
    contract: "basket",
    signature: "TransferSingle(address,address,address,uint256,uint256)",
    fields: ["operator", "from", "to", "id", "value"],
  },
  BasketTransferBatch: {
    contract: "basket",
    signature: "TransferBatch(address,address,address,uint256[],uint256[])",
    fields: ["operator", "from", "to", "ids", "values"],
  },
};
export function eventQuery(
  name: string,
  address: string,
  aggregation?: { field: string; op: "add" },
  extra?: EventQueryFilter,
): EventQuery {
  const spec = events[name];
  if (!spec || !/^0x[0-9a-f]{40}$/i.test(address))
    throw new Error("Unknown event or missing contract address");
  const addressFilter: EventQueryFilter = {
    fieldType: FieldType.ContractAddress,
    operator: "equal",
    value: address,
  };
  return {
    events: [
      {
        eventName: spec.signature.split("(")[0],
        filter: extra
          ? { rule: "and", children: [addressFilter, extra] }
          : addressFilter,
        select: aggregation
          ? [
              {
                type: FieldType.Input,
                name: aggregation.field,
                alias: "value",
                aggregator: aggregation.op,
              },
            ]
          : [
              ...spec.fields.map((name) => ({
                type: FieldType.Input,
                name,
                alias: name,
              })),
              { type: FieldType.BlockNumber, alias: "block" },
              { type: FieldType.TxHash, alias: "txHash" },
              { type: FieldType.TriggeredAt, alias: "timestamp" },
            ],
      },
    ],
    ...(!aggregation ? { orderBy: "block", order: "ASC" } : {}),
  };
}
