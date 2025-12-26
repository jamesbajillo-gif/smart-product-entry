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
import { useToast } from "@/hooks/use-toast";

const STATIC_PASSWORD = "kainkatae";
const AUTH_KEY = "app-authenticated";

interface PasswordProtectionProps {
  children: React.ReactNode;
}

export const PasswordProtection = ({ children }: PasswordProtectionProps) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
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

    if (password === STATIC_PASSWORD) {
      sessionStorage.setItem(AUTH_KEY, "true");
      setIsAuthenticated(true);
      toast({
        title: "Access granted",
        description: "Welcome to the application.",
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
            <Input
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError("");
              }}
              autoFocus
              className={error ? "border-red-500" : ""}
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
          <Button type="submit" className="w-full">
            Enter
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

