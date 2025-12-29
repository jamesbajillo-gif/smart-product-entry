import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Settings as SettingsIcon, Trash2, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ResetFinancialDataDialog } from "@/components/ResetFinancialDataDialog";
import { useToast } from "@/hooks/use-toast";
import { useMySQLSync } from "@/hooks/useMySQLSync";
import { useStoreFunds } from "@/hooks/useStoreFunds";

export default function Settings() {
  const [showResetDialog, setShowResetDialog] = useState(false);
  const { toast } = useToast();
  const { refreshProducts } = useMySQLSync();
  const { refresh: refreshStoreFunds } = useStoreFunds();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 p-4 md:p-8">
      <div className="w-full max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link to="/">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/20 rounded-lg">
              <SettingsIcon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Settings</h1>
              <p className="text-sm text-muted-foreground">Manage system settings and data</p>
            </div>
          </div>
        </div>

        {/* Settings Tabs */}
        <Tabs defaultValue="data" className="w-full">
          <TabsList className="grid w-full grid-cols-1 mb-6">
            <TabsTrigger value="data" className="gap-2">
              <AlertTriangle className="w-4 h-4" />
              Data Management
            </TabsTrigger>
          </TabsList>

          {/* Data Management Tab */}
          <TabsContent value="data" className="mt-0">
            <div className="glass-panel rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-destructive/20 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Data Management</h2>
                  <p className="text-sm text-muted-foreground">Reset or clear financial data</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-foreground mb-1">Reset All Financial Data</h3>
                      <p className="text-sm text-muted-foreground mb-3">
                        This will permanently delete all financial and transaction records while preserving your product catalog.
                      </p>
                      <ul className="text-xs text-muted-foreground space-y-1 mb-3">
                        <li className="flex items-center gap-2">
                          <span className="text-destructive">•</span>
                          All sales, expenses, stock adjustments, and transaction history
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="text-destructive">•</span>
                          All store funds and GCash transaction records
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="text-destructive">•</span>
                          Product stock quantities (reset to 0)
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="text-destructive">•</span>
                          GCash funds balance (reset to ₱0.00)
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="text-destructive">•</span>
                          Store funds balance (reset to ₱0.00)
                        </li>
                        <li className="flex items-center gap-2 mt-2">
                          <span className="text-success">✓</span>
                          <span className="text-success">Product names, prices, variations, and categories will be preserved</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                  <Button
                    variant="destructive"
                    className="gap-2"
                    onClick={() => setShowResetDialog(true)}
                  >
                    <Trash2 className="w-4 h-4" />
                    Reset Financial Data
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

        </Tabs>
      </div>

      {/* Reset Financial Data Dialog */}
      <ResetFinancialDataDialog
        open={showResetDialog}
        onClose={() => setShowResetDialog(false)}
        onComplete={async () => {
          await refreshProducts();
          await refreshStoreFunds();
          toast({
            title: "Financial Data Reset",
            description: "All financial records have been cleared. Products and variations are preserved.",
          });
        }}
      />
    </div>
  );
}

