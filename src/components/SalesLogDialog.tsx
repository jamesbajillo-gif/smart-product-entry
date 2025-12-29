import { useState, useEffect } from "react";
import { X, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { salesApi, SaleRecord } from "@/services/mysqlApi";
import { useMySQLSync } from "@/hooks/useMySQLSync";
import { getProductDisplayName } from "@/utils/productDisplay";
import { format } from "date-fns";

interface SalesLogDialogProps {
  onClose: () => void;
}

interface ParsedSaleItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
  selectedServices?: Array<{ id: string; name: string; price: number }>;
  services?: Array<{ id: string; name: string; price: number }>;
  variation?: string;
  variationName?: string;
}

export function SalesLogDialog({ onClose }: SalesLogDialogProps) {
  const { products } = useMySQLSync();
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSales();
  }, []);

  const loadSales = async () => {
    setIsLoading(true);
    try {
      const result = await salesApi.getAll({ limit: 1000 });
      if (result.success && result.data) {
        // Sort by date, newest first
        const sortedSales = [...result.data].sort((a, b) => {
          const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return dateB - dateA;
        });
        setSales(sortedSales);
      }
    } catch (error) {
      console.error("Failed to load sales:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatSalesLog = (): string => {
    if (sales.length === 0) return "No sales transactions found.\n";

    let log = "";
    
    sales.forEach((sale) => {
      try {
        // Parse items
        const items: any[] = JSON.parse(sale.items || '[]');
        
        // Format date with operator name
        const saleDate = sale.created_at 
          ? format(new Date(sale.created_at), "yyyy-MM-dd HH:mm:ss")
          : "Unknown date";
        const operatorName = sale.operator_name || "Unknown";
        
        log += `${saleDate} - ${operatorName}\n`;
        
        // Parse items and separate regular items from bottle deposits
        const regularItems: Array<{ 
          name: string; 
          quantity: number; 
          total: number; 
          price: number;
          originalItem: any;
        }> = [];
        let bottleDepositQuantity = 0;
        let bottleDepositTotal = 0;
        
        items.forEach((item: any) => {
          // Calculate item total (product price + services)
          const productTotal = (item.price || 0) * (item.quantity || 0);
          const servicesTotal = ((item.selectedServices || item.services || []) as any[]).reduce(
            (sum: number, service: any) => sum + (service.price || 0) * (item.quantity || 0),
            0
          );
          const itemTotal = productTotal + servicesTotal;
          
          // Check if this item has bottle deposit info
          if (item.bottleDepositTotal && item.bottleDepositTotal > 0) {
            bottleDepositQuantity += item.quantity || 0;
            bottleDepositTotal += item.bottleDepositTotal;
          }
          
          // Skip if it's a special transaction item (GCASH-IN, GCASH-OUT, Service Charge)
          const itemName = item.name || '';
          if (itemName === 'GCASH-IN' || itemName === 'GCASH-OUT' || itemName === 'Service Charge') {
            // Skip these special items
            return;
          }
          
          // Add regular items
          if (itemTotal > 0) {
            regularItems.push({
              name: itemName,
              quantity: item.quantity || 0,
              total: itemTotal,
              price: item.price || 0,
              originalItem: item,
            });
          }
        });
        
        // Add regular items with format: Product Name - Variation - ₱Amount x Qty = ₱Total
        regularItems.forEach((item) => {
          // Get full display name with variation using helper function
          const fullDisplayName = getProductDisplayName(
            item.originalItem.productId || '', 
            item.name, 
            products
          );
          
          // Extract variation from display name
          let productName = fullDisplayName;
          let variation = '';
          
          // Check if name contains variation pattern (e.g., "Product - Variation")
          const nameParts = fullDisplayName.split(' - ');
          if (nameParts.length > 1) {
            // Check if the last part looks like a variation (not a price)
            const lastPart = nameParts[nameParts.length - 1].trim();
            // If it doesn't match price pattern, it's a variation
            const isPricePattern = /^₱?\d+\.?\d{0,2}$/.test(lastPart);
            if (!isPricePattern) {
              variation = lastPart;
              productName = nameParts.slice(0, -1).join(' - ').trim();
            }
          }
          
          // Get price per unit (amount)
          const pricePerUnit = item.price;
          
          // Format: Product Name - Variation - ₱Amount x Qty = ₱Total
          // If variation exists, show it; otherwise skip the variation part
          if (variation) {
            log += `-${productName} - ${variation} - ₱${pricePerUnit.toFixed(2)} x ${item.quantity} = ₱${item.total.toFixed(2)}\n`;
          } else {
            log += `-${productName} - ₱${pricePerUnit.toFixed(2)} x ${item.quantity} = ₱${item.total.toFixed(2)}\n`;
          }
        });
        
        // Add bottle deposit if exists
        if (bottleDepositTotal > 0) {
          log += `--deposit ${bottleDepositQuantity} = ₱${bottleDepositTotal.toFixed(2)}\n`;
        }
        
        log += "\n";
      } catch (error) {
        console.error("Error parsing sale items:", error);
        log += `${sale.created_at ? format(new Date(sale.created_at), "yyyy-MM-dd HH:mm:ss") : "Unknown date"}\n`;
        log += `-Error parsing transaction\n\n`;
      }
    });
    
    return log;
  };

  const handleDownload = () => {
    const logText = formatSalesLog();
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales-log-${format(new Date(), 'yyyy-MM-dd')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const logText = formatSalesLog();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in p-2 sm:p-4">
      <div className="glass-panel rounded-xl w-full max-w-4xl max-h-[95vh] flex flex-col animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4 border-b border-border/50 flex-shrink-0">
          <h2 className="text-xl font-semibold text-foreground">Sales Transaction Log</h2>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              Download
            </Button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
              <p>Loading sales...</p>
            </div>
          ) : (
            <pre className="font-mono text-sm text-foreground whitespace-pre-wrap break-words">
              {logText}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

