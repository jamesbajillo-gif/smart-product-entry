// Authentication utility functions

const AUTH_KEY = "app-authenticated";
const USER_ROLE_KEY = "app-user-role";
const OPERATOR_KEY = "app-operator";

/**
 * Logout the current user by clearing all session data
 * This will trigger the PasswordProtection component to show the login dialog
 */
export function logout(): void {
  if (typeof window === "undefined") return;
  
  // Clear all authentication-related session storage
  sessionStorage.removeItem(AUTH_KEY);
  sessionStorage.removeItem(USER_ROLE_KEY);
  sessionStorage.removeItem(OPERATOR_KEY);
  
  // Reload the page to trigger re-authentication
  window.location.reload();
}

/**
 * Check if user is currently authenticated
 */
export function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(AUTH_KEY) === "true";
}

/**
 * Get current user role
 */
export function getUserRole(): "admin" | "limited" | null {
  if (typeof window === "undefined") return null;
  const role = sessionStorage.getItem(USER_ROLE_KEY);
  return role === "admin" || role === "limited" ? role : null;
}

/**
 * Get current operator name
 */
export function getOperator(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(OPERATOR_KEY);
}

