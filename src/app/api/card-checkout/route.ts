import { cardRequest } from "@/lib/card-checkout";
import { cardSettings } from "@/server/card-settings";
import {
  boundedText,
  browserCookie,
  browserToken,
  cardDependencies,
  cardReply,
  ownerHash,
} from "@/server/card-http";
export const runtime = "nodejs";

export async function GET(request: Request) {
  let available = false;
  try {
    cardSettings();
    available = true;
  } catch {
    /* Not enabled until all private settings exist. */
  }
  return cardReply({ available, testMode: true }, 200, {
    "Set-Cookie": browserCookie(request),
  });
}
export async function POST(request: Request) {
  let deps;
  try {
    deps = cardDependencies();
  } catch {
    return cardReply(
      {
        error:
          "Card test checkout is not available yet. You can use wallet payment.",
      },
      503,
    );
  }
  const token = browserToken(request);
  if (!token || request.headers.get("origin") !== deps.settings.origin)
    return cardReply({ error: "Reload checkout on this website." }, 403);
  let input;
  try {
    if (!request.headers.get("content-type")?.includes("application/json"))
      throw new Error();
    input = cardRequest.parse(JSON.parse(await boundedText(request, 4096)));
  } catch {
    return cardReply(
      { error: "Review the quantity, recipient, price and terms." },
      400,
    );
  }
  try {
    const owner = ownerHash(token);
    const minute = Math.floor(Date.now() / 60000);
    if (
      !(await deps.store.rateLimit(`create:${owner}:${minute}`, 5)) ||
      !(await deps.store.rateLimit(`global:${minute}`, 30))
    )
      return cardReply(
        { error: "Too many checkout requests. Please wait a minute." },
        429,
      );
    return cardReply(await deps.service.create(input, owner));
  } catch {
    return cardReply(
      {
        error:
          "Unable to open checkout. The listing or payment service may be unavailable. Refresh and try again.",
      },
      503,
    );
  }
}
