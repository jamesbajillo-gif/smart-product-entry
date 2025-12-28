import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const ADMIN_PASSWORD = "kainkatae";
const LIMITED_PASSWORD = "mytch";
const AUTH_KEY = "app-authenticated";
const USER_ROLE_KEY = "app-user-role";
const OPERATOR_KEY = "app-operator";

export type UserRole = "admin" | "limited";

// List of operators
const OPERATORS = [
  "mytch",
  "moi",
  "keysia",
  "shems",
  "sheena",
];

interface PasswordProtectionProps {
  children: React.ReactNode;
}

export const PasswordProtection = ({ children }: PasswordProtectionProps) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [operator, setOperator] = useState("");
  const [error, setError] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    // Check if already authenticated in this session
    const authStatus = sessionStorage.getItem(AUTH_KEY);
    if (authStatus === "true") {
      setIsAuthenticated(true);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validate operator selection
    if (!operator) {
      setError("Please select an operator.");
      toast({
        title: "Operator Required",
        description: "Please select an operator before entering password.",
        variant: "destructive",
      });
      return;
    }

    if (password === ADMIN_PASSWORD) {
      sessionStorage.setItem(AUTH_KEY, "true");
      sessionStorage.setItem(USER_ROLE_KEY, "admin");
      sessionStorage.setItem(OPERATOR_KEY, operator);
      setIsAuthenticated(true);
      toast({
        title: "Access granted",
        description: `Welcome ${operator} (Admin access).`,
      });
    } else if (password === LIMITED_PASSWORD) {
      sessionStorage.setItem(AUTH_KEY, "true");
      sessionStorage.setItem(USER_ROLE_KEY, "limited");
      sessionStorage.setItem(OPERATOR_KEY, operator);
      setIsAuthenticated(true);
      toast({
        title: "Access granted",
        description: `Welcome ${operator} (Limited access - deletion disabled).`,
      });
    } else {
      setError("Incorrect password. Please try again.");
      setPassword("");
      toast({
        title: "Access denied",
        description: "Incorrect password.",
        variant: "destructive",
      });
    }
  };

  if (isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <Dialog open={true} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Password Required</DialogTitle>
          <DialogDescription>Please enter the password to access the application.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              Operator
            </label>
            <Select value={operator} onValueChange={setOperator}>
              <SelectTrigger className={error && !operator ? "border-red-500" : ""}>
                <SelectValue placeholder="Select operator" />
              </SelectTrigger>
              <SelectContent>
                {OPERATORS.map((op) => (
                  <SelectItem key={op} value={op}>
                    {op}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              Password
            </label>
            <Input
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError("");
              }}
              autoFocus={!!operator}
              className={error ? "border-red-500" : ""}
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
          <Button type="submit" className="w-full" disabled={!operator}>
            Enter
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

