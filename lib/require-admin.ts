import "server-only";
import { requireAdmin as requireRegisteredAdmin } from "./auth-guards";

export interface AdminActor {
  id: string;
  /** Pseudonymous label safe for the permanent public audit ledger. */
  label: string;
  /** Request-local label for the private Committee Room only. */
  displayLabel: string;
  email: string;
}

/**
 * Middleware protects the visible routes; every write action calls this again
 * so possession of a Server Action identifier cannot bypass authorization.
 */
export async function requireAdmin(): Promise<AdminActor> {
  const user = await requireRegisteredAdmin();
  return {
    id: user.id,
    email: user.email,
    label: `Registered administrator ${user.id}`,
    displayLabel: `${user.name} (${user.email})`,
  };
}
