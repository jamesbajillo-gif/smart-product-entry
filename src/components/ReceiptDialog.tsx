import { useRef } from "react";
import { OrderItem } from "@/types/product";
import { X, Printer, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ReceiptDialogProps {
  items: OrderItem[];
  onClose: () => void;
}

export function ReceiptDialog({ items, onClose }: ReceiptDialogProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const total = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const now = new Date();

  const handlePrint = () => {
    const printContent = receiptRef.current;
    if (!printContent) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receipt</title>
          <style>
            body {
              font-family: 'Courier New', monospace;
              padding: 20px;
              max-width: 300px;
              margin: 0 auto;
            }
            .header { text-align: center; margin-bottom: 20px; }
            .header h1 { font-size: 18px; margin: 0; }
            .header p { font-size: 12px; color: #666; margin: 5px 0; }
            .divider { border-top: 1px dashed #333; margin: 10px 0; }
            .item { display: flex; justify-content: space-between; font-size: 12px; margin: 5px 0; }
            .item-name { flex: 1; }
            .item-qty { width: 40px; text-align: center; }
            .item-price { width: 70px; text-align: right; }
            .total { display: flex; justify-content: space-between; font-size: 16px; font-weight: bold; margin-top: 10px; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
    printWindow.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in">
      <div className="glass-panel rounded-xl p-6 w-full max-w-md mx-4 animate-scale-in">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-success">
            <CheckCircle className="w-5 h-5" />
            <h2 className="text-xl font-semibold">Order Complete</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Receipt Content */}
        <div
          ref={receiptRef}
          className="bg-card border border-border rounded-lg p-4 font-mono text-sm"
        >
          <div className="header text-center mb-4">
            <h1 className="text-lg font-bold text-foreground">Sari-Sari Store</h1>
            <p className="text-muted-foreground text-xs">
              {now.toLocaleDateString("en-PH", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
            <p className="text-muted-foreground text-xs">
              {now.toLocaleTimeString("en-PH")}
            </p>
          </div>

          <div className="divider border-t border-dashed border-border my-3" />

          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.product.id} className="item flex justify-between text-foreground">
                <span className="flex-1 truncate">{item.product.name}</span>
                <span className="w-10 text-center text-muted-foreground">×{item.quantity}</span>
                <span className="w-20 text-right">
                  ₱{(item.product.price * item.quantity).toFixed(2)}
                </span>
              </div>
            ))}
          </div>

          <div className="divider border-t border-dashed border-border my-3" />

          <div className="flex justify-between text-muted-foreground text-xs mb-1">
            <span>Items</span>
            <span>{itemCount}</span>
          </div>

          <div className="total flex justify-between text-lg font-bold text-foreground">
            <span>TOTAL</span>
            <span className="text-primary">₱{total.toFixed(2)}</span>
          </div>

          <div className="footer text-center mt-4 text-muted-foreground text-xs">
            <p>Thank you for your purchase!</p>
            <p>Please come again</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-4">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Close
          </Button>
          <Button className="flex-1 gap-2" onClick={handlePrint}>
            <Printer className="w-4 h-4" />
            Print Receipt
          </Button>
        </div>
      </div>
    </div>
  );
}
