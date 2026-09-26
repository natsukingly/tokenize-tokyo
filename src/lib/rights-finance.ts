import {
  encodeFunctionData,
  isAddress,
  parseAbi,
  parseUnits,
  type Abi,
  type Hex,
} from "viem";
import { FieldType } from "@curvegrid/multibaas-sdk";
import { clients, queryRows, sendAtMultiBaas } from "./multibaas";
import { config } from "./config";
import type { Right } from "./model";
import type { WalletProvider } from "./transactions";
import type { TransactionProgress } from "./wallet";

export type FinanceAddresses = { fraction: string; rental: string };
export const financeAddresses: FinanceAddresses = {
  fraction: process.env.NEXT_PUBLIC_FRACTION_ADDRESS || "",
  rental: process.env.NEXT_PUBLIC_RENTAL_ADDRESS || "",
};
const labels = {
  fraction: "fractionvault",
  rental: "rentalescrow",
  rights: "urbanrighttoken",
  settlement: "mockjpy",
};
export const fractionAbi = parseAbi([
  "function createPool(uint256 rightId,uint256 units,uint256 sharesPerUnit) returns(uint256)",
  "function deposit(uint256 id,uint256 units)",
  "function redeem(uint256 id,uint256 shares)",
  "function claimRevenue(uint256 id) returns(uint256)",
  "function createListing(uint256 id,uint256 shares,uint256 unitPrice) returns(uint256)",
  "function purchase(uint256 listingId,uint256 shares)",
  "function cancelListing(uint256 id)",
]);
export const rentalAbi = parseAbi([
  "function createOffer(uint256 rightId,uint256 pricePerDay,uint256 maxDays) returns(uint256)",
  "function rent(uint256 id,uint256 daysCount)",
  "function returnRental(uint256 id)",
  "function withdraw(uint256 id)",
]);
const approvalAbis = {
  rights: parseAbi([
    "function setApprovalForAll(address operator,bool approved)",
  ]),
  settlement: parseAbi([
    "function approve(address spender,uint256 amount) returns(bool)",
  ]),
};
export type FinanceIntent = {
  address: string;
  label: string;
  method: string;
  args: unknown[];
  data: Hex;
};
export function positiveUnits(value: string, max = 1000000000000n): bigint {
  if (!/^[0-9]+$/.test(value) || BigInt(value) === 0n || BigInt(value) > max)
    throw new Error(`Enter a whole quantity between 1 and ${max}.`);
  return BigInt(value);
}
export function payment(value: string): bigint {
  if (!/^\d+(\.\d{1,18})?$/.test(value))
    throw new Error("Enter a positive mJPY amount with at most 18 decimals.");
  const result = parseUnits(value, 18);
  if (result <= 0n || result > 10n ** 30n)
    throw new Error("Payment amount is outside the supported range.");
  return result;
}
export function financeEligibility(
  right: Right,
  mode: "fraction" | "rental",
  now = Date.now() / 1000,
) {
  return (
    right.policy === "Open" &&
    ["Verified", "Active"].includes(right.status) &&
    right.endAt > now &&
    (mode === "fraction"
      ? right.kind === "Revenue Share"
      : right.kind === "Usage Right" && right.exclusive)
  );
}
const valid = (address: string) =>
  isAddress(address) && !/^0x0{40}$/i.test(address);
