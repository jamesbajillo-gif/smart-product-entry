import { useState } from "react";
import { AlertTriangle, Trash2, RefreshCw, Calendar, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest } from "@/services/mysqlApi";
import { useToast } from "@/hooks/use-toast";
import { useGCashFunds } from "@/hooks/useGCashFunds";
import { useStoreFunds } from "@/hooks/useStoreFunds";

interface SelectiveDataDeletionDialogProps {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}

type TableOption = {
  value: string;
  label: string;
  description: string;
};

const TABLE_OPTIONS: TableOption[] = [
  {
    value: "all",
    label: "All Tables",
    description: "Delete from all transaction tables (preserves products)",
  },
  {
    value: "sales",
    label: "Sales",
    description: "All sales transaction records",
  },
  {
    value: "expenses",
    label: "Expenses",
    description: "All expense records",
  },
  {
    value: "stock_adjustments",
    label: "Stock Adjustments",
    description: "All stock adjustment history",
  },
  {
    value: "gcash_funds",
    label: "GCash Transactions",
    description: "All GCash fund transactions",
  },
  {
    value: "store_funds",
    label: "Store Funds",
    description: "All store fund transactions",
  },
  {
    value: "quantity_history",
    label: "Quantity History",
    description: "Product quantity history records",
  },
];

// Tables that can be safely deleted (excludes products, categories, fees, etc.)
const SAFE_DELETABLE_TABLES = [
  "sales",
  "expenses",
  "stock_adjustments",
  "gcash_funds",
  "store_funds",
  "quantity_history",
];

