import { IntegrationError } from "@/lib/integrations/errors";
import { getAccessToken, type WclCredentials } from "./auth";

// Thin GraphQL transport for the WCL v2 client endpoint. The only place WCL
// HTTP (beyond the token mint) happens. Surfaces GraphQL errors as
// IntegrationError so callers never see a partial/ambiguous result.

const GQL_URL = "https://www.warcraftlogs.com/api/v2/client";

interface GqlResponse<T> {
  data?: T;
  errors?: Array<{ message: string; path?: (string | number)[] }>;
}

// Minimal transport seam the adapter depends on — lets tests inject a fake
// querier (e.g. to exercise event pagination) without real HTTP.
export interface WclQuerier {
  query<T>(document: string, variables: Record<string, unknown>): Promise<T>;
}

export class WclClient implements WclQuerier {
  constructor(private readonly creds: WclCredentials) {}

  async query<T>(
    document: string,
    variables: Record<string, unknown>,
  ): Promise<T> {
    const token = await getAccessToken(this.creds);

    let res: Response;
    try {
      res = await fetch(GQL_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ query: document, variables }),
      });
    } catch (cause) {
      throw new IntegrationError("warcraftlogs", "GraphQL request failed", cause);
    }

    if (!res.ok) {
      throw new IntegrationError(
        "warcraftlogs",
        `GraphQL request returned ${res.status}`,
      );
    }

    const body = (await res.json()) as GqlResponse<T>;
    if (body.errors?.length) {
      const summary = body.errors
        .map((e) => `${e.path?.join(".") ?? "?"}: ${e.message}`)
        .join("; ");
      throw new IntegrationError("warcraftlogs", `GraphQL errors: ${summary}`);
    }
    if (!body.data) {
      throw new IntegrationError("warcraftlogs", "GraphQL response had no data");
    }
    return body.data;
  }
}
