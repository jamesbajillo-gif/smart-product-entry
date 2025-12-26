import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { productsApi } from "@/services/mysqlApi";
import { Product } from "@/types/product";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Package,
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  RefreshCw,
  Search,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ProductManagement() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const { toast } = useToast();

  const loadProducts = async () => {
    setIsLoading(true);
    const result = await productsApi.getAll();
    if (result.success && result.data) {
      setProducts(
        result.data.map((p) => ({
          id: String(p.id),
          name: p.name,
          price: Number(p.price),
        }))
      );
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAdd = async () => {
    if (!newName.trim() || !newPrice) {
      toast({ title: "Error", description: "Please fill in all fields" });
      return;
    }

    const result = await productsApi.create({
      name: newName.trim(),
      price: parseFloat(newPrice),
    });

    if (result.success) {
      toast({ title: "Success", description: "Product added successfully" });
      setNewName("");
      setNewPrice("");
      setShowAddForm(false);
      loadProducts();
    } else {
      toast({ title: "Error", description: result.error || "Failed to add product" });
    }
  };

  const handleEdit = (product: Product) => {
    setEditingId(product.id);
    setEditName(product.name);
    setEditPrice(product.price.toString());
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim() || !editPrice) return;

    const result = await productsApi.update(editingId, {
      name: editName.trim(),
      price: parseFloat(editPrice),
    });

    if (result.success) {
      toast({ title: "Success", description: "Product updated successfully" });
      setEditingId(null);
      loadProducts();
    } else {
      toast({ title: "Error", description: result.error || "Failed to update product" });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;

    const result = await productsApi.delete(id);

    if (result.success) {
      toast({ title: "Success", description: "Product deleted successfully" });
      loadProducts();
    } else {
      toast({ title: "Error", description: result.error || "Failed to delete product" });
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditPrice("");
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Link to="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/20 rounded-lg">
                <Package className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Product Management</h1>
                <p className="text-sm text-muted-foreground">
                  {products.length} products in database
                </p>
              </div>
            </div>
            <div className="ml-auto flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={loadProducts}
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

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products..."
              className="w-full pl-10 pr-4 py-2 bg-input rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        </header>

        {/* Add Product Form */}
        {showAddForm && (
          <div className="glass-panel rounded-lg p-4 mb-6 animate-fade-in">
            <h3 className="font-semibold text-foreground mb-4">Add New Product</h3>
            <div className="flex gap-4">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Product name"
                className="flex-1 px-4 py-2 bg-input rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                autoFocus
              />
              <div className="relative w-32">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  ₱
                </span>
                <input
                  type="number"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  className="w-full pl-8 pr-4 py-2 bg-input rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <Button onClick={handleAdd} className="gap-2">
                <Save className="w-4 h-4" />
                Save
              </Button>
              <Button variant="ghost" onClick={() => setShowAddForm(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Products List */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-muted-foreground">Loading products...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-12 glass-panel rounded-lg">
            <Package className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-30" />
            <p className="text-muted-foreground">
              {searchQuery ? "No products found" : "No products in database"}
            </p>
            {!searchQuery && (
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setShowAddForm(true)}
              >
                Add First Product
              </Button>
            )}
          </div>
        ) : (
          <div className="glass-panel rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                    ID
                  </th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                    Product Name
                  </th>
                  <th className="text-right p-4 text-sm font-medium text-muted-foreground">
                    Price
                  </th>
                  <th className="text-right p-4 text-sm font-medium text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => (
                  <tr
                    key={product.id}
                    className="border-b border-border/50 hover:bg-secondary/30 transition-colors"
                  >
                    <td className="p-4 text-sm text-muted-foreground font-mono">
                      #{product.id}
                    </td>
                    <td className="p-4">
                      {editingId === product.id ? (
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full px-3 py-1 bg-input rounded text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                          autoFocus
                        />
                      ) : (
                        <span className="text-foreground font-medium">{product.name}</span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      {editingId === product.id ? (
                        <div className="relative inline-block w-28">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                            ₱
                          </span>
                          <input
                            type="number"
                            value={editPrice}
                            onChange={(e) => setEditPrice(e.target.value)}
                            step="0.01"
                            min="0"
                            className="w-full pl-7 pr-2 py-1 bg-input rounded text-foreground text-right focus:outline-none focus:ring-2 focus:ring-primary/50"
                          />
                        </div>
                      ) : (
                        <span className="font-mono text-primary font-semibold">
                          ₱{product.price.toFixed(2)}
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      {editingId === product.id ? (
                        <div className="flex justify-end gap-1">
                          <Button size="sm" onClick={handleSaveEdit} className="gap-1">
                            <Save className="w-3 h-3" />
                            Save
                          </Button>
                          <Button size="sm" variant="ghost" onClick={handleCancelEdit}>
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEdit(product)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDelete(product.id, product.name)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
