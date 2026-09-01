import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";

/**
 * Admin-Berechtigung (Audit P1-5): globaler Admin (users.role = "admin")
 * ODER Rolle owner/admin in der aktuell aktiven Organisation.
 */
export function useIsAdmin() {
  const { user, loading } = useAuth();
  const { data: myOrgs, isLoading: orgsLoading } = trpc.organizations.listMine.useQuery(
    undefined,
    { enabled: !!user },
  );
  const currentOrgRole = myOrgs?.find(o => o.isCurrent)?.role;
  const isAdmin =
    user?.role === "admin" || currentOrgRole === "owner" || currentOrgRole === "admin";
  return { isAdmin, loading: loading || (!!user && orgsLoading), user };
}
