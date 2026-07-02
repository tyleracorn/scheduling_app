import { useAuth } from "../context/AuthContext";

export function useIsCoordinator(): boolean {
  const { user } = useAuth();
  return !!(user?.isCoordinator || user?.isAdmin);
}
