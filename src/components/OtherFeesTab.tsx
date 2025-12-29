import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Save, X, DollarSign, Percent, ToggleLeft, ToggleRight, Tag, ShoppingCart, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { feesApi, FeeRecord } from "@/services/mysqlApi";
import { getAllCategoriesAsync } from "@/utils/categories";
import { useToast } from "@/hooks/use-toast";

const FEE_TYPES: { value: FeeRecord['fee_type']; label: string }[] = [
  { value: 'service_fee', label: 'Service Fee' },
  { value: 'timpla_fee', label: 'Timpla Fee' },
  { value: 'transaction_fee', label: 'Transaction Fee' },
  { value: 'bottle_deposit', label: 'Bottle Deposit' },
  { value: 'other', label: 'Other' },
];

export function OtherFeesTab() {
  const [fees, setFees] = useState<FeeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [formData, setFormData] = useState<Partial<FeeRecord>>({
    name: '',
    fee_type: 'service_fee',
    amount: 0,
    is_percentage: false,
    is_active: true,
    categories: null, // null means applies to all categories
    calculation_type: 'per_transaction', // per_item or per_transaction
    description: '',
  });
  const { toast } = useToast();

  useEffect(() => {
    loadFees();
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const categories = await getAllCategoriesAsync();
      setAllCategories(categories);
    } catch (error) {
      console.error("Error loading categories:", error);
    }
  };

  const loadFees = async () => {
    setLoading(true);
    try {
      const result = await feesApi.getAll();
      if (result.success && result.data) {
        setFees(result.data);
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to load fees",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error loading fees:", error);
      toast({
        title: "Error",
        description: "Failed to load fees",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (fee: FeeRecord) => {
    setEditingId(fee.id!);
    setFormData({
      name: fee.name,
      fee_type: fee.fee_type,
      amount: fee.amount,
      is_percentage: Boolean(fee.is_percentage),
      is_active: Boolean(fee.is_active),
      categories: fee.categories || null,
      calculation_type: fee.calculation_type || 'per_transaction',
      description: fee.description || '',
    });
    setShowAddForm(false);
  };

  const handleCancel = () => {
    setEditingId(null);
    setShowAddForm(false);
    setFormData({
      name: '',
      fee_type: 'service_fee',
      amount: 0,
      is_percentage: false,
      is_active: true,
      categories: null,
      calculation_type: 'per_transaction',
      description: '',
    });
  };

  const toggleCategory = (category: string) => {
    const currentCategories = formData.categories || [];
    const isSelected = Array.isArray(currentCategories) && currentCategories.includes(category);
    
    if (isSelected) {
      // Remove category
      const newCategories = (currentCategories as string[]).filter(c => c !== category);
      setFormData({ ...formData, categories: newCategories.length > 0 ? newCategories : null });
    } else {
      // Add category
      const newCategories = Array.isArray(currentCategories) 
        ? [...currentCategories, category]
        : [category];
      setFormData({ ...formData, categories: newCategories });
    }
  };

  const handleApplyToAllCategories = () => {
    setFormData({ ...formData, categories: null });
  };

  const handleSave = async () => {
    if (!formData.name || !formData.fee_type) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (formData.amount === undefined || formData.amount < 0) {
      toast({
        title: "Validation Error",
        description: "Amount must be a positive number",
        variant: "destructive",
      });
      return;
    }

    try {
      let result;
      if (editingId) {
        result = await feesApi.update(editingId, formData);
      } else {
        result = await feesApi.create(formData as Omit<FeeRecord, "id" | "created_at" | "updated_at">);
      }

      if (result.success) {
        toast({
          title: "Success",
          description: editingId ? "Fee updated successfully" : "Fee created successfully",
        });
        handleCancel();
        loadFees();
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to save fee",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error saving fee:", error);
      toast({
        title: "Error",
        description: "Failed to save fee",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) {
      return;
    }

    try {
      const result = await feesApi.delete(id);
      if (result.success) {
        toast({
          title: "Success",
          description: "Fee deleted successfully",
        });
        loadFees();
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to delete fee",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error deleting fee:", error);
      toast({
        title: "Error",
        description: "Failed to delete fee",
        variant: "destructive",
      });
    }
  };

  const toggleActive = async (fee: FeeRecord) => {
    try {
      const result = await feesApi.update(fee.id!, {
        is_active: !Boolean(fee.is_active),
      });
      if (result.success) {
        loadFees();
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to update fee",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error toggling fee:", error);
      toast({
        title: "Error",
        description: "Failed to update fee",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="glass-panel rounded-lg p-6">
        <div className="text-center text-muted-foreground">Loading fees...</div>
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/20 rounded-lg">
            <DollarSign className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Other Fees</h2>
            <p className="text-sm text-muted-foreground">Manage service fees, transaction fees, and other charges</p>
          </div>
        </div>
        <Button
          onClick={() => {
            handleCancel();
            setShowAddForm(true);
          }}
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Fee
        </Button>
      </div>

      {/* Add/Edit Form */}
      {(showAddForm || editingId !== null) && (
        <div className="mb-6 p-4 bg-secondary/50 rounded-lg border border-border/50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Fee Name *
              </label>
              <input
                type="text"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Service Fee"
                className="w-full px-3 py-2 bg-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Fee Type *
              </label>
              <select
                value={formData.fee_type || 'service_fee'}
                onChange={(e) => setFormData({ ...formData, fee_type: e.target.value as FeeRecord['fee_type'] })}
                className="w-full px-3 py-2 bg-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                {FEE_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Amount *
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.amount || 0}
                  onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                  className="w-full px-3 py-2 bg-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {formData.is_percentage ? <Percent className="w-4 h-4" /> : <DollarSign className="w-4 h-4" />}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Amount Type
              </label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant={!formData.is_percentage ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFormData({ ...formData, is_percentage: false })}
                  className="flex-1 gap-2"
                >
                  <DollarSign className="w-4 h-4" />
                  Fixed
                </Button>
                <Button
                  type="button"
                  variant={formData.is_percentage ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFormData({ ...formData, is_percentage: true })}
                  className="flex-1 gap-2"
                >
                  <Percent className="w-4 h-4" />
                  Percentage
                </Button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Calculation Type
              </label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant={formData.calculation_type === 'per_item' ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFormData({ ...formData, calculation_type: 'per_item' })}
                  className="flex-1 gap-2"
                >
                  <ShoppingCart className="w-4 h-4" />
                  Per Item
                </Button>
                <Button
                  type="button"
                  variant={formData.calculation_type === 'per_transaction' ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFormData({ ...formData, calculation_type: 'per_transaction' })}
                  className="flex-1 gap-2"
                >
                  <Receipt className="w-4 h-4" />
                  Per Transaction
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {formData.calculation_type === 'per_item' 
                  ? 'Fee applies to each matching item in the cart'
                  : 'Fee applies once per transaction regardless of items'}
              </p>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Description
              </label>
              <textarea
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description for this fee"
                rows={2}
                className="w-full px-3 py-2 bg-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                <Tag className="w-4 h-4 inline mr-1" />
                Apply to Categories
              </label>
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <Button
                    type="button"
                    variant={formData.categories === null ? "default" : "outline"}
                    size="sm"
                    onClick={handleApplyToAllCategories}
                    className="text-xs"
                  >
                    Apply to All Categories
                  </Button>
                  {formData.categories !== null && Array.isArray(formData.categories) && (
                    <span className="text-xs text-muted-foreground">
                      {formData.categories.length} category{formData.categories.length !== 1 ? 'ies' : ''} selected
                    </span>
                  )}
                </div>
                <div className="max-h-40 overflow-y-auto p-2 bg-input rounded-lg border border-border/50">
                  {allCategories.length === 0 ? (
                    <div className="text-sm text-muted-foreground text-center py-2">No categories available</div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {allCategories.map((category) => {
                        const isSelected = formData.categories === null 
                          ? true 
                          : Array.isArray(formData.categories) && formData.categories.includes(category);
                        return (
                          <button
                            key={category}
                            type="button"
                            onClick={() => toggleCategory(category)}
                            className={`px-3 py-1 text-xs rounded-full transition-colors ${
                              isSelected
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-secondary text-foreground hover:bg-secondary/80'
                            }`}
                          >
                            {category}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {formData.categories === null 
                    ? 'This fee will apply to all product categories' 
                    : 'This fee will only apply to selected categories'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <Button onClick={handleSave} className="gap-2">
              <Save className="w-4 h-4" />
              {editingId ? 'Update' : 'Create'} Fee
            </Button>
            <Button variant="outline" onClick={handleCancel} className="gap-2">
              <X className="w-4 h-4" />
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Fees List */}
      <div className="space-y-3">
        {fees.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No fees configured. Click "Add Fee" to create one.
          </div>
        ) : (
          fees.map((fee) => (
            <div
              key={fee.id}
              className={`p-4 rounded-lg border transition-colors ${
                editingId === fee.id
                  ? 'bg-primary/10 border-primary/50'
                  : 'bg-secondary/30 border-border/50 hover:bg-secondary/50'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <h3 className="font-semibold text-foreground">{fee.name}</h3>
                    <span className="px-2 py-1 text-xs bg-primary/20 text-primary rounded">
                      {FEE_TYPES.find(t => t.value === fee.fee_type)?.label || fee.fee_type}
                    </span>
                    <span className="px-2 py-1 text-xs bg-secondary text-muted-foreground rounded flex items-center gap-1">
                      {fee.calculation_type === 'per_item' ? (
                        <>
                          <ShoppingCart className="w-3 h-3" />
                          Per Item
                        </>
                      ) : (
                        <>
                          <Receipt className="w-3 h-3" />
                          Per Transaction
                        </>
                      )}
                    </span>
                    {Boolean(fee.is_active) ? (
                      <span className="px-2 py-1 text-xs bg-success/20 text-success rounded">
                        Active
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs bg-muted text-muted-foreground rounded">
                        Inactive
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                    <span className="flex items-center gap-1">
                      {Boolean(fee.is_percentage) ? (
                        <>
                          <Percent className="w-4 h-4" />
                          {Number(fee.amount || 0).toFixed(2)}%
                        </>
                      ) : (
                        <>
                          <DollarSign className="w-4 h-4" />
                          ₱{Number(fee.amount || 0).toFixed(2)}
                        </>
                      )}
                    </span>
                    {fee.description && (
                      <span className="text-xs">{fee.description}</span>
                    )}
                  </div>
                  {fee.categories !== null && Array.isArray(fee.categories) && fee.categories.length > 0 && (
                    <div className="flex items-center gap-2 mt-2">
                      <Tag className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Categories: </span>
                      <div className="flex flex-wrap gap-1">
                        {fee.categories.map((cat) => (
                          <span key={cat} className="px-2 py-0.5 text-xs bg-primary/10 text-primary rounded">
                            {cat}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {fee.categories === null && (
                    <div className="flex items-center gap-2 mt-2">
                      <Tag className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Applies to all categories</span>
                    </div>
                  )}
                  {fee.created_by && (
                    <div className="text-xs text-muted-foreground">
                      Created by: {fee.created_by}
                      {fee.updated_at && fee.updated_at !== fee.created_at && (
                        <span className="ml-2">• Updated: {new Date(fee.updated_at).toLocaleDateString()}</span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleActive(fee)}
                    className="gap-1"
                    title={Boolean(fee.is_active) ? "Deactivate" : "Activate"}
                  >
                    {Boolean(fee.is_active) ? (
                      <ToggleRight className="w-4 h-4 text-success" />
                    ) : (
                      <ToggleLeft className="w-4 h-4 text-muted-foreground" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(fee)}
                    className="gap-1"
                    disabled={editingId === fee.id}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(fee.id!, fee.name)}
                    className="gap-1 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

