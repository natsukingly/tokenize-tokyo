import { FieldType, type EventQuery } from "@curvegrid/multibaas-sdk";
import { queryRows } from "../multibaas";
import type { LiveEnsBinding } from "./authority";
import { config } from "../config";
import { indexBootstrap } from "../index-bootstrap";
// Indexing supports the audit trail; the authority contract still decides permission atomically.
export async function loadEnsAudit(live: LiveEnsBinding) {
  const initial = indexBootstrap(config.chainId, config.addresses);
  const names = [
    "SpaceNamespaceBound",
    "IssuanceDelegated",
    "IssuanceRevoked",
    "IssuanceConsumed",
  ];
  const results = await Promise.all(
    names.map(async (eventName) => {
      const query: EventQuery = {
        events: [
          {
            eventName,
            filter: {
              rule: "and",
              children: [
                {
                  fieldType: FieldType.ContractAddress,
                  operator: "equal",
                  value: live.setting.authority,
                },
                {
                  fieldType: FieldType.Input,
                  inputIndex: 0,
                  operator: "equal",
                  value: live.id,
                },
              ],
            },
            select: [
              { type: FieldType.TxHash, alias: "hash" },
              { type: FieldType.BlockNumber, alias: "block" },
            ],
          },
        ],
        orderBy: "block",
        order: "DESC",
      };
      return (await queryRows(query)).map((row) => ({
        eventName,
        hash: String(row.hash),
        block: Number(row.block),
      }));
    }),
  );
  const archived =
    initial?.addresses.authority.toLowerCase() ===
    live.setting.authority.toLowerCase()
      ? initial.audit
          .filter((e) => e.id.toLowerCase() === live.id.toLowerCase())
          .map((e) => ({ eventName: e.name, hash: e.hash, block: e.block }))
      : [];
  return [
    ...archived,
    ...results.flat().filter((e) => !initial || e.block > initial.toBlock),
  ]
    .filter((r) => /^0x[0-9a-f]{64}$/i.test(r.hash))
    .sort((a, b) => b.block - a.block)
    .slice(0, 8);
}
