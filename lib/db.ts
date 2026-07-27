import "server-only";
import { neon } from "@neondatabase/serverless";

type SqlClient = ReturnType<typeof neon>;

let client: SqlClient | undefined;
let clientUrl: string | undefined;

function databaseUrl(): string {
  const url = (process.env.DATABASE_URL ?? process.env.database_url)?.trim();
  if (!url) {
    throw new Error(
      "DATABASE_URL is required. Add the pooled Neon connection string to the server environment."
    );
  }
  return url;
}

/**
 * Shared HTTP query client.
 *
 * The Neon HTTP driver is safe in both Node server components/actions and
 * Edge metadata routes. It does not hold a TCP connection open between
 * requests, so keeping the lightweight query function at module scope is safe.
 */
export function db(): SqlClient {
  const url = databaseUrl();
  if (!client || clientUrl !== url) {
    client = neon(url);
    clientUrl = url;
  }
  return client;
}
