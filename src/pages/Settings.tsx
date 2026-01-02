import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Settings as SettingsIcon, Trash2, AlertTriangle, RefreshCw, Smartphone, Package, Calendar, Database, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logout, getOperator } from "@/utils/auth";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { ResetFinancialDataDialog } from "@/components/ResetFinancialDataDialog";
import { SelectiveDataDeletionDialog } from "@/components/SelectiveDataDeletionDialog";
import { useToast } from "@/hooks/use-toast";
import { useMySQLSync } from "@/hooks/useMySQLSync";
import { useStoreFunds } from "@/hooks/useStoreFunds";
import { useLocalStorage } from "@/hooks/useLocalStorage";

export default function Settings() {
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [showSelectiveDeleteDialog, setShowSelectiveDeleteDialog] = useState(false);
  const { toast } = useToast();
  const { refreshProducts } = useMySQLSync();
  const { refresh: refreshStoreFunds } = useStoreFunds();
  const [gcashEnabled, setGcashEnabled] = useLocalStorage<boolean>("pos-gcash-enabled", true);
  const [showStockStatus, setShowStockStatus] = useLocalStorage<boolean>("pos-show-stock-status", true);

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
          <div className="flex items-center gap-3 flex-1">
            <div className="p-2 bg-primary/20 rounded-lg">
              <SettingsIcon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Settings</h1>
              <p className="text-sm text-muted-foreground">Manage system settings and data</p>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2"
            onClick={logout}
            title={`Logout (${getOperator() || "Unknown"})`}
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>

        {/* Settings Tabs */}
        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="general" className="gap-2">
              <SettingsIcon className="w-4 h-4" />
              General
            </TabsTrigger>
            <TabsTrigger value="data" className="gap-2">
              <AlertTriangle className="w-4 h-4" />
              Data Management
            </TabsTrigger>
          </TabsList>

          {/* General Settings Tab */}
          <TabsContent value="general" className="mt-0">
            <div className="window-border bg-[#c0c0c0] p-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-primary/20 border border-black">
                  <SettingsIcon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground">General Settings</h2>
                  <p className="text-sm text-muted-foreground">Configure POS system preferences</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-muted border border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="p-2 bg-secondary border border-border">
                        <Smartphone className="w-5 h-5 text-foreground" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium text-foreground mb-1">Enable GCash Transactions</h3>
                        <p className="text-sm text-muted-foreground">
                          Allow customers to pay via GCash in the POS system
                        </p>
                      </div>
                    </div>
                    <Checkbox
                      checked={gcashEnabled}
                      onCheckedChange={(checked) => {
                        setGcashEnabled(checked === true);
                        toast({
                          title: checked ? "GCash Enabled" : "GCash Disabled",
                          description: checked 
                            ? "GCash payment method is now available in POS"
                            : "GCash payment method has been disabled in POS",
                        });
                      }}
                      className="ml-4"
                    />
                  </div>
                </div>
                <div className="p-4 bg-muted border border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="p-2 bg-secondary border border-border">
                        <Package className="w-5 h-5 text-foreground" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium text-foreground mb-1">Show Stock Status in POS</h3>
                        <p className="text-sm text-muted-foreground">
                          Display stock status indicators and out of stock warnings in the POS screen
                        </p>
                      </div>
                    </div>
                    <Checkbox
                      checked={showStockStatus}
                      onCheckedChange={(checked) => {
                        setShowStockStatus(checked === true);
                        toast({
                          title: checked ? "Stock Status Enabled" : "Stock Status Disabled",
                          description: checked 
                            ? "Stock status indicators are now visible in POS"
                            : "Stock status indicators have been hidden in POS",
                        });
                      }}
                      className="ml-4"
                    />
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

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
                <div className="p-4 bg-warning/10 border border-warning/20 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Database className="w-4 h-4 text-warning" />
                        <h3 className="font-medium text-foreground">Selective Data Deletion</h3>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        Delete records based on date range and table/category selection. Useful for cleaning up old data or removing specific transaction types.
                      </p>
                      <ul className="text-xs text-muted-foreground space-y-1 mb-3">
                        <li className="flex items-center gap-2">
                          <span className="text-warning">•</span>
                          Select specific table (Sales, Expenses, GCash, etc.)
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="text-warning">•</span>
                          Filter by date range (optional)
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="text-warning">•</span>
                          Safe deletion with confirmation required
                        </li>
                      </ul>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="gap-2 border-warning/30 text-warning hover:bg-warning/10"
                    onClick={() => setShowSelectiveDeleteDialog(true)}
                  >
                    <Calendar className="w-4 h-4" />
                    Delete by Date & Table
                  </Button>
                </div>

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

      {/* Selective Data Deletion Dialog */}
      <SelectiveDataDeletionDialog
        open={showSelectiveDeleteDialog}
        onClose={() => setShowSelectiveDeleteDialog(false)}
        onComplete={async () => {
          await refreshProducts();
          await refreshStoreFunds();
        }}
      />

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