export function financeConfigured(addresses = financeAddresses) {
  return valid(addresses.fraction) && valid(addresses.rental);
}
export function financeIntent(
  contract: keyof typeof labels,
  method: string,
  args: readonly unknown[],
  addresses = financeAddresses,
): FinanceIntent {
  const address =
    contract === "fraction" || contract === "rental"
      ? addresses[contract]
      : config.addresses[contract];
  if (!valid(address))
    throw new Error("Finance contracts are not configured on this network.");
  const abi: Abi =
    contract === "fraction"
      ? fractionAbi
      : contract === "rental"
        ? rentalAbi
        : approvalAbis[contract];
  const data = encodeFunctionData({ abi, functionName: method, args });
  return {
    address,
    label: labels[contract],
    method,
    args: args.map((v) => (typeof v === "bigint" ? v.toString() : v)),
    data,
  };
}
export function sendFinanceIntent(
  provider: WalletProvider,
  from: string,
  intent: FinanceIntent,
  progress?: (value: TransactionProgress) => void,
) {
  return sendAtMultiBaas(
    provider,
    from,
    intent.address,
    intent.label,
    intent.method,
    intent.args,
    progress,
    intent.data,
  );
}
async function read(
  contract: "fraction" | "rental",
  method: string,
  args: unknown[] = [],
  addresses = financeAddresses,
) {
  const { data } = await clients().contracts.callContractFunction(
    addresses[contract],
    labels[contract],
    method,
    { args, formatInts: "as_strings" },
  );
  if (data.result.kind !== "MethodCallResponse" || !("output" in data.result))
    throw new Error("Unexpected finance contract response.");
  return data.result.output as unknown;
}
export function tuple(
  value: unknown,
  fields: string[],
): Record<string, unknown> {
  if (!value || typeof value !== "object")
    throw new Error("Invalid contract tuple.");
  const result = Object.fromEntries(
    fields.map((f, i) => [
      f,
      Array.isArray(value) ? value[i] : (value as Record<string, unknown>)[f],
    ]),
  );
  if (Object.values(result).some((v) => v === undefined))
    throw new Error("Incomplete contract tuple.");
  return result;
}
export async function validateFinanceDeployment(addresses = financeAddresses) {
  if (!financeConfigured(addresses))
    throw new Error("Finance contracts are not configured on this network.");
  for (const contract of ["fraction", "rental"] as const) {
    for (const method of ["rights", "paymentToken"] as const) {
      const result = String(await read(contract, method, [], addresses));
      const expected =
        method === "rights"
          ? config.addresses.rights
          : config.addresses.settlement;
      if (result.toLowerCase() !== expected.toLowerCase())
        throw new Error("Finance contract belongs to a different protocol.");
    }
  }
  if (
    String(await read("fraction", "revenue", [], addresses)).toLowerCase() !==
    config.addresses.revenue.toLowerCase()
  )
    throw new Error(
      "Finance contract belongs to a different protocol revenue vault.",
    );
}
export type FractionPool = {
  id: string;
  rightId: string;
  sharesPerUnit: string;
  underlyingUnits: string;
  balance: string;
  claimable: string;
};
export type FractionListing = {
  id: string;
  poolId: string;
  seller: string;
  remaining: string;
  unitPrice: string;
  cancelled: boolean;
};
export type RentalOffer = {
  id: string;
  rightId: string;
  lender: string;
  pricePerDay: string;
  maxDays: string;
  renter: string;
  endsAt: number;
  withdrawn: boolean;
  user: string;
  available: boolean;
  withdrawable: boolean;
};
export type FinanceState = {
  pools: FractionPool[];
  listings: FractionListing[];
  rentals: RentalOffer[];
};
const truth = (value: unknown) => value === true || value === "true";
async function enumerate<T>(
  contract: "fraction" | "rental",
  counter: string,
  load: (id: string) => Promise<T>,
  addresses: FinanceAddresses,
): Promise<T[]> {
  const count =
    BigInt(String(await read(contract, counter, [], addresses))) - 1n;
  if (count < 0n || count > 200n)
    throw new Error(
      "Finance catalog exceeds the 200-entry view limit; narrow the deployment before continuing.",
    );
  const results: T[] = [];
  for (let start = 1; start <= Number(count); start += 4)
    results.push(
      ...(await Promise.all(
        Array.from({ length: Math.min(4, Number(count) - start + 1) }, (_, i) =>
          load(String(start + i)),
        ),
      )),
    );
  return results;
}
export async function loadFinance(
  account?: string,
  addresses = financeAddresses,
): Promise<FinanceState> {
  await validateFinanceDeployment(addresses);
  const pools = await enumerate(
    "fraction",
    "nextPoolId",
    async (id) => {
      const p = tuple(await read("fraction", "getPool", [id], addresses), [
        "rightId",
        "sharesPerUnit",
        "underlyingUnits",
      ]);
      const balance = account
        ? String(await read("fraction", "balanceOf", [account, id], addresses))
        : "0";
      const claimable = account
        ? String(await read("fraction", "claimable", [id, account], addresses))
        : "0";
      return {
        id,
        rightId: String(p.rightId),
        sharesPerUnit: String(p.sharesPerUnit),
        underlyingUnits: String(p.underlyingUnits),
        balance,
        claimable,
      };
    },
    addresses,
  );
  const listings = await enumerate(
    "fraction",
    "nextListingId",
    async (id) => {
      const l = tuple(await read("fraction", "getListing", [id], addresses), [
        "poolId",
        "seller",
        "remaining",
        "unitPrice",
        "cancelled",
      ]);
      return {
        id,
        poolId: String(l.poolId),
        seller: String(l.seller),
        remaining: String(l.remaining),
        unitPrice: String(l.unitPrice),
        cancelled: truth(l.cancelled),
      };
    },
    addresses,
  );
  const rentals = await enumerate(
    "rental",
    "nextOfferId",
    async (id) => {
      const o = tuple(await read("rental", "getOffer", [id], addresses), [
        "rightId",
        "lender",
        "pricePerDay",
        "maxDays",
        "renter",
        "endsAt",
        "withdrawn",
      ]);
      const [user, available, withdrawable] = await Promise.all(
        ["userOf", "available", "withdrawable"].map((method) =>
          read("rental", method, [id], addresses),
        ),
      );
      return {
        id,
        rightId: String(o.rightId),
        lender: String(o.lender),
        pricePerDay: String(o.pricePerDay),
        maxDays: String(o.maxDays),
        renter: String(o.renter),
        endsAt: Number(o.endsAt),
        withdrawn: truth(o.withdrawn),
        user: String(user),
        available: truth(available),
        withdrawable: truth(withdrawable),
      };
    },
    addresses,
  );
  return { pools, listings, rentals };
}
export type FinanceActivity = { name: string; hash: string; block: number };
export async function loadFinanceActivity(
  addresses = financeAddresses,
): Promise<FinanceActivity[]> {
  if (!financeConfigured(addresses)) return [];
  const items: FinanceActivity[] = [];
  for (const [contract, names] of [
    [
      "fraction",
      [
        "FractionPoolCreated",
        "FractionDeposited",
        "FractionRedeemed",
        "FractionRevenueClaimed",
        "FractionListed",
        "FractionPurchased",
        "FractionListingCancelled",
      ],
    ],
    [
      "rental",
      ["RentalOffered", "RentalStarted", "RentalReturned", "RentalWithdrawn"],
    ],
  ] as const) {
    for (const name of names) {
      const rows = await queryRows({
        events: [
          {
            eventName: name,
            filter: {
              fieldType: FieldType.ContractAddress,
              operator: "equal",
              value: addresses[contract],
            },
            select: [
              { type: FieldType.TxHash, alias: "hash" },
              { type: FieldType.BlockNumber, alias: "block" },
            ],
          },
        ],
        orderBy: "block",
        order: "DESC",
      });
      for (const row of rows)
        if (/^0x[0-9a-f]{64}$/i.test(String(row.hash)))
          items.push({
            name,
            hash: String(row.hash),
            block: Number(row.block),
          });
    }
  }
  return items.sort((a, b) => b.block - a.block).slice(0, 20);
}