export function SelectiveDataDeletionDialog({
  open,
  onClose,
  onComplete,
}: SelectiveDataDeletionDialogProps) {
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const { toast } = useToast();
  const { setCredits: setGcashCredits, setCash: setGcashCash, setHistory: setGcashHistory } = useGCashFunds();
  const { refresh: refreshStoreFunds } = useStoreFunds();

  const selectedTableInfo = TABLE_OPTIONS.find((t) => t.value === selectedTable);
  const requiredText = selectedTable 
    ? selectedTable === "all" 
      ? "DELETE ALL TABLES" 
      : `DELETE ${selectedTableInfo?.label.toUpperCase()}`
    : "";

  // Format date for MySQL (YYYY-MM-DD)
  const formatDateForMySQL = (date: string): string => {
    if (!date) return "";
    return date;
  };

  // Get date range for filtering
  const getDateRange = () => {
    if (!startDate && !endDate) return {};
    
    const start = startDate ? `${formatDateForMySQL(startDate)} 00:00:00` : undefined;
    const end = endDate ? `${formatDateForMySQL(endDate)} 23:59:59` : undefined;
    
    return { start, end };
  };

  const handleDelete = async () => {
    if (!selectedTable) {
      toast({
        title: "Error",
        description: "Please select a table to delete from",
        variant: "destructive",
      });
      return;
    }

    if (confirmText !== requiredText) {
      toast({
        title: "Confirmation Required",
        description: `Please type "${requiredText}" to confirm deletion`,
        variant: "destructive",
      });
      return;
    }

    setIsDeleting(true);
    try {
      const dateRange = getDateRange();
      let totalDeletedCount = 0;
      const deletionResults: Array<{ table: string; count: number }> = [];

      // Get all records first (with date filter if provided)
      const filters: Record<string, string> = {};
      if (dateRange.start) {
        filters["created_at__gte"] = dateRange.start;
      }
      if (dateRange.end) {
        filters["created_at__lte"] = dateRange.end;
      }

      // Determine which tables to delete from
      const tablesToDelete = selectedTable === "all" 
        ? SAFE_DELETABLE_TABLES 
        : [selectedTable];

      // Delete from each table
      for (const table of tablesToDelete) {
        let deletedCount = 0;

        const result = await apiRequest<Array<{ id: number }>>("GET", {
          table: table,
          limit: 100000, // Large limit to get all matching records
          filters: Object.keys(filters).length > 0 ? filters : undefined,
        });

        if (result.success && result.data) {
          // Delete each record
          for (const record of result.data) {
            const deleteResult = await apiRequest("DELETE", {
              table: table,
              id: record.id,
            });
            if (deleteResult.success) {
              deletedCount++;
            }
          }
        }

        if (deletedCount > 0) {
          deletionResults.push({ table, count: deletedCount });
          totalDeletedCount += deletedCount;
        }
      }

      // If GCash funds were deleted, reset local state
      if (selectedTable === "all" || selectedTable === "gcash_funds") {
        setGcashCredits(0);
        setGcashCash(0);
        setGcashHistory([]);
      }

      // Refresh store funds if store_funds was deleted
      if (selectedTable === "all" || selectedTable === "store_funds") {
        await refreshStoreFunds();
      }

      // Show detailed results
      const resultMessage = selectedTable === "all"
        ? `Deleted ${totalDeletedCount} record(s) from ${deletionResults.length} table(s)`
        : `Successfully deleted ${totalDeletedCount} record(s) from ${selectedTableInfo?.label}`;

      toast({
        title: "Deletion Complete",
        description: resultMessage,
      });

      onComplete();
      onClose();
      setSelectedTable("");
      setStartDate("");
      setEndDate("");
      setConfirmText("");
    } catch (error) {
      console.error("Error deleting data:", error);
      toast({
        title: "Deletion Failed",
        description: "An error occurred while deleting records",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    if (!isDeleting) {
      setSelectedTable("");
      setStartDate("");
      setEndDate("");
      setConfirmText("");
      onClose();
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent className="w-full max-w-2xl max-h-[95vh] overflow-y-auto">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-destructive/20 rounded-lg">
              <Trash2 className="w-5 h-5 text-destructive" />
            </div>
            <AlertDialogTitle className="text-xl">Selective Data Deletion</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="space-y-4 pt-2">
            <p className="text-foreground font-medium">
              Delete records based on date range and table/category selection.
            </p>

            {/* Table Selection */}
            <div className="space-y-2">
              <Label htmlFor="table-select" className="flex items-center gap-2">
                <Database className="w-4 h-4" />
                Select Table/Category
              </Label>
              <Select value={selectedTable} onValueChange={setSelectedTable}>
                <SelectTrigger id="table-select">
                  <SelectValue placeholder="Choose a table to delete from" />
                </SelectTrigger>
                <SelectContent>
                  {TABLE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div>
                        <div className="font-medium">{option.label}</div>
                        <div className="text-xs text-muted-foreground">{option.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedTableInfo && (
                <p className="text-xs text-muted-foreground">
                  {selectedTableInfo.description}
                </p>
              )}
            </div>

            {/* Date Range Selection */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Date Range (Optional)
              </Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="start-date" className="text-xs">
                    Start Date
                  </Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    disabled={isDeleting}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="end-date" className="text-xs">
                    End Date
                  </Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    disabled={isDeleting}
                    min={startDate || undefined}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {startDate || endDate
                  ? `Records from ${startDate || "beginning"} to ${endDate || "today"} will be deleted`
                  : "Leave empty to delete all records from selected table"}
              </p>
            </div>

            {/* Warning */}
            <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm font-medium text-destructive mb-2">
                ⚠️ This action cannot be undone!
              </p>
              {selectedTable === "all" && (
                <div className="mb-3 p-2 bg-warning/10 border border-warning/20 rounded text-xs text-muted-foreground">
                  <p className="font-medium text-warning mb-1">Note: Products and categories will be preserved</p>
                  <p className="mt-1">Only transaction data will be deleted from: Sales, Expenses, Stock Adjustments, GCash, Store Funds, and Quantity History</p>
                </div>
              )}
              {selectedTable && (
                <>
                  <p className="text-xs text-muted-foreground mb-2">
                    Type <strong className="text-foreground">{requiredText}</strong> to confirm:
                  </p>
                  <Input
                    type="text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder={requiredText}
                    className="bg-input text-foreground placeholder:text-muted-foreground"
                    disabled={isDeleting}
                  />
                </>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={!selectedTable || confirmText !== requiredText || isDeleting}
            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
          >
            {isDeleting ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Records
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

