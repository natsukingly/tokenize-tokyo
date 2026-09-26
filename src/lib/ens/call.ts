import type { Abi, AbiParameter } from "viem";
// MultiBaas uses positional tuple arguments. Keep the original ABI-encoded calldata
// as the independent check before signing the transaction returned by its API.
export function positionalArguments(
  abi: Abi,
  method: string,
  args: unknown[],
): unknown[] {
  const fn = abi.find(
    (item) => item.type === "function" && item.name === method,
  );
  if (!fn || fn.type !== "function" || fn.inputs.length !== args.length)
    throw new Error("Invalid ENS call");
  function convert(input: AbiParameter, value: unknown): unknown {
    if (input.type === "tuple" && "components" in input) {
      return input.components.map((part, index) =>
        convert(
          part,
          Array.isArray(value)
            ? value[index]
            : (value as Record<string, unknown>)[part.name || ""],
        ),
      );
    }
    return typeof value === "bigint" ? value.toString() : value;
  }
  return fn.inputs.map((input, index) => convert(input, args[index]));
}
