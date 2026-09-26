export function walletTransaction(
  tx: { from: string; to?: string | null; value: string; data: string },
  from: string,
  to: string,
) {
  if (
    !/^0x[0-9a-f]{40}$/i.test(tx.to || "") ||
    tx.to?.toLowerCase() !== to.toLowerCase() ||
    tx.from.toLowerCase() !== from.toLowerCase()
  )
    throw new Error("MultiBaas transaction sender/recipient mismatch");
  if (BigInt(tx.value) !== 0n || !/^0x([0-9a-f]{2})+$/i.test(tx.data))
    throw new Error("Unexpected transaction value or data");
  return { from, to: tx.to, value: "0x0", data: tx.data };
}
export interface WalletProvider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(name: string, cb: (...args: unknown[]) => void): void;
  removeListener?(name: string, cb: (...args: unknown[]) => void): void;
}
export interface OperatorSigner {
  execute(contract: string, method: string, args: unknown[]): Promise<string>;
}
