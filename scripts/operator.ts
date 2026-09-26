import "./env";
import { CloudWalletOperator } from "../src/server/operator";
import type { ContractKey } from "../src/lib/config";
async function main() {
  const [contract, method, ...args] = process.argv.slice(2);
  const op = new CloudWalletOperator();
  if (contract === "status") {
    console.log(JSON.stringify(await op.status(method), null, 2));
    return;
  }
  const hash = await op.execute(
    contract as ContractKey,
    method,
    args.map((x) => (x === "true" ? true : x === "false" ? false : x)),
  );
  console.log("Cloud Wallet submitted:", hash);
  console.log("TXM:", JSON.stringify(await op.status(hash)));
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
