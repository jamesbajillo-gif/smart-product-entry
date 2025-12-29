import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { stockApi, RestockInfo, productsApi, expensesApi } from "@/services/mysqlApi";
import { useMySQLSync } from "@/hooks/useMySQLSync";
import { Product, ProductCategory, ProductSupplier, ProductService } from "@/types/product";
import { getAllCategories, getAllCategoriesAsync, getFlatCategoriesWithParents } from "@/utils/categories";
import { categoriesApi } from "@/services/mysqlApi";
import { Button } from "@/components/ui/button";
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
import { StockAdjustmentDialog, RestockData } from "@/components/StockAdjustmentDialog";
import { StockHistoryDialog } from "@/components/StockHistoryDialog";
import { AddExpenseDialog } from "@/components/AddExpenseDialog";
import { AddGCashFundsDialog } from "@/components/AddGCashFundsDialog";
import { AddProductVariationDialog } from "@/components/AddProductVariationDialog";
import { EditVariationDialog } from "@/components/EditVariationDialog";
import { HistoryDialog } from "@/components/HistoryDialog";
import { CategoryManagementDialog } from "@/components/CategoryManagementDialog";
import { useGCashFunds } from "@/hooks/useGCashFunds";
import { useStoreFunds } from "@/hooks/useStoreFunds";
import { useAvailableFunds } from "@/hooks/useAvailableFunds";
import {
  ArrowLeft,
  Package,
  Plus,
  Pencil,
  Save,
  X,
  RefreshCw,
  Search,
  Tag,
  Filter,
  CheckSquare,
  Square,
  Image,
  AlertTriangle,
  History,
  Wifi,
  WifiOff,
  Database,
  Truck,
  Receipt,
  Layers,
  Edit,
  Settings,
  Trash2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { initialProducts } from "@/data/products";

export default function ProductManagement() {
  const { canDelete } = useUserPermissions();
  const {
    products,
    addProduct,
    updateProduct,
    deleteProduct,
    refreshProducts,
    isOnline,
    isLoading,
  } = useMySQLSync();
  const { funds: storeFunds, addFunds: addStoreFunds, withdrawFunds: withdrawStoreFunds, refresh: refreshStoreFunds } = useStoreFunds();
  const { availableFunds, refresh: refreshAvailableFunds } = useAvailableFunds();

  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<ProductCategory | "All">("All");
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editCategory, setEditCategory] = useState<ProductCategory | string>("Other");
  const [showEditNewCategory, setShowEditNewCategory] = useState(false);
  const [editNewCategory, setEditNewCategory] = useState("");
  const [allCategories, setAllCategories] = useState<string[]>(getAllCategories());
  const [editImageUrl, setEditImageUrl] = useState("");
  const [editStockQuantity, setEditStockQuantity] = useState("");
  const [editLowStockThreshold, setEditLowStockThreshold] = useState("");
  const [editSkipStockTracking, setEditSkipStockTracking] = useState(false);
  const [editSuppliers, setEditSuppliers] = useState<ProductSupplier[]>([]);
  const [availableSuppliers, setAvailableSuppliers] = useState<string[]>([]);
  const [isLoadingSuppliers, setIsLoadingSuppliers] = useState(false);
  const [editServices, setEditServices] = useState<ProductService[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newCategory, setNewCategory] = useState<ProductCategory | string>("Other");
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newImageUrl, setNewImageUrl] = useState("");
  const [newStockQuantity, setNewStockQuantity] = useState("0");
  const [newLowStockThreshold, setNewLowStockThreshold] = useState("5");
  const [newSkipStockTracking, setNewSkipStockTracking] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkCategory, setBulkCategory] = useState<ProductCategory>("Beverages");
  const [showCategoryManagement, setShowCategoryManagement] = useState(false);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<{ id: string; name: string } | null>(null);
  const [bulkPrice, setBulkPrice] = useState("");
  const [showBulkPriceUpdate, setShowBulkPriceUpdate] = useState(false);
  const [bulkSupplier, setBulkSupplier] = useState<ProductSupplier | null>(null);
  const [showBulkSupplierUpdate, setShowBulkSupplierUpdate] = useState(false);
  const [stockAdjustProduct, setStockAdjustProduct] = useState<Product | null>(null);
  const [stockHistoryProduct, setStockHistoryProduct] = useState<Product | null>(null);
  const [expenseProduct, setExpenseProduct] = useState<Product | null>(null);
  const [showAddGcashFunds, setShowAddGcashFunds] = useState(false);
  const [variationProduct, setVariationProduct] = useState<Product | null>(null);
  const [editingVariation, setEditingVariation] = useState<{ product: Product; variation: any } | null>(null);
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);
  const { toast } = useToast();
  const { credits: gcashCredits, cash: gcashCash, addFunds } = useGCashFunds();
  
  // Load categories from database on mount and when Category Management dialog closes
  useEffect(() => {
    const loadCategories = async () => {
      const categories = await getAllCategoriesAsync();
      setAllCategories(categories);
    };
    loadCategories();
  }, [showCategoryManagement]);

  // Update categories list when new category is added (for immediate UI update)
  useEffect(() => {
    setAllCategories(getAllCategories());
  }, [showNewCategory, showEditNewCategory]);

  const lowStockCount = useMemo(() => {
    // Exclude products with skip_stock_tracking from low stock count
    return products.filter(p => 
      !p.skip_stock_tracking && (p.stock_quantity ?? 0) <= (p.low_stock_threshold ?? 5)
    ).length;
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === "All" || p.category === categoryFilter;
      // Exclude skip_stock_tracking products from low stock filter
      const isLowStock = !p.skip_stock_tracking && (p.stock_quantity ?? 0) <= (p.low_stock_threshold ?? 5);
      const matchesLowStock = !showLowStockOnly || isLowStock;
      return matchesSearch && matchesCategory && matchesLowStock;
    });
  }, [products, searchQuery, categoryFilter, showLowStockOnly]);

  // Group products by category
  const groupedProducts = useMemo(() => {
    const groups: Record<string, Product[]> = {};

    filteredProducts.forEach((product) => {
      const category = product.category || "Other";
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(product);
    });

    const sortedGroups: { category: string; products: Product[] }[] = [];
    // Sort by all categories (default + custom)
    allCategories.forEach((cat) => {
      if (groups[cat]) {
        sortedGroups.push({ category: cat, products: groups[cat] });
      }
    });

    return sortedGroups;
  }, [filteredProducts]);

  // Seed initial products to database
  const seedInitialProducts = async () => {
    setIsSeeding(true);
    let successCount = 0;

    for (const product of initialProducts) {
      const result = await addProduct({
        name: product.name,
        price: product.price,
        category: product.category || "Other",
        stock_quantity: 50,
        low_stock_threshold: 5,
      });
      if (result.success) successCount++;
    }

    toast({
      title: "Products Seeded",
      description: `Added ${successCount} products to database`,
    });
    setIsSeeding(false);
  };

  const handleAdd = async () => {
    if (!newName.trim()) {
      toast({ title: "Error", description: "Please enter a product name" });
      return;
    }

    // Validate price if provided
    if (newPrice.trim()) {
      const priceValue = parseFloat(newPrice);
      if (isNaN(priceValue) || priceValue < 0) {
        toast({
          title: "Invalid Price",
          description: "Price must be a valid number greater than or equal to 0",
          variant: "destructive"
        });
        return;
      }
    }

    // Save custom category to database if it doesn't exist
    const categoryToSave = newCategory.trim() || "Other";
    if (categoryToSave) {
      try {
        // Check if category exists in database
        const allCats = await getAllCategoriesAsync();
        if (!allCats.includes(categoryToSave)) {
          // Create new category in database
          await categoriesApi.create({
            name: categoryToSave,
            parent_id: null,
            is_parent: false,
            display_order: 999,
          });
          // Refresh categories list
          const updatedCategories = await getAllCategoriesAsync();
          setAllCategories(updatedCategories);
        }
      } catch (error) {
        console.error("Error creating category:", error);
        // Continue with product creation even if category creation fails
      }
    }
    
    // Build product data - include skip_stock_tracking flag
    // Price is optional, defaults to 0 if not provided
    const productData: {
      name: string;
      price: number;
      category: ProductCategory | string;
      image_url?: string;
      stock_quantity?: number;
      low_stock_threshold?: number;
      skip_stock_tracking?: boolean;
    } = {
      name: newName.trim(),
      price: newPrice.trim() ? parseFloat(newPrice) : 0,
      category: categoryToSave,
      image_url: newImageUrl.trim() || undefined,
      skip_stock_tracking: newSkipStockTracking,
    };
    
    // Only add stock fields if not skipping stock tracking and user entered values
    if (!newSkipStockTracking && newStockQuantity.trim() !== "") {
      productData.stock_quantity = parseInt(newStockQuantity) || 0;
      productData.low_stock_threshold = parseInt(newLowStockThreshold) || 5;
    }
    
    const result = await addProduct(productData);

    if (result.success) {
      toast({ title: "Success", description: "Product added successfully" });
      setNewName("");
      setNewPrice("");
      setNewCategory("Other");
      setNewImageUrl("");
      setNewStockQuantity("0");
      setNewLowStockThreshold("5");
      setNewSkipStockTracking(false);
      setShowAddForm(false);
    } else {
      toast({ title: "Error", description: result.error || "Failed to add product" });
    }
  };

  const handleEdit = async (product: Product) => {
    setEditingId(product.id);
    setEditName(product.name);
    setEditPrice(product.price.toString());
    const category = product.category || "Other";
    setEditCategory(category);
    // Ensure category exists in database (async check, but don't block)
    if (category) {
      getAllCategoriesAsync().then(async (allCats) => {
        if (!allCats.includes(category)) {
          try {
            await categoriesApi.create({
              name: category,
              parent_id: null,
              is_parent: false,
              display_order: 999,
            });
            const updatedCategories = await getAllCategoriesAsync();
            setAllCategories(updatedCategories);
          } catch (error) {
            console.error("Error ensuring category exists:", error);
          }
        }
      });
    }
    setEditImageUrl(product.image_url || "");
    setEditStockQuantity((product.stock_quantity ?? 0).toString());
    setEditLowStockThreshold((product.low_stock_threshold ?? 5).toString());
    setEditSkipStockTracking(!!product.skip_stock_tracking);
    
    // Parse suppliers if it's a JSON string, otherwise use as-is
    let parsedSuppliers: ProductSupplier[] = [];
    if (product.suppliers) {
      if (typeof product.suppliers === 'string') {
        try {
          parsedSuppliers = JSON.parse(product.suppliers);
        } catch {
          parsedSuppliers = [];
        }
      } else if (Array.isArray(product.suppliers)) {
        parsedSuppliers = product.suppliers;
      }
    }
    setEditSuppliers(parsedSuppliers);
    
    // Parse services if it's a JSON string, otherwise use as-is
    let parsedServices: ProductService[] = [];
    if (product.services) {
      if (typeof product.services === 'string') {
        try {
          parsedServices = JSON.parse(product.services);
        } catch {
          parsedServices = [];
        }
      } else if (Array.isArray(product.services)) {
        parsedServices = product.services;
      }
    }
    setEditServices(parsedServices);
    
    // Auto-suggest services based on category if no services exist
    if (parsedServices.length === 0) {
      const category = (product.category || "").toLowerCase().trim();
      if (category === "coffee") {
        setEditServices([{
          id: `service-${Date.now()}`,
          name: "Timpla",
          price: 5,
        }]);
      } else if (category === "cup noodle" || category === "cup noodles") {
        setEditServices([{
          id: `service-${Date.now()}`,
          name: "Hot Water",
          price: 3,
        }]);
      }
    }
    
    // Load available suppliers from database
    setIsLoadingSuppliers(true);
    try {
      const result = await expensesApi.getSuppliers();
      if (result.success && result.data) {
        setAvailableSuppliers(result.data);
      }
    } catch (error) {
      console.error("Error loading suppliers:", error);
    } finally {
      setIsLoadingSuppliers(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim() || !editPrice) return;

    // Validate price
    const priceValue = parseFloat(editPrice);
    if (isNaN(priceValue) || priceValue < 0) {
      toast({
        title: "Invalid Price",
        description: "Price must be a valid number greater than or equal to 0",
        variant: "destructive"
      });
      return;
    }

    // Validate supplier prices
    const invalidSupplier = editSuppliers.find((s) => {
      if (!s.name.trim()) return false; // Skip empty suppliers
      const piecePrice = s.price_per_piece ?? 0;
      const packPrice = s.price_per_pack ?? 0;
      return piecePrice < 0 || packPrice < 0;
    });

    if (invalidSupplier) {
      toast({
        title: "Invalid Supplier Price",
        description: "Supplier prices must be greater than or equal to 0",
        variant: "destructive"
      });
      return;
    }

    const validSuppliers = editSuppliers.filter((s) => s.name.trim() !== "");
    const validServices = editServices.filter((s) => s.name.trim() !== "" && s.price > 0);
    
    // Ensure category exists in database
    const categoryToSave = typeof editCategory === 'string' ? editCategory.trim() : editCategory;
    if (categoryToSave) {
      try {
        const allCats = await getAllCategoriesAsync();
        if (!allCats.includes(categoryToSave)) {
          await categoriesApi.create({
            name: categoryToSave,
            parent_id: null,
            is_parent: false,
            display_order: 999,
          });
          const updatedCategories = await getAllCategoriesAsync();
          setAllCategories(updatedCategories);
        }
      } catch (error) {
        console.error("Error ensuring category exists:", error);
        // Continue with product update even if category creation fails
      }
    }

    const result = await updateProduct(editingId, {
      name: editName.trim(),
      price: priceValue,
      category: categoryToSave,
      image_url: editImageUrl.trim() || undefined,
      stock_quantity: editSkipStockTracking ? undefined : (parseInt(editStockQuantity) || 0),
      low_stock_threshold: editSkipStockTracking ? undefined : (parseInt(editLowStockThreshold) || 5),
      skip_stock_tracking: editSkipStockTracking,
      suppliers: validSuppliers.length > 0 ? validSuppliers : undefined,
      services: validServices.length > 0 ? validServices : undefined,
    });

    if (result.success) {
      toast({ title: "Success", description: "Product updated successfully" });
      setEditingId(null);
    } else {
      toast({ title: "Error", description: result.error || "Failed to update product" });
    }
  };

  const handleDeleteClick = (id: string, name: string) => {
    // Check permissions
    if (!canDelete) {
      toast({ 
        title: "Permission denied", 
        description: "You do not have permission to delete products.",
        variant: "destructive"
      });
      return;
    }

    setProductToDelete({ id, name });
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!productToDelete) return;

    const result = await deleteProduct(productToDelete.id);

    if (result.success) {
      toast({ title: "Success", description: "Product deleted successfully" });
    } else {
      toast({ title: "Error", description: result.error || "Failed to delete product" });
    }

    setDeleteDialogOpen(false);
    setProductToDelete(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditPrice("");
    setEditCategory("Other");
    setShowEditNewCategory(false);
    setEditNewCategory("");
    setEditImageUrl("");
    setEditStockQuantity("");
    setEditLowStockThreshold("");
    setEditSkipStockTracking(false);
    setEditSuppliers([]);
    setAvailableSuppliers([]);
    setEditServices([]);
  };

  const handleAddService = () => {
    setEditServices([
      ...editServices,
      {
        id: `service-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: "",
        price: 0,
      },
    ]);
  };

  const handleRemoveService = (serviceId: string) => {
    setEditServices(editServices.filter((s) => s.id !== serviceId));
  };

  const handleServiceChange = (serviceId: string, field: keyof ProductService, value: string | number) => {
    setEditServices(
      editServices.map((s) =>
        s.id === serviceId
          ? {
              ...s,
              [field]: field === 'price' ? (typeof value === 'number' ? value : parseFloat(value.toString()) || 0) : value,
            }
          : s
      )
    );
  };

  const handleAddSupplier = () => {
    setEditSuppliers([
      ...editSuppliers,
      {
        id: `supplier-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: "",
        price_per_piece: undefined,
        price_per_pack: undefined,
      },
    ]);
  };

  const handleRemoveSupplier = (supplierId: string) => {
    setEditSuppliers(editSuppliers.filter((s) => s.id !== supplierId));
  };

  const handleSupplierChange = (supplierId: string, field: keyof ProductSupplier, value: string | number | undefined) => {
    // Validate price fields
    if (field === 'price_per_piece' || field === 'price_per_pack') {
      const numValue = typeof value === 'string' ? parseFloat(value) : value;
      if (numValue !== undefined && (isNaN(numValue) || numValue < 0)) {
        toast({
          title: "Invalid Price",
          description: "Supplier price must be a valid number greater than or equal to 0",
          variant: "destructive"
        });
        return;
      }
    }

    setEditSuppliers(
      editSuppliers.map((s) =>
        s.id === supplierId
          ? {
              ...s,
              [field]: value === "" ? undefined : value,
            }
          : s
      )
    );
  };

  // Restock from dialog - handles both base products and variations
  const handleRestockConfirm = async (
    variationId: string | null,
    type: 'add' | 'remove' | 'set',
    quantity: number,
    reason: string,
    restockData?: RestockData
  ) => {
    if (!stockAdjustProduct) return;

    try {
      // Process payment source if Store Funds is selected
      if (restockData?.paymentSource === "store_funds" && restockData?.unitCost) {
        const totalCost = quantity * restockData.unitCost;
        // Deduct from store funds (as expense/withdrawal from invested capital)
        const withdrawResult = await withdrawStoreFunds(totalCost, `Restock: ${stockAdjustProduct.name}`, "Restock");
        if (!withdrawResult.success) {
          toast({
            title: "Error",
            description: withdrawResult.error || "Failed to deduct funds from store",
            variant: "destructive",
          });
          return;
        }
        await refreshStoreFunds();
        await refreshAvailableFunds();
      }

      // Build restock info for API
      const restockInfo: RestockInfo | undefined = restockData ? {
        supplier: restockData.supplier,
        unitCost: restockData.unitCost,
        notes: restockData.notes,
      } : undefined;

      if (variationId) {
        // Restock a specific variation
        const variations = (() => {
          if (!stockAdjustProduct.variations) return [];
          if (Array.isArray(stockAdjustProduct.variations)) return stockAdjustProduct.variations;
          if (typeof stockAdjustProduct.variations === 'string') {
            try {
              return JSON.parse(stockAdjustProduct.variations);
            } catch {
              return [];
            }
          }
          return [];
        })();

        const variation = variations.find((v: any) => v.id === variationId);
        if (!variation) {
          toast({ 
            title: "Error", 
            description: "Variation not found", 
            variant: "destructive" 
          });
          return;
        }

        const currentStock = variation.stock_quantity ?? 0;
        let newStock = currentStock;
        if (type === 'add') {
          newStock = currentStock + quantity;
        } else if (type === 'remove') {
          newStock = Math.max(0, currentStock - quantity);
        } else if (type === 'set') {
          newStock = quantity;
        }

        // Update the variation's stock
        variation.stock_quantity = newStock;

        // Update the product with the modified variations
        const variationsJson = JSON.stringify(variations);
        const updateResult = await productsApi.update(stockAdjustProduct.id, {
          variations: variationsJson,
        });

        if (updateResult.success) {
          // Record stock adjustment with base product ID (for history tracking)
          await stockApi.adjustStock(
            stockAdjustProduct.id,
            type,
            quantity,
            currentStock,
            `${reason} (Variation: ${variation.name || variationId})`,
            restockInfo
          );

          // Create expense record if unit cost is provided (tagged as "restock")
          if (restockData?.unitCost && restockData.unitCost > 0) {
            const totalCost = quantity * restockData.unitCost;
            await expensesApi.create({
              product_id: stockAdjustProduct.id,
              product_name: `${stockAdjustProduct.name} (Variation: ${variation.name || variationId})`,
              quantity: quantity,
              unit_cost: restockData.unitCost,
              total_cost: totalCost,
              supplier: restockData.supplier || undefined,
              notes: restockData.notes || undefined,
              category: "restock",
              payment_source: restockData.paymentSource || "cash",
            });
          }

          const costInfo = restockData?.unitCost 
            ? ` (₱${(quantity * restockData.unitCost).toFixed(2)} total)`
            : '';

          toast({ 
            title: "Stock Updated", 
            description: `Added ${quantity} units to ${stockAdjustProduct.name} variation${costInfo}` 
          });

          // Refresh products to get updated data
          await refreshProducts();
        } else {
          toast({ 
            title: "Error", 
            description: "Failed to update variation stock", 
            variant: "destructive" 
          });
        }
      } else {
        // Restock base product
        const currentStock = stockAdjustProduct.stock_quantity ?? 0;
        const result = await stockApi.adjustStock(
          stockAdjustProduct.id,
          type,
          quantity,
          currentStock,
          reason,
          restockInfo
        );

        if (result.success) {
          const newStock = currentStock + quantity;
          await updateProduct(stockAdjustProduct.id, { stock_quantity: newStock });
          
          // Create expense record if unit cost is provided (tagged as "restock")
          if (restockData?.unitCost && restockData.unitCost > 0) {
            const totalCost = quantity * restockData.unitCost;
            await expensesApi.create({
              product_id: stockAdjustProduct.id,
              product_name: stockAdjustProduct.name,
              quantity: quantity,
              unit_cost: restockData.unitCost,
              total_cost: totalCost,
              supplier: restockData.supplier || undefined,
              notes: restockData.notes || undefined,
              category: "restock",
              payment_source: restockData.paymentSource || "cash",
            });
          }
          
          const costInfo = restockData?.unitCost 
            ? ` (₱${(quantity * restockData.unitCost).toFixed(2)} total)`
            : '';
          
          toast({ 
            title: "Stock Updated", 
            description: `Added ${quantity} units to ${stockAdjustProduct.name}${costInfo}` 
          });

          // Refresh products to get updated data
          await refreshProducts();
        } else {
          toast({ 
            title: "Error", 
            description: "Failed to update stock", 
            variant: "destructive" 
          });
        }
      }
    } catch (error) {
      console.error("Error restocking:", error);
      toast({ 
        title: "Error", 
        description: "An error occurred while restocking", 
        variant: "destructive" 
      });
    } finally {
      setStockAdjustProduct(null);
    }
  };

  // Selection handlers
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredProducts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredProducts.map((p) => p.id)));
    }
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleBulkCategoryUpdate = async () => {
    if (selectedIds.size === 0) return;

    setIsBulkUpdating(true);
    let successCount = 0;
    let failCount = 0;

    for (const id of selectedIds) {
      const result = await updateProduct(id, { category: bulkCategory });
      if (result.success) {
        successCount++;
      } else {
        failCount++;
      }
    }

    setIsBulkUpdating(false);

    if (failCount === 0) {
      toast({
        title: "Success",
        description: `Updated ${successCount} product${successCount > 1 ? "s" : ""} to "${bulkCategory}"`,
      });
    } else {
      toast({
        title: "Partial Success",
        description: `Updated ${successCount} products, ${failCount} failed`,
      });
    }

    setSelectedIds(new Set());
  };

  const handleBulkPriceUpdate = async () => {
    if (selectedIds.size === 0 || !bulkPrice.trim()) {
      toast({
        title: "Error",
        description: "Please select products and enter a price",
        variant: "destructive"
      });
      return;
    }

    const priceValue = parseFloat(bulkPrice);
    if (isNaN(priceValue) || priceValue < 0) {
      toast({
        title: "Invalid Price",
        description: "Price must be a valid number greater than or equal to 0",
        variant: "destructive"
      });
      return;
    }

    setIsBulkUpdating(true);
    let successCount = 0;
    let failCount = 0;

    for (const id of selectedIds) {
      const result = await updateProduct(id, { price: priceValue });
      if (result.success) {
        successCount++;
      } else {
        failCount++;
      }
    }

    setIsBulkUpdating(false);

    if (failCount === 0) {
      toast({
        title: "Success",
        description: `Updated price to ₱${priceValue.toFixed(2)} for ${successCount} product${successCount > 1 ? "s" : ""}`,
      });
    } else {
      toast({
        title: "Partial Success",
        description: `Updated ${successCount} products, ${failCount} failed`,
      });
    }

    setSelectedIds(new Set());
    setBulkPrice("");
    setShowBulkPriceUpdate(false);
  };

  const handleBulkSupplierUpdate = async () => {
    if (selectedIds.size === 0 || !bulkSupplier || !bulkSupplier.name.trim()) {
      toast({
        title: "Error",
        description: "Please select products and enter supplier information",
        variant: "destructive"
      });
      return;
    }

    // Validate supplier prices
    const piecePrice = bulkSupplier.price_per_piece ?? 0;
    const packPrice = bulkSupplier.price_per_pack ?? 0;
    if (piecePrice < 0 || packPrice < 0) {
      toast({
        title: "Invalid Supplier Price",
        description: "Supplier prices must be greater than or equal to 0",
        variant: "destructive"
      });
      return;
    }

    setIsBulkUpdating(true);
    let successCount = 0;
    let failCount = 0;

    for (const id of selectedIds) {
      const product = products.find(p => p.id === id);
      if (!product) {
        failCount++;
        continue;
      }

      // Get existing suppliers
      let existingSuppliers: ProductSupplier[] = [];
      if (product.suppliers) {
        if (typeof product.suppliers === 'string') {
          try {
            existingSuppliers = JSON.parse(product.suppliers);
          } catch {
            existingSuppliers = [];
          }
        } else if (Array.isArray(product.suppliers)) {
          existingSuppliers = product.suppliers;
        }
      }

      // Check if supplier already exists
      const existingIndex = existingSuppliers.findIndex(s => s.name === bulkSupplier.name);
      if (existingIndex >= 0) {
        // Update existing supplier
        existingSuppliers[existingIndex] = { ...bulkSupplier };
      } else {
        // Add new supplier
        existingSuppliers.push({
          ...bulkSupplier,
          id: `supplier-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        });
      }

      const result = await updateProduct(id, { suppliers: existingSuppliers });
      if (result.success) {
        successCount++;
      } else {
        failCount++;
      }
    }

    setIsBulkUpdating(false);

    if (failCount === 0) {
      toast({
        title: "Success",
        description: `Updated supplier for ${successCount} product${successCount > 1 ? "s" : ""}`,
      });
    } else {
      toast({
        title: "Partial Success",
        description: `Updated ${successCount} products, ${failCount} failed`,
      });
    }

    setSelectedIds(new Set());
    setBulkSupplier(null);
    setShowBulkSupplierUpdate(false);
  };

  const handleRefresh = async () => {
    await refreshProducts();
    toast({ title: "Refreshed", description: "Products reloaded from database" });
  };

  const isAllSelected = filteredProducts.length > 0 && selectedIds.size === filteredProducts.length;
  const isSomeSelected = selectedIds.size > 0 && selectedIds.size < filteredProducts.length;

  const getStockColor = (product: Product) => {
    const stock = product.stock_quantity ?? 0;
    const threshold = product.low_stock_threshold ?? 5;
    if (stock === 0) return "text-destructive";
    if (stock <= threshold) return "text-warning";
    return "text-success";
  };

  const getStockBg = (product: Product) => {
    const stock = product.stock_quantity ?? 0;
    const threshold = product.low_stock_threshold ?? 5;
    if (stock === 0) return "bg-destructive/10";
    if (stock <= threshold) return "bg-warning/10";
    return "bg-success/10";
  };

  // Check if we should show seed option (database empty but have initial products)
  const showSeedOption = products.length === 0 && !isLoading && isOnline;

  return (
    <div className="min-h-screen bg-background p-6 pb-24">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Link to="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <Button 
              variant="ghost" 
              size="icon" 
              title="Category Management"
              onClick={() => setShowCategoryManagement(true)}
            >
              <Tag className="w-5 h-5" />
            </Button>
            <Link to="/settings">
              <Button variant="ghost" size="icon" title="Settings">
                <Settings className="w-5 h-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/20 rounded-lg">
                <Package className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Product Management</h1>
                <p className="text-sm text-muted-foreground">
                  {products.length} products • {isOnline ? "Online" : "Offline"}
                </p>
              </div>
            </div>
            {/* Connection Status */}
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm ${
              isOnline ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'
            }`}>
              {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
              {isOnline ? 'Synced' : 'Offline'}
            </div>
            {lowStockCount > 0 && (
              <button
                onClick={() => setShowLowStockOnly(!showLowStockOnly)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors ${
                  showLowStockOnly
                    ? 'bg-destructive text-destructive-foreground'
                    : 'bg-destructive/20 text-destructive hover:bg-destructive/30'
                }`}
              >
                <AlertTriangle className="w-4 h-4" />
                {lowStockCount} Low Stock
              </button>
            )}
            <div className="ml-auto flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={handleRefresh}
                disabled={isLoading}
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button size="sm" className="gap-2" onClick={() => setShowAddForm(true)}>
                <Plus className="w-4 h-4" />
                Add Product
              </Button>
            </div>
          </div>

          {/* Search and Filter */}
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products..."
                className="w-full pl-10 pr-4 py-2 bg-input rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as ProductCategory | "All")}
                className="pl-10 pr-8 py-2 bg-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none cursor-pointer"
              >
                <option value="All">All Categories</option>
                {allCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </header>

        {/* Empty State - Seed Products Option */}
        {showSeedOption && (
          <div className="glass-panel rounded-lg p-8 text-center animate-fade-in">
            <Database className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No Products in Database</h3>
            <p className="text-muted-foreground mb-6">
              Would you like to seed the database with {initialProducts.length} initial products?
            </p>
            <div className="flex gap-3 justify-center">
              <Button
                onClick={seedInitialProducts}
                disabled={isSeeding}
                className="gap-2"
              >
                {isSeeding ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Package className="w-4 h-4" />
                )}
                Seed {initialProducts.length} Products
              </Button>
              <Button variant="outline" onClick={() => setShowAddForm(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                Add Manually
              </Button>
            </div>
          </div>
        )}

        {/* Add Product Form */}
        {showAddForm && (
          <div className="glass-panel rounded-lg p-4 mb-6 animate-fade-in">
            <h3 className="font-semibold text-foreground mb-4">Add New Product</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Product name"
                className="px-4 py-2 bg-input rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                autoFocus
              />
              {showNewCategory ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    placeholder="Enter new category"
                    className="flex-1 px-4 py-2 bg-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newCategory.trim()) {
                        const newCat = newCategory.trim();
                        // Create category in database
                        categoriesApi.create({
                          name: newCat,
                          parent_id: null,
                          is_parent: false,
                          display_order: 999,
                        }).then(async () => {
                          const updatedCategories = await getAllCategoriesAsync();
                          setAllCategories(updatedCategories);
                          setNewCategory(newCat);
                          setShowNewCategory(false);
                        }).catch((error) => {
                          console.error("Error creating category:", error);
                          // Still update UI even if API call fails
                          setNewCategory(newCat);
                          setShowNewCategory(false);
                        });
                      } else if (e.key === "Escape") {
                        setShowNewCategory(false);
                        setNewCategory("Other");
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                    if (newCategory.trim()) {
                      const newCat = newCategory.trim();
                      // Create category in database
                      categoriesApi.create({
                        name: newCat,
                        parent_id: null,
                        is_parent: false,
                        display_order: 999,
                      }).then(async () => {
                        const updatedCategories = await getAllCategoriesAsync();
                        setAllCategories(updatedCategories);
                        setNewCategory(newCat);
                        setShowNewCategory(false);
                      }).catch((error) => {
                        console.error("Error creating category:", error);
                        // Still update UI even if API call fails
                        setNewCategory(newCat);
                        setShowNewCategory(false);
                      });
                    }
                    }}
                    className="gap-2"
                  >
                    Add
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowNewCategory(false);
                      setNewCategory("Other");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="flex-1 px-4 py-2 bg-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    {allCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowNewCategory(true)}
                    className="gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    New
                  </Button>
                </div>
              )}
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₱</span>
                <input
                  type="number"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  placeholder="0.00 (optional)"
                  step="0.01"
                  min="0"
                  className="w-full pl-8 pr-4 py-2 bg-input rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div className="relative">
                <Image className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={newImageUrl}
                  onChange={(e) => setNewImageUrl(e.target.value)}
                  placeholder="Image URL or base64 data (optional)"
                  className="w-full pl-10 pr-4 py-2 bg-input rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <p className="text-xs text-muted-foreground mt-1 ml-10">
                  Supports: https://... or data:image/...;base64,...
                </p>
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground block mb-1">Stock</label>
                  <input
                    type="number"
                    value={newStockQuantity}
                    onChange={(e) => setNewStockQuantity(e.target.value)}
                    placeholder="0"
                    min="0"
                    disabled={newSkipStockTracking}
                    className="w-full px-4 py-2 bg-input rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground block mb-1">Low Alert</label>
                  <input
                    type="number"
                    value={newLowStockThreshold}
                    onChange={(e) => setNewLowStockThreshold(e.target.value)}
                    placeholder="5"
                    min="0"
                    disabled={newSkipStockTracking}
                    className="w-full px-4 py-2 bg-input rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={newSkipStockTracking}
                  onChange={(e) => setNewSkipStockTracking(e.target.checked)}
                  className="rounded border-border"
                />
                <span>Always available (skip stock tracking)</span>
              </label>
              <div className="flex gap-2 items-end">
                <Button onClick={handleAdd} className="gap-2">
                  <Plus className="w-4 h-4" />
                  Add
                </Button>
                <Button variant="outline" onClick={() => setShowAddForm(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-12">
            <RefreshCw className="w-8 h-8 text-primary animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading products...</p>
          </div>
        )}

        {/* Product List */}
        {!isLoading && !showSeedOption && (
          <div className="space-y-6">
            {groupedProducts.length === 0 ? (
              <div className="text-center py-12">
                <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No products found</p>
              </div>
            ) : (
              groupedProducts.map(({ category, products: categoryProducts }) => (
                <div key={category} className="glass-panel rounded-lg overflow-hidden">
                  <div className="bg-secondary/50 px-4 py-2 border-b border-border/50">
                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4 text-primary" />
                      <span className="font-medium text-foreground">{category}</span>
                      <span className="text-sm text-muted-foreground">
                        ({categoryProducts.length})
                      </span>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-sm text-muted-foreground border-b border-border/30">
                          <th className="p-3 w-10">
                            <button
                              onClick={toggleSelectAll}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              {isAllSelected ? (
                                <CheckSquare className="w-4 h-4" />
                              ) : isSomeSelected ? (
                                <CheckSquare className="w-4 h-4 opacity-50" />
                              ) : (
                                <Square className="w-4 h-4" />
                              )}
                            </button>
                          </th>
                          <th className="p-3">Product</th>
                          <th className="p-3">Price</th>
                          <th className="p-3">Stock</th>
                          <th className="p-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {categoryProducts.map((product) => (
                          <tr
                            key={product.id}
                            className={`border-b border-border/20 hover:bg-secondary/30 transition-colors ${
                              selectedIds.has(product.id) ? "bg-primary/10" : ""
                            }`}
                          >
                            <td className="p-3">
                              <button
                                onClick={() => toggleSelect(product.id)}
                                className="text-muted-foreground hover:text-foreground"
                              >
                                {selectedIds.has(product.id) ? (
                                  <CheckSquare className="w-4 h-4 text-primary" />
                                ) : (
                                  <Square className="w-4 h-4" />
                                )}
                              </button>
                            </td>
                            <td className="p-3">
                              {editingId === product.id ? (
                                <div className="flex flex-col gap-2">
                                  <input
                                    type="text"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    className="px-2 py-1 bg-input rounded text-foreground text-sm w-full"
                                    autoFocus
                                  />
                                  <div className="flex gap-2">
                                    {showEditNewCategory ? (
                                      <div className="flex gap-2 flex-1">
                                        <input
                                          type="text"
                                          value={editNewCategory}
                                          onChange={(e) => setEditNewCategory(e.target.value)}
                                          placeholder="Enter new category"
                                          className="flex-1 px-2 py-1 bg-input rounded text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                          autoFocus
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter" && editNewCategory.trim()) {
                                              const newCat = editNewCategory.trim();
                                              // Create category in database
                                              categoriesApi.create({
                                                name: newCat,
                                                parent_id: null,
                                                is_parent: false,
                                                display_order: 999,
                                              }).then(async () => {
                                                const updatedCategories = await getAllCategoriesAsync();
                                                setAllCategories(updatedCategories);
                                                setEditCategory(newCat);
                                                setShowEditNewCategory(false);
                                                setEditNewCategory("");
                                              }).catch((error) => {
                                                console.error("Error creating category:", error);
                                                // Still update UI even if API call fails
                                                setEditCategory(newCat);
                                                setShowEditNewCategory(false);
                                                setEditNewCategory("");
                                              });
                                            } else if (e.key === "Escape") {
                                              setShowEditNewCategory(false);
                                              setEditNewCategory("");
                                            }
                                          }}
                                        />
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          onClick={() => {
                                            if (editNewCategory.trim()) {
                                              const newCat = editNewCategory.trim();
                                              // Create category in database
                                              categoriesApi.create({
                                                name: newCat,
                                                parent_id: null,
                                                is_parent: false,
                                                display_order: 999,
                                              }).then(async () => {
                                                const updatedCategories = await getAllCategoriesAsync();
                                                setAllCategories(updatedCategories);
                                                setEditCategory(newCat);
                                                setShowEditNewCategory(false);
                                                setEditNewCategory("");
                                              }).catch((error) => {
                                                console.error("Error creating category:", error);
                                                // Still update UI even if API call fails
                                                setEditCategory(newCat);
                                                setShowEditNewCategory(false);
                                                setEditNewCategory("");
                                              });
                                            }
                                          }}
                                          className="h-8 px-2 text-xs"
                                        >
                                          Add
                                        </Button>
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          onClick={() => {
                                            setShowEditNewCategory(false);
                                            setEditNewCategory("");
                                          }}
                                          className="h-8 px-2 text-xs"
                                        >
                                          Cancel
                                        </Button>
                                      </div>
                                    ) : (
                                      <>
                                        <select
                                          value={editCategory}
                                          onChange={(e) =>
                                            setEditCategory(e.target.value)
                                          }
                                          className="px-2 py-1 bg-input rounded text-foreground text-sm"
                                        >
                                          {allCategories.map((cat) => (
                                            <option key={cat} value={cat}>
                                              {cat}
                                            </option>
                                          ))}
                                        </select>
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          onClick={() => setShowEditNewCategory(true)}
                                          className="h-8 px-2 text-xs gap-1"
                                        >
                                          <Plus className="w-3 h-3" />
                                          New
                                        </Button>
                                      </>
                                    )}
                                    <input
                                      type="text"
                                      value={editImageUrl}
                                      onChange={(e) => setEditImageUrl(e.target.value)}
                                      placeholder="Image URL or base64 data"
                                      className="px-2 py-1 bg-input rounded text-foreground text-sm flex-1"
                                    />
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center gap-3">
                                  {product.image_url ? (
                                    <img
                                      src={product.image_url}
                                      alt={product.name}
                                      className="w-10 h-10 object-cover rounded-lg"
                                      onError={(e) =>
                                        (e.currentTarget.style.display = "none")
                                      }
                                    />
                                  ) : (
                                    <div className="w-10 h-10 bg-secondary rounded-lg flex items-center justify-center">
                                      <Package className="w-5 h-5 text-muted-foreground/50" />
                                    </div>
                                  )}
                                  <span className="font-medium text-foreground">
                                    {product.name}
                                  </span>
                                </div>
                              )}
                            </td>
                            <td className="p-3">
                              {editingId === product.id ? (
                                <input
                                  type="number"
                                  value={editPrice}
                                  onChange={(e) => setEditPrice(e.target.value)}
                                  step="0.01"
                                  className="px-2 py-1 bg-input rounded text-foreground text-sm w-24"
                                />
                              ) : (
                                <div className="flex flex-col gap-1">
                                  <span className="text-primary font-mono">
                                    ₱{product.price.toFixed(2)}
                                  </span>
                                  {/* Show variations if any */}
                                  {(() => {
                                    // Ensure variations is an array
                                    let variations: any[] = [];
                                    if (product.variations) {
                                      if (Array.isArray(product.variations)) {
                                        variations = product.variations;
                                      } else if (typeof product.variations === 'string') {
                                        try {
                                          variations = JSON.parse(product.variations);
                                        } catch {
                                          variations = [];
                                        }
                                      }
                                    }
                                    
                                    if (variations.length > 0) {
                                      // Filter out invalid variations and ensure they have a price
                                      const validVariations = variations.filter((v: any) => v && typeof v.price === 'number' && v.price > 0);
                                      
                                      if (validVariations.length > 0) {
                                        return (
                                          <div className="flex flex-col gap-1">
                                            {validVariations.map((variation, idx) => (
                                              <div 
                                                key={variation.id || idx}
                                                className="flex items-center gap-2 group"
                                              >
                                                <span className="text-xs text-muted-foreground font-mono">
                                                  {variation.name ? `${variation.name}: ` : ''}₱{variation.price.toFixed(2)}
                                                </span>
                                                <button
                                                  onClick={() => setEditingVariation({ product, variation })}
                                                  disabled={!isOnline}
                                                  className="opacity-0 group-hover:opacity-100 p-1 rounded bg-info/20 hover:bg-info/30 text-info disabled:opacity-30 transition-all"
                                                  title="Edit variation"
                                                >
                                                  <Edit className="w-3 h-3" />
                                                </button>
                                              </div>
                                            ))}
                                          </div>
                                        );
                                      }
                                    }
                                    return null;
                                  })()}
                                </div>
                              )}
                            </td>
                            <td className="p-3">
                              {editingId === product.id ? (
                                <div className="flex flex-col gap-2">
                                  <div className="flex gap-2">
                                    <input
                                      type="number"
                                      value={editStockQuantity}
                                      onChange={(e) => setEditStockQuantity(e.target.value)}
                                      className="px-2 py-1 bg-input rounded text-foreground text-sm w-16 disabled:opacity-50"
                                      placeholder="Stock"
                                      disabled={editSkipStockTracking}
                                    />
                                    <input
                                      type="number"
                                      value={editLowStockThreshold}
                                      onChange={(e) => setEditLowStockThreshold(e.target.value)}
                                      className="px-2 py-1 bg-input rounded text-foreground text-sm w-16 disabled:opacity-50"
                                      placeholder="Alert"
                                      disabled={editSkipStockTracking}
                                    />
                                  </div>
                                  <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={editSkipStockTracking}
                                      onChange={(e) => setEditSkipStockTracking(e.target.checked)}
                                      className="rounded border-border"
                                    />
                                    <span>Always available (skip stock tracking)</span>
                                  </label>
                                  {/* Suppliers Section */}
                                  <div className="mt-3 pt-3 border-t border-border">
                                    <div className="flex items-center justify-between mb-2">
                                      <label className="text-xs font-medium text-muted-foreground">
                                        Suppliers (Optional)
                                      </label>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={handleAddSupplier}
                                        className="h-6 px-2 text-xs gap-1"
                                      >
                                        <Plus className="w-3 h-3" />
                                        Add
                                      </Button>
                                    </div>
                                    {editSuppliers.length === 0 ? (
                                      <p className="text-xs text-muted-foreground py-1">
                                        No suppliers added. Click "Add" to add one.
                                      </p>
                                    ) : (
                                      <div className="space-y-2">
                                        {editSuppliers.map((supplier) => (
                                          <div
                                            key={supplier.id}
                                            className="p-2 bg-secondary/30 rounded border border-border/50"
                                          >
                                            <div className="flex items-start justify-between gap-2 mb-2">
                                              <div className="flex-1 flex gap-2">
                                                {supplier.name && !availableSuppliers.includes(supplier.name) ? (
                                                  <input
                                                    type="text"
                                                    value={supplier.name}
                                                    onChange={(e) =>
                                                      handleSupplierChange(supplier.id, "name", e.target.value)
                                                    }
                                                    className="flex-1 px-2 py-1 bg-input rounded text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/50"
                                                    placeholder="Enter supplier name..."
                                                  />
                                                ) : (
                                                  <select
                                                    value={supplier.name || ""}
                                                    onChange={(e) =>
                                                      handleSupplierChange(supplier.id, "name", e.target.value || undefined)
                                                    }
                                                    className="flex-1 px-2 py-1 bg-input rounded text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/50"
                                                    disabled={isLoadingSuppliers}
                                                  >
                                                    <option value="">Select supplier...</option>
                                                    {availableSuppliers.map((s) => (
                                                      <option key={s} value={s}>
                                                        {s}
                                                      </option>
                                                    ))}
                                                  </select>
                                                )}
                                              </div>
                                              <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleRemoveSupplier(supplier.id)}
                                                className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                              >
                                                <Trash2 className="w-3 h-3" />
                                              </Button>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                              <div>
                                                <label className="block text-xs text-muted-foreground mb-0.5">
                                                  Price per Piece (₱)
                                                </label>
                                                <div className="relative">
                                                  <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-xs">
                                                    ₱
                                                  </span>
                                                  <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    value={supplier.price_per_piece || ""}
                                                    onChange={(e) =>
                                                      handleSupplierChange(
                                                        supplier.id,
                                                        "price_per_piece",
                                                        e.target.value ? parseFloat(e.target.value) : undefined
                                                      )
                                                    }
                                                    className="w-full pl-5 pr-1.5 py-1 bg-input rounded text-foreground font-mono text-xs focus:outline-none focus:ring-2 focus:ring-primary/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                    placeholder="0.00"
                                                  />
                                                </div>
                                              </div>
                                              <div>
                                                <label className="block text-xs text-muted-foreground mb-0.5">
                                                  Price per Pack (₱)
                                                </label>
                                                <div className="relative">
                                                  <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-xs">
                                                    ₱
                                                  </span>
                                                  <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    value={supplier.price_per_pack || ""}
                                                    onChange={(e) =>
                                                      handleSupplierChange(
                                                        supplier.id,
                                                        "price_per_pack",
                                                        e.target.value ? parseFloat(e.target.value) : undefined
                                                      )
                                                    }
                                                    className="w-full pl-5 pr-1.5 py-1 bg-input rounded text-foreground font-mono text-xs focus:outline-none focus:ring-2 focus:ring-primary/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                    placeholder="0.00"
                                                  />
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  {product.skip_stock_tracking ? (
                                    <>
                                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-success/20 text-success">
                                        ∞ Always
                                      </span>
                                      <button
                                        onClick={() => {
                                          // Check if product is GCASH
                                          const isGcash = product.name.toUpperCase() === "GCASH" || product.name.toUpperCase() === "GCASH SERVICE";
                                          if (isGcash) {
                                            setShowAddGcashFunds(true);
                                          } else {
                                            setExpenseProduct(product);
                                          }
                                        }}
                                        disabled={!isOnline}
                                        className="p-1.5 rounded bg-primary/20 hover:bg-primary/30 text-primary disabled:opacity-50 transition-colors"
                                        title={product.name.toUpperCase() === "GCASH" || product.name.toUpperCase() === "GCASH SERVICE" ? "Add Funds" : "Add Expense"}
                                      >
                                        <Receipt className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => setHistoryProduct(product)}
                                        className="p-1.5 rounded bg-secondary hover:bg-secondary/80 text-muted-foreground transition-colors"
                                        title="View history"
                                      >
                                        <History className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => setVariationProduct(product)}
                                        disabled={!isOnline}
                                        className="p-1.5 rounded bg-info/20 hover:bg-info/30 text-info disabled:opacity-50 transition-colors"
                                        title="Add price variation"
                                      >
                                        <Layers className="w-4 h-4" />
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <span className={`px-2 py-1 rounded-full text-xs font-medium min-w-[60px] text-center ${getStockBg(product)} ${getStockColor(product)}`}>
                                        {product.stock_quantity ?? 0}
                                      </span>
                                      <button
                                        onClick={() => setStockAdjustProduct(product)}
                                        disabled={!isOnline}
                                        className="p-1.5 rounded bg-success/20 hover:bg-success/30 text-success disabled:opacity-50 transition-colors"
                                        title="Restock"
                                      >
                                        <Truck className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => setStockHistoryProduct(product)}
                                        className="p-1.5 rounded bg-secondary hover:bg-secondary/80 text-muted-foreground transition-colors"
                                        title="View history"
                                      >
                                        <History className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => setVariationProduct(product)}
                                        disabled={!isOnline}
                                        className="p-1.5 rounded bg-info/20 hover:bg-info/30 text-info disabled:opacity-50 transition-colors"
                                        title="Add price variation"
                                      >
                                        <Layers className="w-4 h-4" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="p-3 text-right">
                              <div className="flex gap-1 justify-end">
                                {editingId === product.id ? (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={handleSaveEdit}
                                      className="h-8 w-8 text-success"
                                    >
                                      <Save className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={handleCancelEdit}
                                      className="h-8 w-8 text-muted-foreground"
                                    >
                                      <X className="w-4 h-4" />
                                    </Button>
                                  </>
                                ) : (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleEdit(product)}
                                      className="h-8 w-8"
                                    >
                                      <Pencil className="w-4 h-4" />
                                    </Button>
                                    {canDelete && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleDeleteClick(product.id, product.name)}
                                        className="h-8 w-8 text-destructive"
                                        disabled={!isOnline}
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    )}
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Bulk Action Bar */}
        {selectedIds.size > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 glass-panel rounded-lg px-4 py-3 flex items-center gap-4 shadow-lg animate-fade-in z-50">
            <span className="text-sm text-foreground">
              {selectedIds.size} selected
            </span>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Change to:</span>
              <select
                value={bulkCategory}
                onChange={(e) => setBulkCategory(e.target.value as ProductCategory)}
                className="px-2 py-1 bg-input rounded text-foreground text-sm"
              >
                {allCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                onClick={handleBulkCategoryUpdate}
                disabled={isBulkUpdating || !isOnline}
                className="gap-1"
              >
                {isBulkUpdating ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : (
                  <Tag className="w-3 h-3" />
                )}
                Apply
              </Button>
            </div>
            {showBulkPriceUpdate ? (
              <div className="flex gap-2 items-center">
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-xs">₱</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={bulkPrice}
                    onChange={(e) => setBulkPrice(e.target.value)}
                    placeholder="0.00"
                    className="px-6 py-1 bg-input rounded text-foreground text-sm w-24 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    autoFocus
                  />
                </div>
                <Button
                  size="sm"
                  onClick={handleBulkPriceUpdate}
                  disabled={isBulkUpdating || !isOnline}
                  className="gap-1"
                >
                  {isBulkUpdating ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <Tag className="w-3 h-3" />
                  )}
                  Apply
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowBulkPriceUpdate(false);
                    setBulkPrice("");
                  }}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ) : showBulkSupplierUpdate ? (
              <div className="flex gap-2 items-center">
                <div className="flex gap-2">
                  <select
                    value={bulkSupplier?.name || ""}
                    onChange={(e) => {
                      const name = e.target.value;
                      if (name) {
                        setBulkSupplier({
                          id: `bulk-supplier-${Date.now()}`,
                          name,
                          price_per_piece: bulkSupplier?.price_per_piece,
                          price_per_pack: bulkSupplier?.price_per_pack,
                        });
                      }
                    }}
                    className="px-2 py-1 bg-input rounded text-foreground text-sm"
                  >
                    <option value="">Select supplier...</option>
                    {availableSuppliers.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <div className="relative">
                    <span className="absolute left-1 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-xs">₱</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={bulkSupplier?.price_per_piece || ""}
                      onChange={(e) => {
                        setBulkSupplier({
                          ...bulkSupplier!,
                          price_per_piece: e.target.value ? parseFloat(e.target.value) : undefined,
                        });
                      }}
                      placeholder="Per piece"
                      className="px-5 py-1 bg-input rounded text-foreground text-xs w-20 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                  <div className="relative">
                    <span className="absolute left-1 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-xs">₱</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={bulkSupplier?.price_per_pack || ""}
                      onChange={(e) => {
                        setBulkSupplier({
                          ...bulkSupplier!,
                          price_per_pack: e.target.value ? parseFloat(e.target.value) : undefined,
                        });
                      }}
                      placeholder="Per pack"
                      className="px-5 py-1 bg-input rounded text-foreground text-xs w-20 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={handleBulkSupplierUpdate}
                  disabled={isBulkUpdating || !isOnline || !bulkSupplier?.name}
                  className="gap-1"
                >
                  {isBulkUpdating ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <Tag className="w-3 h-3" />
                  )}
                  Apply
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowBulkSupplierUpdate(false);
                    setBulkSupplier(null);
                  }}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowBulkPriceUpdate(true);
                    setShowBulkSupplierUpdate(false);
                  }}
                  disabled={selectedIds.size === 0 || !isOnline}
                  className="gap-1"
                >
                  <Tag className="w-3 h-3" />
                  Price
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowBulkSupplierUpdate(true);
                    setShowBulkPriceUpdate(false);
                    if (!bulkSupplier) {
                      setBulkSupplier({
                        id: `bulk-supplier-${Date.now()}`,
                        name: "",
                        price_per_piece: undefined,
                        price_per_pack: undefined,
                      });
                    }
                  }}
                  disabled={selectedIds.size === 0 || !isOnline}
                  className="gap-1"
                >
                  <Truck className="w-3 h-3" />
                  Supplier
                </Button>
                <div className="h-4 w-px bg-border" />
                <Button variant="ghost" size="sm" onClick={clearSelection}>
                  <X className="w-4 h-4" />
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{productToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setDeleteDialogOpen(false);
              setProductToDelete(null);
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Stock Adjustment Dialog - handles both base products and variations */}
      {stockAdjustProduct && (
        <StockAdjustmentDialog
          product={stockAdjustProduct}
          availableFunds={availableFunds}
          onCancel={() => setStockAdjustProduct(null)}
          onConfirm={handleRestockConfirm}
        />
      )}

      {/* Stock History Dialog */}
      {stockHistoryProduct && (
        <StockHistoryDialog
          product={stockHistoryProduct}
          onClose={() => setStockHistoryProduct(null)}
        />
      )}

      {/* Add Expense Dialog */}
      {expenseProduct && (
        <AddExpenseDialog
          product={expenseProduct}
          availableFunds={availableFunds}
          onClose={() => setExpenseProduct(null)}
          onSuccess={async () => {
            await refreshAvailableFunds();
          }}
        />
      )}

      {/* Add GCash Funds Dialog */}
      {showAddGcashFunds && (
        <AddGCashFundsDialog
          currentCreditsBalance={gcashCredits}
          currentCashBalance={gcashCash}
          onConfirm={(amount, fundType, notes) => {
            const result = addFunds(amount, fundType, notes);
            if (result.success) {
              setShowAddGcashFunds(false);
              toast({
                title: "Funds Added",
                description: `₱${amount.toFixed(2)} added to GCash ${fundType === "credits" ? "Credits" : "Cash"} | New Credits: ₱${result.creditsBalance.toFixed(2)} | Cash: ₱${result.cashBalance.toFixed(2)}`,
              });
            }
          }}
          onCancel={() => setShowAddGcashFunds(false)}
        />
      )}

      {/* Add Product Variation Dialog */}
      {variationProduct && (
        <AddProductVariationDialog
          product={variationProduct}
          onConfirm={async (price, variationName, stockQuantity) => {
            // Get existing variations or create empty array
            // Parse variations if it's a string (from database)
            let existingVariations: any[] = [];
            if (variationProduct.variations) {
              if (Array.isArray(variationProduct.variations)) {
                existingVariations = variationProduct.variations;
              } else if (typeof variationProduct.variations === 'string') {
                try {
                  existingVariations = JSON.parse(variationProduct.variations);
                } catch (e) {
                  console.error("Error parsing variations:", e);
                  existingVariations = [];
                }
              }
            }
            
            // Filter valid variations for duplicate checking
            const validVariations = existingVariations.filter((v: any) => v && typeof v.price === 'number' && v.price > 0);
            
            // Check for duplicate: same name AND same price
            const finalName = variationName.trim();
            const duplicateExists = validVariations.some((v: any) => {
              const vName = v.name ? v.name.trim() : '';
              const vPrice = typeof v.price === 'number' ? v.price : 0;
              // Compare names (case-insensitive) and prices (exact match with tolerance)
              return vName.toLowerCase() === finalName.toLowerCase() && 
                     Math.abs(vPrice - price) < 0.01; // Allow for floating point precision
            });
            
            if (duplicateExists) {
              toast({
                title: "Duplicate Variation",
                description: "A variation with this name and price already exists. Use a different name or price.",
                variant: "destructive",
              });
              return;
            }
            
            // Create new variation
            const newVariation = {
              id: `var-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              name: variationName,
              price: price,
              stock_quantity: stockQuantity || 0,
            };
            
            // Add new variation to the list
            const updatedVariations = [...existingVariations, newVariation];
            
            // Update product with new variations (stored as JSON string)
            const result = await updateProduct(variationProduct.id, {
              variations: JSON.stringify(updatedVariations),
            });
            
            if (result.success) {
              // Refresh products to get updated data
              await refreshProducts();
              setVariationProduct(null);
              toast({
                title: "Variation Added",
                description: `${variationName} - ₱${price.toFixed(2)} variation added successfully`,
              });
            } else {
              toast({
                title: "Error",
                description: result.error || "Failed to add variation",
                variant: "destructive",
              });
            }
          }}
          onCancel={() => setVariationProduct(null)}
        />
      )}

      {/* Edit Variation Dialog */}
      {editingVariation && (
        <EditVariationDialog
          productName={editingVariation.product.name}
          variation={editingVariation.variation}
          onConfirm={async (variationId, newPrice, newName, suppliers) => {
            try {
              // Get existing variations
              const existingVariations = (() => {
                if (!editingVariation.product.variations) return [];
                if (Array.isArray(editingVariation.product.variations)) return editingVariation.product.variations;
                if (typeof editingVariation.product.variations === 'string') {
                  try {
                    return JSON.parse(editingVariation.product.variations);
                  } catch {
                    return [];
                  }
                }
                return [];
              })();

              // Filter valid variations for duplicate checking
              const validVariations = existingVariations.filter((v: any) => v && typeof v.price === 'number' && v.price > 0);
              
              // Determine final name
              const finalName = newName || `${editingVariation.product.name} - ₱${newPrice.toFixed(2)}`;
              
              // Check for duplicate: same name AND same price (excluding current variation)
              const duplicateExists = validVariations.some((v: any) => {
                if (v.id === variationId) return false; // Exclude current variation
                const vName = v.name ? v.name.trim() : '';
                const vPrice = typeof v.price === 'number' ? v.price : 0;
                // Compare names (case-insensitive) and prices (exact match with tolerance)
                return vName.toLowerCase() === finalName.toLowerCase() && 
                       Math.abs(vPrice - newPrice) < 0.01; // Allow for floating point precision
              });
              
              if (duplicateExists) {
                toast({
                  title: "Duplicate Variation",
                  description: "A variation with this name and price already exists. Use a different name or price.",
                  variant: "destructive",
                });
                return;
              }

              // Find and update the variation
              const updatedVariations = existingVariations.map((v: any) => {
                if (v.id === variationId) {
                  return {
                    ...v,
                    price: newPrice,
                    name: finalName,
                    suppliers: suppliers || undefined,
                  };
                }
                return v;
              });

              // Update the product
              const result = await updateProduct(editingVariation.product.id, {
                variations: JSON.stringify(updatedVariations),
              });

              if (result.success) {
                setEditingVariation(null);
                await refreshProducts();
                toast({
                  title: "Variation Updated",
                  description: `Variation updated successfully`,
                });
              } else {
                toast({
                  title: "Error",
                  description: result.error || "Failed to update variation",
                  variant: "destructive",
                });
              }
            } catch (error) {
              console.error("Error updating variation:", error);
              toast({
                title: "Error",
                description: "An error occurred while updating variation",
                variant: "destructive",
              });
            }
          }}
          onCancel={() => setEditingVariation(null)}
        />
      )}

      {/* History Dialog */}
      {historyProduct && (
        <HistoryDialog
          product={historyProduct}
          onClose={() => setHistoryProduct(null)}
        />
      )}

      {/* Category Management Dialog */}
      <CategoryManagementDialog
        open={showCategoryManagement}
        onOpenChange={setShowCategoryManagement}
      />

    </div>
  );
}