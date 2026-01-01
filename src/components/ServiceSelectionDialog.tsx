import { useState, useEffect, useRef } from "react";
import { Product, ProductService } from "@/types/product";
import { Button } from "@/components/ui/button";
import { X, Check } from "lucide-react";

interface ServiceSelectionDialogProps {
  product: Product;
  onConfirm: (selectedServices: ProductService[]) => void;
  onCancel: () => void;
}

export function ServiceSelectionDialog({
  product,
  onConfirm,
  onCancel,
}: ServiceSelectionDialogProps) {
  const [selectedServices, setSelectedServices] = useState<ProductService[]>([]);
  const services = product.services || [];

  useEffect(() => {
    // Reset selections when product changes
    setSelectedServices([]);
  }, [product.id]);

  const toggleService = (service: ProductService) => {
    setSelectedServices((prev) => {
      const isSelected = prev.some((s) => s.id === service.id);
      if (isSelected) {
        return prev.filter((s) => s.id !== service.id);
      } else {
        return [...prev, service];
      }
    });
  };

  const totalServiceFee = selectedServices.reduce((sum, service) => sum + service.price, 0);
  const totalPrice = product.price + totalServiceFee;

  const handleConfirm = () => {
    onConfirm(selectedServices);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onCancel();
    } else if (e.key === "Enter" && selectedServices.length >= 0) {
      handleConfirm();
    }
    // Space key toggles services when focused on a service button
    // This is handled by the button's onKeyDown handler
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background animate-fade-in"
      onKeyDown={handleKeyDown}
    >
      <div
        className="glass-panel p-4 sm:p-6 w-full h-full max-w-md max-h-screen overflow-y-auto animate-scale-in flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/20">
              <X className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Add Services</h2>
              <p className="text-sm text-muted-foreground">{product.name}</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Services List */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Available Services (Optional)
            </label>
            {services.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No services available for this product
              </p>
            ) : (
              <div className="space-y-2">
                {services.map((service) => {
                  const isSelected = selectedServices.some((s) => s.id === service.id);
                  return (
                    <button
                      key={service.id}
                      type="button"
                      onClick={() => toggleService(service)}
                      onKeyDown={(e) => {
                        if (e.key === " " || e.key === "Enter") {
                          e.preventDefault();
                          toggleService(service);
                        }
                      }}
                      className={`w-full p-3 border-2 transition-all ${
                        isSelected
                          ? "border-primary bg-primary/10"
                          : "border-border bg-secondary/30 hover:border-primary/50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                              isSelected
                                ? "border-primary bg-primary"
                                : "border-border bg-background"
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                          </div>
                          <div className="text-left">
                            <p className="font-medium text-foreground">{service.name}</p>
                            <p className="text-xs text-muted-foreground">
                              Additional service fee
                            </p>
                          </div>
                        </div>
                        <span className="text-primary font-mono font-semibold">
                          ₱{service.price.toFixed(2)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Price Summary */}
          <div className="p-4 bg-secondary/30 border border-border/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Product Price</span>
              <span className="text-sm font-mono text-foreground">
                ₱{product.price.toFixed(2)}
              </span>
            </div>
            {selectedServices.length > 0 && (
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Service Fees</span>
                <span className="text-sm font-mono text-foreground">
                  ₱{totalServiceFee.toFixed(2)}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="font-semibold text-foreground">Total</span>
              <span className="text-lg font-mono font-bold text-primary">
                ₱{totalPrice.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={onCancel}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              className="flex-1"
            >
              Add to Cart
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

