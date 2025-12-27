import { useMemo } from "react";

const USER_ROLE_KEY = "app-user-role";

export type UserRole = "admin" | "limited";

/**
 * Hook to check user permissions based on the password used to login
 * @returns Object with permission checks
 */
export function useUserPermissions() {
  const userRole = useMemo<UserRole>(() => {
    const role = sessionStorage.getItem(USER_ROLE_KEY);
    return (role === "admin" || role === "limited") ? role : "admin"; // Default to admin for backwards compatibility
  }, []);

  const canDelete = useMemo(() => {
    return userRole === "admin";
  }, [userRole]);

  return {
    userRole,
    canDelete,
    isAdmin: userRole === "admin",
    isLimited: userRole === "limited",
  };
}

