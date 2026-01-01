import { useState, useEffect, useRef } from "react";
import { X, Package, Tag, Image, Upload, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Product } from "@/types/product";
import { ImageGeneratorDialog } from "@/components/ImageGeneratorDialog";

interface AddProductVariationDialogProps {
  product: Product;
  onConfirm: (price: number, variationName: string, stockQuantity?: number, imageUrl?: string) => void;
  onCancel: () => void;
}

export function AddProductVariationDialog({ 
  product, 
  onConfirm, 
  onCancel 
}: AddProductVariationDialogProps) {
  const [price, setPrice] = useState("");
  const [variationName, setVariationName] = useState("");
  const [stockQuantity, setStockQuantity] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [showImageGenerator, setShowImageGenerator] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const priceInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPrice("");
    setVariationName("");
    setStockQuantity("");
    setImageUrl("");
    setImagePreview(null);
    requestAnimationFrame(() => priceInputRef.current?.focus());
  }, [product]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('Image size must be less than 5MB');
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setImageUrl(base64);
        setImagePreview(base64);
      };
      reader.onerror = () => {
        alert('Error reading image file');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageUrlChange = (url: string) => {
    setImageUrl(url);
    // If it's a valid image URL or base64, show preview
    if (url && (url.startsWith('http') || url.startsWith('data:image'))) {
      setImagePreview(url);
    } else {
      setImagePreview(null);
    }
  };

  const handleRemoveImage = () => {
    setImageUrl("");
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numericPrice = parseFloat(price);
    const numericStock = stockQuantity ? parseInt(stockQuantity) : 0;
    const name = variationName.trim() || `${product.name} - ₱${numericPrice.toFixed(2)}`;
    if (numericPrice > 0) {
      onConfirm(numericPrice, name, numericStock, imageUrl || undefined);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onCancel();
    } else if (e.key === "Enter" && e.target instanceof HTMLInputElement) {
      // Only submit if Enter is pressed in an input field and form is valid
      const numericPrice = parseFloat(price) || 0;
      if (numericPrice > 0) {
        const form = (e.target as HTMLElement).closest('form');
        if (form) {
          e.preventDefault();
          form.requestSubmit();
        }
      }
    }
  };

  // Parse variations if it's a string
  const parseVariations = (): any[] => {
    if (!product.variations) return [];
    if (Array.isArray(product.variations)) return product.variations;
    if (typeof product.variations === 'string') {
      try {
        return JSON.parse(product.variations);
      } catch {
        return [];
      }
    }
    return [];
  };

  const existingVariations = parseVariations();
  // Filter out invalid variations and get valid prices
  const validVariations = existingVariations.filter((v: any) => v && typeof v.price === 'number' && v.price > 0);
  const existingPrices = [
    ...(product.price > 0 ? [product.price] : []),
    ...validVariations.map((v: any) => v.price)
  ].sort((a, b) => a - b);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div
        className="window-border bg-card p-4 w-full h-full max-w-2xl flex flex-col overflow-y-auto"
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-muted border border-border">
              <Tag className="w-6 h-6 text-foreground" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Add Price Variation</h2>
              <p className="text-base text-muted-foreground">{product.name}</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-2 border border-border bg-secondary hover:bg-muted text-foreground"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Show existing variations */}
        {(existingVariations.length > 0 || product.price > 0) && (
          <div className="mb-4 p-3 bg-muted border border-border">
            <p className="text-sm text-muted-foreground mb-2">Existing Price Variations:</p>
            <div className="flex flex-wrap gap-2">
              {product.price > 0 && (
                <span className="px-3 py-1 bg-secondary border border-border text-foreground text-base font-mono">
                  Base: ₱{product.price.toFixed(2)}
                </span>
              )}
              {existingVariations
                .filter((v) => v && typeof v.price === 'number' && v.price > 0)
                .map((v, idx) => (
                  <span
                    key={v.id || idx}
                    className="px-3 py-1 bg-secondary border border-border text-foreground text-base font-mono"
                  >
                    {v.name ? `${v.name}: ` : ''}₱{v.price.toFixed(2)}
                  </span>
                ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-base font-medium text-foreground mb-2">
              Variation Name (Optional)
            </label>
              <input
                type="text"
                value={variationName}
                onChange={(e) => setVariationName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.stopPropagation();
                    onCancel();
                  }
                }}
                className="w-full px-4 py-3 bg-input border border-border text-foreground text-base focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder={`e.g., ${product.name} - Small, ${product.name} - Large`}
              />
            <p className="text-sm text-muted-foreground mt-1">
              Leave empty to auto-generate: "{product.name} - ₱X.XX"
            </p>
          </div>

          <div>
            <label className="block text-base font-medium text-foreground mb-2">
              New Price (₱)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-base">
                ₱
              </span>
              <input
                ref={priceInputRef}
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.stopPropagation();
                    onCancel();
                  }
                }}
                className="w-full pl-8 pr-3 py-3 bg-input border border-border text-foreground font-mono text-base focus:outline-none focus:ring-2 focus:ring-ring [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                placeholder="0.00"
              />
            </div>
            {(() => {
              const numericPrice = parseFloat(price) || 0;
              if (numericPrice <= 0) return null;
              
              const nameProvided = variationName.trim().length > 0;
              const finalName = nameProvided 
                ? variationName.trim() 
                : `${product.name} - ₱${numericPrice.toFixed(2)}`;
              
              // Check if a variation with same name AND same price already exists
              const duplicateExists = validVariations.some((v: any) => {
                const vName = v.name ? v.name.trim() : '';
                const vPrice = typeof v.price === 'number' ? v.price : 0;
                // Compare names (case-insensitive) and prices (exact match)
                return vName.toLowerCase() === finalName.toLowerCase() && 
                       Math.abs(vPrice - numericPrice) < 0.01; // Allow for floating point precision
              });
              
              if (duplicateExists) {
                return (
                  <p className="text-sm text-destructive mt-1">
                    A variation with this name and price already exists. Use a different name or price.
                  </p>
                );
              }
              
              return null;
            })()}
          </div>

          <div>
            <label className="block text-base font-medium text-foreground mb-2">
              Initial Stock (Optional)
            </label>
            <input
              type="number"
              step="1"
              min="0"
              value={stockQuantity}
              onChange={(e) => setStockQuantity(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.stopPropagation();
                  onCancel();
                }
              }}
              className="w-full px-3 py-3 bg-input border border-border text-foreground font-mono text-base focus:outline-none focus:ring-2 focus:ring-ring [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              placeholder="0"
            />
          </div>

          <div>
            <label className="block text-base font-medium text-foreground mb-2">
              Variation Image (Optional)
            </label>
            <div className="space-y-2">
              {/* Image Preview */}
              {imagePreview && (
                <div className="relative w-full aspect-square max-w-[200px] border border-border bg-muted/50 rounded overflow-hidden">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full h-full object-cover"
                    onError={() => setImagePreview(null)}
                  />
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="absolute top-2 right-2 p-1 bg-destructive text-destructive-foreground rounded hover:bg-destructive/90"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
              
              {/* File Upload */}
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="variation-image-upload"
                />
                <label
                  htmlFor="variation-image-upload"
                  className="flex-1 px-4 py-3 bg-muted/50 border border-border text-foreground cursor-pointer hover:bg-muted flex items-center justify-center gap-2"
                >
                  <Upload className="w-5 h-5" />
                  <span className="text-base">Upload Image</span>
                </label>
              </div>
              
              {/* Image URL Input */}
              <div className="relative">
                <Image className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="text"
                  value={imageUrl}
                  onChange={(e) => handleImageUrlChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.stopPropagation();
                      onCancel();
                    }
                  }}
                  className="w-full pl-10 pr-24 py-3 bg-input border border-border text-foreground text-base focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Image URL or base64 data (optional)"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!product.name.trim()) {
                      alert("Product name is required to generate images.");
                      return;
                    }
                    setShowImageGenerator(true);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-7 px-2 text-xs"
                  title="Generate image from Google Images"
                >
                  <Sparkles className="w-3 h-3 mr-1" />
                  Generate
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Supports: https://... or data:image/...;base64,...
              </p>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onCancel}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={(() => {
                const numericPrice = parseFloat(price) || 0;
                if (!price || numericPrice <= 0) return true;
                
                const nameProvided = variationName.trim().length > 0;
                const finalName = nameProvided 
                  ? variationName.trim() 
                  : `${product.name} - ₱${numericPrice.toFixed(2)}`;
                
                // Check if variation with same name AND same price exists
                const duplicateExists = validVariations.some((v: any) => {
                  const vName = v.name ? v.name.trim() : '';
                  const vPrice = typeof v.price === 'number' ? v.price : 0;
                  // Compare names (case-insensitive) and prices (exact match)
                  return vName.toLowerCase() === finalName.toLowerCase() && 
                         Math.abs(vPrice - numericPrice) < 0.01; // Allow for floating point precision
                });
                
                return duplicateExists; // Block if duplicate name+price exists
              })()}
            >
              Add Variation
            </Button>
          </div>
          
          {variationName.trim() && (
            <div className="p-3 bg-muted border border-border">
              <p className="text-sm text-muted-foreground mb-1">Product will be created as:</p>
              <p className="text-base font-medium text-foreground">{variationName.trim()}</p>
            </div>
          )}
        </form>

        {/* Image Generator Dialog */}
        <ImageGeneratorDialog
          open={showImageGenerator}
          onClose={() => setShowImageGenerator(false)}
          onSelectImage={(imageUrl) => {
            setImageUrl(imageUrl);
            handleImageUrlChange(imageUrl);
            setShowImageGenerator(false);
          }}
          productName={product.name}
          variationName={variationName.trim() || undefined}
        />
      </div>
    </div>
  );
}

