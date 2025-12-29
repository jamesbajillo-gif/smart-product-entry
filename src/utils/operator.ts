// Operator utility functions
const OPERATOR_KEY = "app-operator";

/**
 * Get the current logged-in operator name from sessionStorage
 * @returns The operator name or "Unknown" if not set
 */
export function getCurrentOperator(): string {
  if (typeof window === "undefined") return "Unknown";
  return sessionStorage.getItem(OPERATOR_KEY) || "Unknown";
}

/**
 * Set the current operator (used during login)
 * @param operatorName The name of the operator
 */
export function setCurrentOperator(operatorName: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(OPERATOR_KEY, operatorName);
}

/**
 * Check if an operator is logged in
 * @returns true if operator is set, false otherwise
 */
export function hasOperator(): boolean {
  if (typeof window === "undefined") return false;
  const operator = sessionStorage.getItem(OPERATOR_KEY);
  return operator !== null && operator !== "";
}

