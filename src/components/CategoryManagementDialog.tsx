import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { categoriesApi, CategoryRecord, CategoryWithChildren } from "@/services/mysqlApi";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Edit,
  Trash2,
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  Tag,
  Move,
  X,
  Save,
} from "lucide-react";
import { useUserPermissions } from "@/hooks/useUserPermissions";

interface CategoryManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CategoryManagementDialog({
  open,
  onOpenChange,
}: CategoryManagementDialogProps) {
  const { canDelete } = useUserPermissions();
  const { toast } = useToast();
  const [categories, setCategories] = useState<CategoryWithChildren[]>([]);
  const [flatCategories, setFlatCategories] = useState<CategoryWithChildren[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingParentId, setEditingParentId] = useState<number | null | undefined>(null);
  const [editingIsParent, setEditingIsParent] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newParentId, setNewParentId] = useState<number | null>(null);
  const [newIsParent, setNewIsParent] = useState(false);
  const [movingCategoryId, setMovingCategoryId] = useState<number | null>(null);
  const [moveTargetParentId, setMoveTargetParentId] = useState<number | null | undefined>(null);

  // Load categories
  const loadCategories = async () => {
    setIsLoading(true);
    try {
      const [hierarchicalResult, flatResult] = await Promise.all([
        categoriesApi.getHierarchical(),
        categoriesApi.getFlatWithParents(),
      ]);

      if (hierarchicalResult.success && hierarchicalResult.data) {
        setCategories(hierarchicalResult.data);
        // Expand all by default
        const allIds = new Set<number>();
        const collectIds = (cats: CategoryWithChildren[]) => {
          cats.forEach((cat) => {
            if (cat.id) {
              allIds.add(cat.id);
              if (cat.children && cat.children.length > 0) {
                collectIds(cat.children);
              }
            }
          });
        };
        collectIds(hierarchicalResult.data);
        setExpandedCategories(allIds);
      }

      if (flatResult.success && flatResult.data) {
        setFlatCategories(flatResult.data);
      }
    } catch (error) {
      console.error("Failed to load categories:", error);
      toast({
        title: "Error",
        description: "Failed to load categories",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadCategories();
    }
  }, [open]);

  // Get available parent options (excluding the category being edited and its children)
  const getAvailableParents = (excludeId?: number): CategoryWithChildren[] => {
    return flatCategories.filter((cat) => {
      if (cat.id === excludeId) return false;
      if (!excludeId) return true;
      
      // Check if cat is a descendant of excludeId
      const isDescendant = (categoryId: number, ancestorId: number): boolean => {
        const category = flatCategories.find((c) => c.id === categoryId);
        if (!category || !category.parent_id) return false;
        if (category.parent_id === ancestorId) return true;
        return isDescendant(category.parent_id, ancestorId);
      };
      
      return !isDescendant(cat.id!, excludeId);
    });
  };

  const handleToggleExpand = (categoryId: number) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const handleStartEdit = (category: CategoryWithChildren) => {
    setEditingId(category.id!);
    setEditingName(category.name);
    setEditingParentId(category.parent_id);
    setEditingIsParent(Boolean(category.is_parent));
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editingName.trim()) return;

    try {
      const result = await categoriesApi.update(editingId, {
        name: editingName.trim(),
        parent_id: editingParentId,
        is_parent: editingIsParent,
      });

      if (result.success) {
        toast({
          title: "Success",
          description: "Category updated successfully",
        });
        setEditingId(null);
        await loadCategories();
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to update category",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to update category:", error);
      toast({
        title: "Error",
        description: "Failed to update category",
        variant: "destructive",
      });
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName("");
    setEditingParentId(null);
    setEditingIsParent(false);
  };

  const handleDelete = async (categoryId: number, categoryName: string) => {
    if (!canDelete) {
      toast({
        title: "Permission Denied",
        description: "You don't have permission to delete categories",
        variant: "destructive",
      });
      return;
    }

    if (!confirm(`Are you sure you want to delete "${categoryName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const result = await categoriesApi.delete(categoryId);
      if (result.success) {
        toast({
          title: "Success",
          description: "Category deleted successfully",
        });
        await loadCategories();
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to delete category",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to delete category:", error);
      toast({
        title: "Error",
        description: "Failed to delete category",
        variant: "destructive",
      });
    }
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      toast({
        title: "Error",
        description: "Category name is required",
        variant: "destructive",
      });
      return;
    }

    try {
      const result = await categoriesApi.create({
        name: newCategoryName.trim(),
        parent_id: newParentId,
        is_parent: newIsParent,
        display_order: 0,
      });

      if (result.success) {
        toast({
          title: "Success",
          description: "Category created successfully",
        });
        setShowAddForm(false);
        setNewCategoryName("");
        setNewParentId(null);
        setNewIsParent(false);
        await loadCategories();
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to create category",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to create category:", error);
      toast({
        title: "Error",
        description: "Failed to create category",
        variant: "destructive",
      });
    }
  };

  const handleStartMove = (categoryId: number) => {
    setMovingCategoryId(categoryId);
    const category = flatCategories.find((c) => c.id === categoryId);
    setMoveTargetParentId(category?.parent_id || null);
  };

  const handleSaveMove = async () => {
    if (!movingCategoryId) return;

    try {
      const result = await categoriesApi.update(movingCategoryId, {
        parent_id: moveTargetParentId,
      });

      if (result.success) {
        toast({
          title: "Success",
          description: "Category moved successfully",
        });
        setMovingCategoryId(null);
        setMoveTargetParentId(null);
        await loadCategories();
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to move category",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to move category:", error);
      toast({
        title: "Error",
        description: "Failed to move category",
        variant: "destructive",
      });
    }
  };

  const handleCancelMove = () => {
    setMovingCategoryId(null);
    setMoveTargetParentId(null);
  };

  const renderCategory = (category: CategoryWithChildren, level: number = 0): JSX.Element => {
    const isExpanded = expandedCategories.has(category.id!);
    const hasChildren = category.children && category.children.length > 0;
    const isEditing = editingId === category.id;
    const isMoving = movingCategoryId === category.id;

    return (
      <div key={category.id} className="select-none">
        <div
          className={`
            flex items-center gap-2 p-2 rounded-lg hover:bg-secondary/50
            ${isEditing || isMoving ? "bg-primary/10" : ""}
          `}
          style={{ paddingLeft: `${level * 24 + 8}px` }}
        >
          {hasChildren ? (
            <button
              onClick={() => handleToggleExpand(category.id!)}
              className="p-1 hover:bg-secondary rounded"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
          ) : (
            <div className="w-6" />
          )}

          {category.is_parent ? (
            isExpanded ? (
              <FolderOpen className="w-4 h-4 text-primary" />
            ) : (
              <Folder className="w-4 h-4 text-primary" />
            )
          ) : (
            <Tag className="w-4 h-4 text-muted-foreground" />
          )}

          {isEditing ? (
            <div className="flex-1 flex items-center gap-2">
              <Input
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                className="flex-1 h-8"
                autoFocus
              />
              <Select
                value={editingParentId?.toString() || "null"}
                onValueChange={(value) =>
                  setEditingParentId(value === "null" ? null : Number(value))
                }
              >
                <SelectTrigger className="w-40 h-8">
                  <SelectValue placeholder="Parent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="null">(Root)</SelectItem>
                  {getAvailableParents(category.id).map((cat) => (
                    <SelectItem key={cat.id} value={cat.id!.toString()}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <label className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={editingIsParent}
                  onChange={(e) => setEditingIsParent(e.target.checked)}
                  className="w-4 h-4"
                />
                Parent
              </label>
              <Button size="sm" onClick={handleSaveEdit} className="h-8">
                <Save className="w-3 h-3" />
              </Button>
              <Button size="sm" variant="outline" onClick={handleCancelEdit} className="h-8">
                <X className="w-3 h-3" />
              </Button>
            </div>
          ) : isMoving ? (
            <div className="flex-1 flex items-center gap-2">
              <span className="flex-1 font-medium">{category.name}</span>
              <span className="text-sm text-muted-foreground">Move to:</span>
              <Select
                value={moveTargetParentId?.toString() || "null"}
                onValueChange={(value) =>
                  setMoveTargetParentId(value === "null" ? null : Number(value))
                }
              >
                <SelectTrigger className="w-40 h-8">
                  <SelectValue placeholder="Parent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="null">(Root)</SelectItem>
                  {getAvailableParents(category.id).map((cat) => (
                    <SelectItem key={cat.id} value={cat.id!.toString()}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={handleSaveMove} className="h-8">
                <Save className="w-3 h-3" />
              </Button>
              <Button size="sm" variant="outline" onClick={handleCancelMove} className="h-8">
                <X className="w-3 h-3" />
              </Button>
            </div>
          ) : (
            <>
              <span className="flex-1 font-medium">{category.name}</span>
              {category.parent_name && (
                <span className="text-xs text-muted-foreground">
                  (under {category.parent_name})
                </span>
              )}
              {category.is_parent && (
                <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">
                  Parent
                </span>
              )}
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleStartEdit(category)}
                  className="h-7 w-7 p-0"
                >
                  <Edit className="w-3 h-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleStartMove(category.id!)}
                  className="h-7 w-7 p-0"
                  title="Move to different parent"
                >
                  <Move className="w-3 h-3" />
                </Button>
                {canDelete && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(category.id!, category.name)}
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                )}
              </div>
            </>
          )}
        </div>

        {hasChildren && isExpanded && (
          <div>
            {category.children!.map((child) => renderCategory(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Category Management</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-4">
          {/* Add Category Form */}
          {showAddForm ? (
            <div className="p-4 bg-secondary/30 rounded-lg space-y-3">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Category name"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="flex-1"
                  autoFocus
                />
                <Select
                  value={newParentId?.toString() || "null"}
                  onValueChange={(value) =>
                    setNewParentId(value === "null" ? null : Number(value))
                  }
                >
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Parent" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="null">(Root)</SelectItem>
                    {flatCategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id!.toString()}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <label className="flex items-center gap-1 text-sm whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={newIsParent}
                    onChange={(e) => setNewIsParent(e.target.checked)}
                    className="w-4 h-4"
                  />
                  Parent
                </label>
                <Button onClick={handleAddCategory} size="sm">
                  <Save className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAddForm(false);
                    setNewCategoryName("");
                    setNewParentId(null);
                    setNewIsParent(false);
                  }}
                  size="sm"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ) : (
            <Button
              onClick={() => setShowAddForm(true)}
              className="w-full"
              variant="outline"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Category
            </Button>
          )}

          {/* Categories Tree */}
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading categories...
            </div>
          ) : categories.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No categories found. Add your first category above.
            </div>
          ) : (
            <div className="space-y-1">
              {categories.map((category) => renderCategory(category))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

