import { useEffect } from "react";
import { X, Banknote } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ChangeDialogProps {
  change: number;
  onClose: () => void;
}

export function ChangeDialog({ change, onClose }: ChangeDialogProps) {
  // Auto-close on Enter or Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="window-border bg-card w-full max-w-md flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-2xl font-bold">Customer Change</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-8 h-8" />
          </Button>
        </div>

        <div className="p-8 flex flex-col items-center justify-center space-y-6">
          <div className="p-6 bg-warning/20 border-2 border-warning/50">
            <Banknote className="w-16 h-16 mx-auto mb-4 text-black" />
            <div className="text-center">
              <p className="text-lg font-medium mb-2">Change Due:</p>
              <p className="text-4xl font-bold font-mono">₱{change.toFixed(2)}</p>
            </div>
          </div>

          <Button 
            className="w-full text-xl py-6" 
            onClick={onClose}
            autoFocus
          >
            OK
          </Button>
        </div>
      </div>
    </div>
  );
}

