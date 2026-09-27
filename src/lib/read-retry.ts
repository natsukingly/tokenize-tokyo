function providerError(error: unknown) {
  return error as {
    response?: { status?: number; data?: { message?: string } };
    code?: string;
  };
}

function isPlanLimit(error: unknown) {
  const response = providerError(error)?.response;
  return (
    response?.status === 429 &&
    /exceeds the plan[’']s rate limit/i.test(response.data?.message || "")
  );
}

/** Retry idempotent reads only; never wrap transaction composition/submission. */
export async function retryRead<T>(read: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await read();
    } catch (error) {
      const e = providerError(error);
      const status = e?.response?.status;
      const transient =
        status === 429 ||
        (status !== undefined && status >= 500) ||
        ["ECONNABORTED", "ETIMEDOUT", "ERR_NETWORK"].includes(e?.code || "");
      // A plan quota cannot be restored by retrying a few seconds later.
      if (!transient || isPlanLimit(error) || attempt >= 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
    }
  }
}

export function marketReadError(error: unknown) {
  const status = providerError(error)?.response?.status;
  if (isPlanLimit(error))
    return "The data provider's usage limit has been reached. Please contact the project team. Previously loaded data is kept.";
  if (status === 429)
    return "The data provider is rate limiting requests. Please wait a moment and retry. Previously loaded data is kept.";
  if (status === 401 || status === 403)
    return "The data provider denied access. Please retry or contact the project team.";
  return "Market data is temporarily unavailable. Please retry. Previously loaded data is kept until an update succeeds.";
}
