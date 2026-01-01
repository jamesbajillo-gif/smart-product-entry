import { useState, useEffect, useCallback } from "react";
import { Loader2, Image as ImageIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { searchGoogleImages, GoogleImageResult } from "@/services/googleImagesApi";
import { useToast } from "@/hooks/use-toast";

interface ImageGeneratorDialogProps {
  open: boolean;
  onClose: () => void;
  onSelectImage: (imageUrl: string) => void;
  productName: string;
  variationName?: string;
}

export function ImageGeneratorDialog({
  open,
  onClose,
  onSelectImage,
  productName,
  variationName,
}: ImageGeneratorDialogProps) {
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchImages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result: GoogleImageResult = await searchGoogleImages(
        productName,
        variationName
      );
      
      if (result.links.length === 0) {
        setError("No images found for this product.");
        toast({
          title: "No Images Found",
          description: "Try a different product name or variation.",
          variant: "destructive",
        });
      } else {
        setImages(result.links);
        setSelectedIndex(0); // Auto-select first image
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch images";
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [productName, variationName, toast]);

  useEffect(() => {
    if (open && productName) {
      fetchImages();
    } else {
      // Reset state when dialog closes
      setImages([]);
      setSelectedIndex(0);
      setError(null);
    }
  }, [open, productName, variationName, fetchImages]);

  const handleSelectImage = () => {
    if (images[selectedIndex]) {
      onSelectImage(images[selectedIndex]);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Select Product Image</DialogTitle>
          <DialogDescription>
            Choose an image for {productName}
            {variationName && ` - ${variationName}`}
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="ml-3 text-muted-foreground">Searching for images...</span>
          </div>
        )}

        {error && !loading && (
          <div className="flex flex-col items-center justify-center py-12">
            <ImageIcon className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-2">{error}</p>
            <Button onClick={fetchImages} className="mt-4" variant="outline">
              Retry
            </Button>
          </div>
        )}

        {!loading && !error && images.length > 0 && (
          <div className="space-y-4">
            {/* Selected Image Preview */}
            <div className="border border-border rounded-lg p-4 bg-muted/50">
              <p className="text-sm text-muted-foreground mb-2">Selected Image:</p>
              <div className="relative w-full aspect-square max-w-md mx-auto border border-border rounded overflow-hidden bg-background">
                <img
                  src={images[selectedIndex]}
                  alt={`Selected ${selectedIndex + 1}`}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect fill='%23ddd' width='200' height='200'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23999'%3EImage not available%3C/text%3E%3C/svg%3E";
                  }}
                />
              </div>
            </div>

            {/* Thumbnail Grid */}
            <div>
              <p className="text-sm text-muted-foreground mb-3">
                Select from {images.length} images:
              </p>
              <div className="grid grid-cols-5 gap-2">
                {images.map((imageUrl, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedIndex(index)}
                    className={`relative aspect-square border-2 rounded overflow-hidden transition-all ${
                      selectedIndex === index
                        ? "border-primary ring-2 ring-primary ring-offset-2"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <img
                      src={imageUrl}
                      alt={`Option ${index + 1}`}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23ddd' width='100' height='100'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23999' font-size='12'%3EN/A%3C/text%3E%3C/svg%3E";
                      }}
                    />
                    {selectedIndex === index && (
                      <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                        <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                          ✓
                        </div>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handleSelectImage} disabled={!images[selectedIndex]}>
                Use Selected Image
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

