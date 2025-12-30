// MySQL API Service - works with the General-Purpose MySQL CRUD API

import { getCurrentOperator } from "@/utils/operator";

// Format date to MySQL compatible format (YYYY-MM-DD HH:MM:SS)
const formatMySQLDateTime = (date: Date): string => {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

// Default API URL - can be overridden via localStorage
const DEFAULT_API_URL = "https://api.techpinoy.net/mysql/api.php";

// Allow manual override via localStorage
const getApiUrl = (): string => {
  const manualUrl = localStorage.getItem("mysql-api-url");
  if (manualUrl) return manualUrl;
  return import.meta.env.VITE_MYSQL_API_URL || DEFAULT_API_URL;
};

export const setApiUrl = (url: string) => {
  if (url) {
    localStorage.setItem("mysql-api-url", url);
  } else {
    localStorage.removeItem("mysql-api-url");
  }
};

export const getConfiguredApiUrl = getApiUrl;

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  total?: number;
  id?: number;
  affected_rows?: number;
}

interface FetchOptions {
  table?: string;
  id?: number | string;
  data?: Record<string, unknown> | Record<string, unknown>[];
  filters?: Record<string, unknown>;
  limit?: number;
  offset?: number;
  order_by?: string;
  order_dir?: "ASC" | "DESC";
  action?: string;
  query?: string;
}

export async function apiRequest<T>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  options: FetchOptions = {}
): Promise<ApiResponse<T>> {
  const { table, id, data, filters, limit, offset, order_by, order_dir, action, query } = options;

  let url = getApiUrl();
  const params = new URLSearchParams();

  if (action) params.append("action", action);
  if (table) params.append("table", table);
  if (id) params.append("id", String(id));
  if (limit) params.append("limit", String(limit));
  if (offset) params.append("offset", String(offset));
  if (order_by) params.append("order_by", order_by);
  if (order_dir) params.append("order_dir", order_dir);

  // Add filters to query params for GET requests
  if (method === "GET" && filters) {
    Object.entries(filters).forEach(([key, value]) => {
      params.append(key, String(value));
    });
  }

  const queryString = params.toString();
  if (queryString) {
    url += `?${queryString}`;
  }

  const fetchOptions: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
    },
  };

  if (method !== "GET" && (data || table || query)) {
    fetchOptions.body = JSON.stringify({
      table,
      id,
      data,
      query,
      ...(filters && { filters }),
    });
  }

  try {
    const response = await fetch(url, fetchOptions);
    
    // Check if response is ok before parsing
    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }
    
    // Try to parse JSON, handle parse errors
    let result;
    try {
      result = await response.json();
    } catch (parseError) {
      console.error("Failed to parse API response:", parseError);
      return {
        success: false,
        error: "Invalid response from server",
      };
    }
    
    return result;
  } catch (error) {
    // Catch network errors and other fetch failures
    console.error("API Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "API request failed",
    };
  }
}

// Products API
export const productsApi = {
  getAll: async () => {
    const result = await apiRequest<Array<{
      id: string;
      name: string;
      price: number;
      category?: string;
      image_url?: string;
      stock_quantity?: number;
      low_stock_threshold?: number;
      skip_stock_tracking?: number | boolean;
      variations?: string; // JSON string
      suppliers?: string; // JSON string
    }>>(
      "GET",
      { table: "products", limit: 1000 }
    );
    return result;
  },

  create: async (product: {
    name: string;
    price: number;
    category?: string;
    image_url?: string;
    stock_quantity?: number;
    low_stock_threshold?: number;
    skip_stock_tracking?: boolean;
    variations?: string; // JSON string of variations
  }) => {
    const operatorName = getCurrentOperator();
    // Convert boolean to 1/0 for MySQL
    const data = {
      ...product,
      skip_stock_tracking: product.skip_stock_tracking ? 1 : 0,
      created_by: operatorName,
      updated_by: operatorName,
    };
    const result = await apiRequest<{ id: number }>("POST", {
      table: "products",
      data,
    });
    
    // Log transaction
    if (result.success && result.id) {
      await logTransaction(
        "product",
        "create",
        "products",
        result.id,
        null,
        data,
        `Product created: ${product.name} - ₱${product.price.toFixed(2)}`
      );
    }
    
    return result;
  },

  update: async (id: string, data: {
    name?: string;
    price?: number;
    category?: string;
    image_url?: string;
    stock_quantity?: number;
    low_stock_threshold?: number;
    skip_stock_tracking?: boolean;
    variations?: string; // JSON string of variations
    suppliers?: string; // JSON string of suppliers
    services?: string; // JSON string of services
  }) => {
    // Get product data before update for logging
    const productResult = await productsApi.getAll();
    const productBefore = productResult.success && productResult.data
      ? productResult.data.find((p: any) => String(p.id) === id)
      : null;
    
    const operatorName = getCurrentOperator();
    // Convert boolean to 1/0 for MySQL if provided
    const updateData = {
      ...data,
      updated_by: operatorName,
      ...(data.skip_stock_tracking !== undefined && { 
        skip_stock_tracking: data.skip_stock_tracking ? 1 : 0 
      }),
    };
    const result = await apiRequest("PUT", {
      table: "products",
      id,
      data: updateData,
    });
    
    // Log transaction
    if (result.success && productBefore) {
      const productAfter = { ...productBefore, ...updateData };
      await logTransaction(
        "product",
        "update",
        "products",
        Number(id),
        productBefore,
        productAfter,
        `Product updated: ${productBefore.name || id}`
      );
    }
    
    return result;
  },

  delete: async (id: string) => {
    // Get product data before deletion for logging
    const productResult = await productsApi.getAll();
    const productData = productResult.success && productResult.data
      ? productResult.data.find((p: any) => String(p.id) === id)
      : null;
    
    const result = await apiRequest("DELETE", {
      table: "products",
      id,
    });
    
    // Log transaction
    if (result.success && productData) {
      await logTransaction(
        "product",
        "delete",
        "products",
        Number(id),
        productData,
        null,
        `Product deleted: ${(productData as any).name || id}`
      );
    }
    
    return result;
  },

  getById: async (id: string) => {
    const result = await apiRequest<Array<{
      id: string;
      name: string;
      price: number;
      category?: string;
      image_url?: string;
      stock_quantity?: number;
      low_stock_threshold?: number;
      skip_stock_tracking?: number | boolean;
      variations?: string;
      suppliers?: string;
    }>>(
      "GET",
      { table: "products", id }
    );
    return result;
  },

  getLowStock: async () => {
    // Get products where stock_quantity <= low_stock_threshold
    const result = await apiRequest<Array<{
      id: string;
      name: string;
      price: number;
      category?: string;
      image_url?: string;
      stock_quantity?: number;
      low_stock_threshold?: number;
    }>>(
      "GET",
      { table: "products", limit: 1000 }
    );
    
    if (result.success && result.data) {
      // Filter low stock products client-side
      result.data = result.data.filter(p => {
        const stock = p.stock_quantity ?? 0;
        const threshold = p.low_stock_threshold ?? 5;
        return stock <= threshold;
      });
    }
    return result;
  },
};

// Sales API
export interface SaleRecord {
  id?: number;
  items: string; // JSON string of order items
  total: number;
  payment_method: string;
  amount_tendered?: number;
  change_amount?: number;
  bottle_deposit_refunded?: number; // 0 = not refunded, 1 = refunded
  operator_name?: string;
  updated_by?: string;
  created_at?: string;
}

export interface SalesFilters {
  limit?: number;
  offset?: number;
  dateFrom?: string; // MySQL format: YYYY-MM-DD HH:MM:SS
  dateTo?: string;
}

export const salesApi = {
  getAll: async (filters: SalesFilters = {}) => {
    const { limit = 100, offset = 0, dateFrom, dateTo } = filters;
    
    // Build filter object for API
    const apiFilters: Record<string, string | number> = {};
    
    // Use MySQL API's comparison operators for date filtering
    if (dateFrom) {
      apiFilters["created_at__gte"] = dateFrom;
    }
    if (dateTo) {
      apiFilters["created_at__lte"] = dateTo;
    }
    
    const result = await apiRequest<SaleRecord[]>("GET", {
      table: "sales",
      limit,
      offset,
      order_by: "created_at",
      order_dir: "DESC",
      filters: apiFilters,
    });
    return result;
  },

  create: async (sale: Omit<SaleRecord, "id"> & { created_at?: string }) => {
    const operatorName = getCurrentOperator();
    const saleData = {
        ...sale,
      operator_name: operatorName,
        created_at: sale.created_at 
          ? formatMySQLDateTime(new Date(sale.created_at))
          : formatMySQLDateTime(new Date()),
    };
    
    const result = await apiRequest<{ id: number }>("POST", {
      table: "sales",
      data: saleData,
    });
    
    // Log transaction
    if (result.success && result.id) {
      await logTransaction(
        "sale",
        "create",
        "sales",
        result.id,
        null,
        saleData,
        `Sale created: ₱${sale.total.toFixed(2)} via ${sale.payment_method}`
      );
    }
    
    return result;
  },

  getById: async (id: number) => {
    const result = await apiRequest<SaleRecord[]>("GET", {
      table: "sales",
      id,
    });
    return result;
  },

  update: async (id: number, data: Partial<SaleRecord>) => {
    // Get sale data before update for logging
    const saleResult = await salesApi.getById(id);
    const oldSaleData = saleResult.success && saleResult.data && saleResult.data.length > 0 
      ? saleResult.data[0] 
      : null;
    
    const operatorName = getCurrentOperator();
    const updateData = {
      ...data,
      updated_by: operatorName,
    };
    
    const result = await apiRequest("PUT", {
      table: "sales",
      id,
      data: updateData,
    });
    
    // Log transaction
    if (result.success && oldSaleData) {
      const newSaleData = { ...oldSaleData, ...updateData };
      await logTransaction(
        "sale",
        "update",
        "sales",
        id,
        oldSaleData,
        newSaleData,
        `Sale updated: ₱${newSaleData.total?.toFixed(2) || oldSaleData.total.toFixed(2)}`
      );
    }
    
    return result;
  },

  delete: async (id: number) => {
    // Get sale data before deletion for logging
    const saleResult = await salesApi.getById(id);
    const saleData = saleResult.success && saleResult.data && saleResult.data.length > 0 
      ? saleResult.data[0] 
      : null;
    
    const result = await apiRequest("DELETE", {
      table: "sales",
      id,
    });
    
    // Log transaction
    if (result.success && saleData) {
      await logTransaction(
        "sale",
        "delete",
        "sales",
        id,
        saleData,
        null,
        `Sale deleted: ₱${saleData.total.toFixed(2)}`
      );
    }
    
    return result;
  },

  deleteMany: async (ids: number[]) => {
    // Delete multiple sales by making individual delete requests
    const results = await Promise.all(
      ids.map((id) => apiRequest("DELETE", { table: "sales", id }))
    );
    
    const successCount = results.filter((r) => r.success).length;
    const failedCount = results.length - successCount;
    
    return {
      success: failedCount === 0,
      successCount,
      failedCount,
      message: failedCount === 0 
        ? `Successfully deleted ${successCount} sale(s)`
        : `Deleted ${successCount} sale(s), ${failedCount} failed`,
    };
  },

  updateRefundStatus: async (id: number, refunded: boolean) => {
    // Get sale data before update for logging
    const saleResult = await salesApi.getById(id);
    const saleDataBefore = saleResult.success && saleResult.data && saleResult.data.length > 0 
      ? saleResult.data[0] 
      : null;
    
    const result = await apiRequest("PUT", {
      table: "sales",
      id,
      data: {
        bottle_deposit_refunded: refunded ? 1 : 0,
      },
    });
    
    // Log transaction
    if (result.success && saleDataBefore) {
      const saleDataAfter = { ...saleDataBefore, bottle_deposit_refunded: refunded ? 1 : 0 };
      await logTransaction(
        "sale",
        "update",
        "sales",
        id,
        saleDataBefore,
        saleDataAfter,
        `Bottle deposit refund status updated: ${refunded ? "refunded" : "not refunded"}`
      );
    }
    
    return result;
  },
};

// Quantity History API (for smart qty dialog)
export interface QuantityHistoryRecord {
  id?: number;
  product_id: string;
  quantities: string; // JSON array of quantities
}

export const quantityHistoryApi = {
  getAll: async () => {
    const result = await apiRequest<QuantityHistoryRecord[]>("GET", {
      table: "quantity_history",
      limit: 1000,
    });
    return result;
  },

  upsert: async (productId: string, quantities: number[]) => {
    try {
    // First try to get existing record
    const existing = await apiRequest<QuantityHistoryRecord[]>("GET", {
      table: "quantity_history",
      filters: { product_id: productId },
    });

    if (existing.success && existing.data && existing.data.length > 0) {
      // Update existing
      return await apiRequest("PUT", {
        table: "quantity_history",
        id: existing.data[0].id,
        data: { quantities: JSON.stringify(quantities) },
      });
    } else {
      // Create new
      return await apiRequest("POST", {
        table: "quantity_history",
        data: {
          product_id: productId,
          quantities: JSON.stringify(quantities),
        },
      });
      }
    } catch (error) {
      console.error(`Failed to upsert quantity history for product ${productId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to upsert quantity history",
      };
    }
  },
};

// Check API availability
export const checkApiConnection = async (): Promise<boolean> => {
  const apiUrl = getApiUrl();
  if (!apiUrl) return false;
  try {
    const response = await fetch(`${apiUrl}?action=info`);
    const result = await response.json();
    return result.success === true;
  } catch {
    return false;
  }
};

// Database Management API
export interface TableColumn {
  Field: string;
  Type: string;
  Null: string;
  Key: string;
  Default: string | null;
  Extra: string;
}

export interface TableInfo {
  name: string;
  columns: TableColumn[];
  primary_keys: string[];
}

export const databaseApi = {
  // Get database info
  getInfo: async () => {
    const result = await apiRequest<{ database: string; version: string; driver: string }>(
      "GET",
      { action: "info" }
    );
    return result;
  },

  // List all tables
  listTables: async () => {
    const result = await apiRequest<string[]>("GET", { action: "tables" });
    return result;
  },

  // Describe table structure
  describeTable: async (tableName: string) => {
    const apiUrl = getApiUrl();
    try {
      const response = await fetch(`${apiUrl}?action=describe&table=${tableName}`);
      const result = await response.json();
      // The API returns columns at the top level, not under data
      if (result.success && result.columns) {
        return {
          success: true,
          data: {
            table: result.table,
            columns: result.columns as TableColumn[],
            primary_keys: result.primary_keys || [],
            column_count: result.column_count || result.columns.length,
          },
        };
      }
      return { success: false, error: result.error || "Failed to describe table" };
    } catch (error) {
      console.error("Describe table error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to describe table",
      };
    }
  },

  // Execute custom query (SELECT only)
  executeQuery: async (query: string) => {
    const result = await apiRequest<unknown[]>("POST", { action: "query", query });
    return result;
  },

  // Create table using the dedicated create_table endpoint
  createTable: async (tableName: string, createTableSQL: string) => {
    const apiUrl = getApiUrl();
    try {
      const response = await fetch(`${apiUrl}?action=create_table`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          table: tableName,
          sql: createTableSQL,
          if_not_exists: true,
        }),
      });
      const result = await response.json();
      return result;
    } catch (error) {
      console.error("Create table error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create table",
      };
    }
  },
};

// Stock Adjustments API
export interface StockAdjustmentRecord {
  id?: number;
  product_id: string;
  adjustment_type: 'add' | 'remove' | 'set' | 'sale';
  quantity_change: number;
  previous_quantity: number;
  new_quantity: number;
  reason?: string;
  supplier?: string;
  unit_cost?: number;
  total_cost?: number;
  notes?: string;
  operator_name?: string;
  created_at?: string;
}

export interface RestockInfo {
  supplier?: string;
  unitCost?: number;
  notes?: string;
}

export const stockApi = {
  // Adjust stock (add, remove, set) with optional restock info
  adjustStock: async (
    productId: string,
    type: 'add' | 'remove' | 'set',
    quantity: number,
    currentStock: number,
    reason?: string,
    restockInfo?: RestockInfo
  ) => {
    let newStock = currentStock;
    let quantityChange = quantity;

    if (type === 'add') {
      newStock = currentStock + quantity;
    } else if (type === 'remove') {
      newStock = Math.max(0, currentStock - quantity);
      quantityChange = -quantity;
    } else if (type === 'set') {
      newStock = quantity;
      quantityChange = quantity - currentStock;
    }

    // Update product stock
    const updateResult = await productsApi.update(productId, { stock_quantity: newStock });
    if (!updateResult.success) {
      return updateResult;
    }

    // Calculate total cost if unit cost provided
    const totalCost = restockInfo?.unitCost ? quantity * restockInfo.unitCost : null;

    // Record adjustment with restock info
    const operatorName = getCurrentOperator();
    const adjustmentData = {
        product_id: productId,
        adjustment_type: type,
        quantity_change: quantityChange,
        previous_quantity: currentStock,
        new_quantity: newStock,
        reason: reason || null,
        supplier: restockInfo?.supplier || null,
        unit_cost: restockInfo?.unitCost || null,
        total_cost: totalCost,
        notes: restockInfo?.notes || null,
      operator_name: operatorName,
        created_at: formatMySQLDateTime(new Date()),
    };
    
    const adjustmentResult = await apiRequest<{ id: number }>("POST", {
      table: "stock_adjustments",
      data: adjustmentData,
    });
    
    // Log transaction
    if (adjustmentResult.success && adjustmentResult.id) {
      await logTransaction(
        "stock_adjustment",
        "create",
        "stock_adjustments",
        adjustmentResult.id,
        null,
        adjustmentData,
        `Stock ${type}: ${quantityChange > 0 ? '+' : ''}${quantityChange} (${currentStock} → ${newStock})`
      );
    }

    return { success: true, newStock, adjustmentResult };
  },

  // Record sale (auto-called when sale is made)
  recordSale: async (productId: string, quantitySold: number, currentStock: number) => {
    try {
    const newStock = Math.max(0, currentStock - quantitySold);
      const operatorName = getCurrentOperator();

    // Update product stock
    const updateResult = await productsApi.update(productId, { stock_quantity: newStock });
    if (!updateResult.success) {
      return updateResult;
    }

      // Record adjustment as sale (non-blocking - don't fail if this fails)
      try {
        const adjustmentData = {
        product_id: productId,
        adjustment_type: 'sale',
        quantity_change: -quantitySold,
        previous_quantity: currentStock,
        new_quantity: newStock,
        reason: 'POS Sale',
          operator_name: operatorName,
        created_at: formatMySQLDateTime(new Date()),
        };
        
        const adjustmentResult = await apiRequest<{ id: number }>("POST", {
          table: "stock_adjustments",
          data: adjustmentData,
    });
        
        // Log transaction
        if (adjustmentResult.success && adjustmentResult.id) {
          await logTransaction(
            "stock_adjustment",
            "create",
            "stock_adjustments",
            adjustmentResult.id,
            null,
            adjustmentData,
            `Stock sale: -${quantitySold} (${currentStock} → ${newStock})`
          );
        }
      } catch (error) {
        // Log but don't fail the entire operation if stock adjustment recording fails
        console.error(`Failed to record stock adjustment for product ${productId}:`, error);
      }

    return { success: true, newStock };
    } catch (error) {
      console.error(`Failed to record sale for product ${productId}:`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to record sale" 
      };
    }
  },

  // Get adjustment history for a product
  getHistory: async (productId: string, limit = 50) => {
    const result = await apiRequest<StockAdjustmentRecord[]>("GET", {
      table: "stock_adjustments",
      filters: { product_id: productId },
      order_by: "created_at",
      order_dir: "DESC",
      limit,
    });
    return result;
  },

  // Get all recent adjustments
  getAllHistory: async (limit = 100) => {
    const result = await apiRequest<StockAdjustmentRecord[]>("GET", {
      table: "stock_adjustments",
      order_by: "created_at",
      order_dir: "DESC",
      limit,
    });
    return result;
  },

  // Delete stock adjustment
  delete: async (id: number) => {
    const result = await apiRequest("DELETE", {
      table: "stock_adjustments",
      id,
    });
    return result;
  },
};

// Expenses API for always-available items
export interface ExpenseRecord {
  id?: number;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  supplier?: string;
  notes?: string;
  category?: string; // Category/classification for expenses (e.g., "restock", "operational", etc.)
  payment_source?: string; // Payment source (cash, store_funds, gcash, current_sales)
  operator_name?: string;
  created_at?: string;
}

export const expensesApi = {
  // Add expense record
  create: async (expense: Omit<ExpenseRecord, "id" | "created_at">) => {
    const operatorName = getCurrentOperator();
    const expenseData = {
        ...expense,
      operator_name: operatorName,
        created_at: formatMySQLDateTime(new Date()),
    };
    
    const result = await apiRequest<{ id: number }>("POST", {
      table: "expenses",
      data: expenseData,
    });
    
    // Log transaction
    if (result.success && result.id) {
      await logTransaction(
        "expense",
        "create",
        "expenses",
        result.id,
        null,
        expenseData,
        `Expense recorded: ${expense.product_name} - ₱${expense.total_cost.toFixed(2)}`
      );
    }
    
    return result;
  },

  // Get expenses for a product
  getByProduct: async (productId: string, limit = 50) => {
    const result = await apiRequest<ExpenseRecord[]>("GET", {
      table: "expenses",
      filters: { product_id: productId },
      order_by: "created_at",
      order_dir: "DESC",
      limit,
    });
    return result;
  },

  // Get all expenses
  getAll: async (limit = 100) => {
    const result = await apiRequest<ExpenseRecord[]>("GET", {
      table: "expenses",
      order_by: "created_at",
      order_dir: "DESC",
      limit,
    });
    return result;
  },

  // Get unique suppliers from all sources (expenses, stock_adjustments, products, variations)
  getSuppliers: async () => {
    const allSuppliers = new Set<string>();
    
    try {
      // 1. Get suppliers from expenses table
      const expensesResult = await apiRequest<ExpenseRecord[]>("GET", {
        table: "expenses",
        limit: 500,
      });
      if (expensesResult.success && expensesResult.data) {
        expensesResult.data.forEach(e => {
          if (e.supplier && e.supplier.trim()) {
            allSuppliers.add(e.supplier.trim());
          }
        });
      }
      
      // 2. Get suppliers from stock_adjustments table
      const stockResult = await apiRequest<Array<{ supplier?: string }>>("GET", {
        table: "stock_adjustments",
        limit: 500,
      });
      if (stockResult.success && stockResult.data) {
        stockResult.data.forEach(s => {
          if (s.supplier && s.supplier.trim()) {
            allSuppliers.add(s.supplier.trim());
          }
        });
      }
      
      // 3. Get suppliers from products table (suppliers JSON field)
      const productsResult = await productsApi.getAll();
      if (productsResult.success && productsResult.data) {
        productsResult.data.forEach((p: any) => {
          // Parse suppliers from product
          if (p.suppliers) {
            try {
              const suppliers = typeof p.suppliers === 'string' 
                ? JSON.parse(p.suppliers) 
                : p.suppliers;
              if (Array.isArray(suppliers)) {
                suppliers.forEach((s: any) => {
                  if (s && s.name && typeof s.name === 'string' && s.name.trim()) {
                    allSuppliers.add(s.name.trim());
                  }
                });
              }
            } catch {
              // Ignore parse errors
            }
          }
          
          // Parse suppliers from variations
          if (p.variations) {
            try {
              const variations = typeof p.variations === 'string' 
                ? JSON.parse(p.variations) 
                : p.variations;
              if (Array.isArray(variations)) {
                variations.forEach((v: any) => {
                  if (v && v.suppliers && Array.isArray(v.suppliers)) {
                    v.suppliers.forEach((s: any) => {
                      if (s && s.name && typeof s.name === 'string' && s.name.trim()) {
                        allSuppliers.add(s.name.trim());
                      }
                    });
                  }
                });
              }
            } catch {
              // Ignore parse errors
            }
          }
        });
      }
      
      // Convert Set to sorted array
      const suppliersArray = Array.from(allSuppliers).sort();
      return { success: true, data: suppliersArray };
    } catch (error) {
      console.error("Error fetching suppliers:", error);
      return { success: false, data: [], error: String(error) };
    }
  },

  // Delete expense
  delete: async (id: number) => {
    // Get expense data before deletion for logging
    const expenseResult = await expensesApi.getByProduct("", 1000);
    const expenseData = expenseResult.success && expenseResult.data
      ? expenseResult.data.find(e => e.id === id)
      : null;
    
    const result = await apiRequest("DELETE", {
      table: "expenses",
      id,
    });
    
    // Log transaction
    if (result.success && expenseData) {
      await logTransaction(
        "expense",
        "delete",
        "expenses",
        id,
        expenseData,
        null,
        `Expense deleted: ${expenseData.product_name} - ₱${expenseData.total_cost.toFixed(2)}`
      );
    }
    
    return result;
  },
};

// Transaction Log API
export interface TransactionLogRecord {
  id?: number;
  transaction_type: string;
  transaction_id?: number;
  table_name?: string;
  operator_name: string;
  action: "create" | "update" | "delete";
  data_before?: string; // JSON string
  data_after?: string; // JSON string
  description?: string;
  ip_address?: string;
  user_agent?: string;
  created_at?: string;
}

// Helper function to log transactions
const logTransaction = async (
  transactionType: string,
  action: "create" | "update" | "delete",
  tableName: string,
  transactionId: number | null,
  dataBefore: any = null,
  dataAfter: any = null,
  description?: string
): Promise<void> => {
  try {
    const operatorName = getCurrentOperator();
    
    const logData: Omit<TransactionLogRecord, "id" | "created_at"> = {
      transaction_type: transactionType,
      transaction_id: transactionId || null,
      table_name: tableName,
      operator_name: operatorName,
      action,
      data_before: dataBefore ? JSON.stringify(dataBefore) : null,
      data_after: dataAfter ? JSON.stringify(dataAfter) : null,
      description: description || `${action} ${transactionType} in ${tableName}`,
    };

    // Log transaction asynchronously (don't block the main operation)
    apiRequest("POST", {
      table: "transaction_log",
      data: logData,
    }).catch((error) => {
      // Silently fail - don't break the main operation if logging fails
      console.error("Failed to log transaction:", error);
    });
  } catch (error) {
    // Silently fail - don't break the main operation if logging fails
    console.error("Error logging transaction:", error);
  }
};

// Store Funds API
export interface StoreFundTransaction {
  id?: number;
  transaction_type: "add" | "withdraw" | "expense" | "income";
  amount: number;
  balance_after: number;
  notes?: string;
  category?: string;
  operator_name?: string;
  created_at?: string;
}

// GCash Funds API
export interface GCashFundTransaction {
  id?: number;
  transaction_type: "add-credits" | "add-cash" | "gcash-in" | "gcash-out";
  amount: number;
  service_charge?: number;
  credits_balance_after: number;
  cash_balance_after: number;
  notes?: string;
  gcash_number?: string;
  operator_name?: string;
  created_at?: string;
}

export const gcashFundsApi = {
  // Get current balance (latest transaction)
  getBalance: async () => {
    const result = await apiRequest<GCashFundTransaction[]>("GET", {
      table: "gcash_funds",
      order_by: "created_at",
      order_dir: "DESC",
      limit: 1,
    });
    
    if (result.success && result.data && result.data.length > 0) {
      const latest = result.data[0];
      return { 
        success: true, 
        creditsBalance: Number(latest.credits_balance_after),
        cashBalance: Number(latest.cash_balance_after),
      };
    }
    return { success: true, creditsBalance: 0, cashBalance: 0 };
  },

  // Get transaction history
  getHistory: async (limit = 100) => {
    const result = await apiRequest<GCashFundTransaction[]>("GET", {
      table: "gcash_funds",
      order_by: "created_at",
      order_dir: "DESC",
      limit,
    });
    return result;
  },

  // Add transaction
  addTransaction: async (
    transactionType: "add-credits" | "add-cash" | "gcash-in" | "gcash-out",
    amount: number,
    creditsBalanceAfter: number,
    cashBalanceAfter: number,
    serviceCharge: number = 0,
    notes?: string,
    gcashNumber?: string
  ) => {
    const operatorName = getCurrentOperator();

    const transaction: Omit<GCashFundTransaction, "id" | "created_at"> = {
      transaction_type: transactionType,
      amount,
      service_charge: serviceCharge > 0 ? serviceCharge : undefined,
      credits_balance_after: creditsBalanceAfter,
      cash_balance_after: cashBalanceAfter,
      notes,
      gcash_number: gcashNumber,
      operator_name: operatorName,
    };

    const result = await apiRequest<{ id: number }>("POST", {
      table: "gcash_funds",
      data: transaction,
    });

    if (result.success && result.id) {
      const fullTransaction = { 
        ...transaction, 
        id: result.id, 
        created_at: formatMySQLDateTime(new Date()) 
      } as GCashFundTransaction;
      
      // Log transaction
      await logTransaction(
        "gcash_fund",
        "create",
        "gcash_funds",
        result.id,
        null,
        fullTransaction,
        `GCash transaction: ${transactionType} - ₱${amount.toFixed(2)} (Credits: ₱${creditsBalanceAfter.toFixed(2)}, Cash: ₱${cashBalanceAfter.toFixed(2)})`
      );
      
      return {
        success: true,
        transaction: fullTransaction,
      };
    }
    return { success: false, error: result.error || "Failed to add GCash transaction" };
  },
};

export const storeFundsApi = {
  // Get current balance (sum of all transactions)
  getBalance: async () => {
    const result = await apiRequest<StoreFundTransaction[]>("GET", {
      table: "store_funds",
      order_by: "created_at",
      order_dir: "DESC",
      limit: 1,
    });
    
    if (result.success && result.data && result.data.length > 0) {
      return { success: true, balance: result.data[0].balance_after };
    }
    return { success: true, balance: 0 };
  },

  // Get transaction history
  getHistory: async (limit = 100) => {
    const result = await apiRequest<StoreFundTransaction[]>("GET", {
      table: "store_funds",
      order_by: "created_at",
      order_dir: "DESC",
      limit,
    });
    return result;
  },

  // Add funds
  addFunds: async (amount: number, notes?: string, category?: string) => {
    // Get current balance
    const balanceResult = await storeFundsApi.getBalance();
    const currentBalance = balanceResult.balance || 0;
    const newBalance = currentBalance + amount;
    const operatorName = getCurrentOperator();

    const transaction: Omit<StoreFundTransaction, "id" | "created_at"> = {
      transaction_type: "add",
      amount,
      balance_after: newBalance,
      notes,
      category,
      operator_name: operatorName,
    };

    const result = await apiRequest<{ id: number }>("POST", {
      table: "store_funds",
      data: transaction,
    });

    if (result.success && result.id) {
      const fullTransaction = { ...transaction, id: result.id, created_at: formatMySQLDateTime(new Date()) } as StoreFundTransaction;
      
      // Log transaction
      await logTransaction(
        "store_fund",
        "create",
        "store_funds",
        result.id,
        null,
        fullTransaction,
        `Store funds added: ₱${amount.toFixed(2)} (Balance: ₱${newBalance.toFixed(2)})`
      );
      
      return {
        success: true,
        transaction: fullTransaction,
      };
    }
    return { success: false, error: result.error || "Failed to add funds" };
  },

  // Withdraw funds
  withdrawFunds: async (amount: number, notes?: string, category?: string) => {
    // Get current balance
    const balanceResult = await storeFundsApi.getBalance();
    const currentBalance = balanceResult.balance || 0;
    
    if (currentBalance < amount) {
      return { success: false, error: "Insufficient store funds" };
    }

    const newBalance = currentBalance - amount;
    const operatorName = getCurrentOperator();

    const transaction: Omit<StoreFundTransaction, "id" | "created_at"> = {
      transaction_type: "withdraw",
      amount,
      balance_after: newBalance,
      notes,
      category,
      operator_name: operatorName,
    };

    const result = await apiRequest<{ id: number }>("POST", {
      table: "store_funds",
      data: transaction,
    });

    if (result.success && result.id) {
      const fullTransaction = { ...transaction, id: result.id, created_at: formatMySQLDateTime(new Date()) } as StoreFundTransaction;
      
      // Log transaction
      await logTransaction(
        "store_fund",
        "create",
        "store_funds",
        result.id,
        null,
        fullTransaction,
        `Store funds withdrawn: ₱${amount.toFixed(2)} (Balance: ₱${newBalance.toFixed(2)})`
      );
      
      return {
        success: true,
        transaction: fullTransaction,
      };
    }
    return { success: false, error: result.error || "Failed to withdraw funds" };
  },
};

// Transaction Log API
export const transactionLogApi = {
  getAll: async (filters: {
    limit?: number;
    offset?: number;
    transactionType?: string;
    operatorName?: string;
    dateFrom?: string;
    dateTo?: string;
  } = {}) => {
    const { limit = 100, offset = 0, transactionType, operatorName, dateFrom, dateTo } = filters;
    
    const apiFilters: Record<string, string | number> = {};
    if (transactionType) apiFilters["transaction_type"] = transactionType;
    if (operatorName) apiFilters["operator_name"] = operatorName;
    if (dateFrom) apiFilters["created_at__gte"] = dateFrom;
    if (dateTo) apiFilters["created_at__lte"] = dateTo;
    
    const result = await apiRequest<TransactionLogRecord[]>("GET", {
      table: "transaction_log",
      limit,
      offset,
      order_by: "created_at",
      order_dir: "DESC",
      filters: apiFilters,
    });
    return result;
  },
  
  getByOperator: async (operatorName: string, limit = 100) => {
    return transactionLogApi.getAll({ operatorName, limit });
  },
  
  getByType: async (transactionType: string, limit = 100) => {
    return transactionLogApi.getAll({ transactionType, limit });
  },
};

// Categories API
export interface CategoryRecord {
  id?: number;
  name: string;
  parent_id?: number | null;
  is_parent?: number | boolean;
  display_order?: number;
  created_at?: string;
  updated_at?: string;
}

export interface CategoryWithChildren extends CategoryRecord {
  children?: CategoryWithChildren[];
  parent_name?: string;
}


export const categoriesApi = {
  getAll: async () => {
    const result = await apiRequest<CategoryRecord[]>("GET", {
      table: "categories",
      order_by: "display_order",
      order_dir: "ASC",
      limit: 1000,
    });
    return result;
  },

  getById: async (id: number) => {
    const result = await apiRequest<CategoryRecord[]>("GET", {
      table: "categories",
      id,
    });
    return result;
  },

  create: async (category: Omit<CategoryRecord, "id" | "created_at" | "updated_at">) => {
    const operatorName = getCurrentOperator();
    const categoryData = {
      ...category,
      is_parent: category.is_parent ? 1 : 0,
    };
    
    const result = await apiRequest<{ id: number }>("POST", {
      table: "categories",
      data: categoryData,
    });
    
    // Log transaction
    if (result.success && result.id) {
      await logTransaction(
        "category",
        "create",
        "categories",
        result.id,
        null,
        categoryData,
        `Category created: ${category.name}${category.parent_id ? ` (under parent ID: ${category.parent_id})` : ' (root category)'}`
      );
    }
    
    return result;
  },

  update: async (id: number, data: Partial<Omit<CategoryRecord, "id" | "created_at" | "updated_at">>) => {
    // Get category data before update for logging
    const categoryResult = await categoriesApi.getById(id);
    const categoryBefore = categoryResult.success && categoryResult.data && categoryResult.data.length > 0
      ? categoryResult.data[0]
      : null;
    
    const updateData = {
      ...data,
      ...(data.is_parent !== undefined && { is_parent: data.is_parent ? 1 : 0 }),
    };
    
    const result = await apiRequest("PUT", {
      table: "categories",
      id,
      data: updateData,
    });
    
    // Log transaction
    if (result.success && categoryBefore) {
      const categoryAfter = { ...categoryBefore, ...updateData };
      await logTransaction(
        "category",
        "update",
        "categories",
        id,
        categoryBefore,
        categoryAfter,
        `Category updated: ${categoryBefore.name}`
      );
    }
    
    return result;
  },

  delete: async (id: number) => {
    // Get category data before deletion for logging
    const categoryResult = await categoriesApi.getById(id);
    const categoryData = categoryResult.success && categoryResult.data && categoryResult.data.length > 0
      ? categoryResult.data[0]
      : null;
    
    // Check if category has children
    const allCategories = await categoriesApi.getAll();
    if (allCategories.success && allCategories.data) {
      const hasChildren = allCategories.data.some((c: CategoryRecord) => c.parent_id === id);
      if (hasChildren) {
        return {
          success: false,
          error: "Cannot delete category with child categories. Please move or delete children first.",
        };
      }
    }
    
    const result = await apiRequest("DELETE", {
      table: "categories",
      id,
    });
    
    // Log transaction
    if (result.success && categoryData) {
      await logTransaction(
        "category",
        "delete",
        "categories",
        id,
        categoryData,
        null,
        `Category deleted: ${categoryData.name}`
      );
    }
    
    return result;
  },

  // Get categories in hierarchical structure
  getHierarchical: async (): Promise<ApiResponse<CategoryWithChildren[]>> => {
    const result = await categoriesApi.getAll();
    if (!result.success || !result.data) {
      return result as ApiResponse<CategoryWithChildren[]>;
    }

    const categories = result.data as CategoryRecord[];
    
    // Create a map for quick lookup
    const categoryMap = new Map<number, CategoryWithChildren>();
    const rootCategories: CategoryWithChildren[] = [];

    // First pass: create all category objects
    categories.forEach((cat) => {
      categoryMap.set(cat.id!, {
        ...cat,
        is_parent: Boolean(cat.is_parent),
        children: [],
      });
    });

    // Second pass: build hierarchy
    categories.forEach((cat) => {
      const category = categoryMap.get(cat.id!)!;
      if (cat.parent_id === null || cat.parent_id === undefined) {
        rootCategories.push(category);
      } else {
        const parent = categoryMap.get(cat.parent_id);
        if (parent) {
          if (!parent.children) {
            parent.children = [];
          }
          parent.children.push(category);
        }
      }
    });

    // Sort children within each parent
    const sortCategories = (cats: CategoryWithChildren[]) => {
      cats.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
      cats.forEach((cat) => {
        if (cat.children && cat.children.length > 0) {
          sortCategories(cat.children);
        }
      });
    };

    sortCategories(rootCategories);

    return {
      success: true,
      data: rootCategories,
    };
  },

  // Get flat list with parent names
  getFlatWithParents: async (): Promise<ApiResponse<CategoryWithChildren[]>> => {
    const result = await categoriesApi.getAll();
    if (!result.success || !result.data) {
      return result as ApiResponse<CategoryWithChildren[]>;
    }

    const categories = result.data as CategoryRecord[];
    const categoryMap = new Map<number, CategoryRecord>();
    
    // Build map for parent lookup
    categories.forEach((cat) => {
      categoryMap.set(cat.id!, cat);
    });

    // Add parent names
    const categoriesWithParents = categories.map((cat) => {
      const category: CategoryWithChildren = {
        ...cat,
        is_parent: Boolean(cat.is_parent),
      };
      if (cat.parent_id) {
        const parent = categoryMap.get(cat.parent_id);
        if (parent) {
          category.parent_name = parent.name;
        }
      }
      return category;
    });

    return {
      success: true,
      data: categoriesWithParents,
    };
  },
};


export const generateAlterTableSQL = (tableName: string, missingColumns: string[]): string => {
  const schema = REQUIRED_SCHEMA[tableName as keyof typeof REQUIRED_SCHEMA];
  if (!schema) return "";

  const alterStatements = missingColumns.map((colName) => {
    const colDef = schema.columns.find((c) => c.name.toLowerCase() === colName.toLowerCase());
    if (!colDef) return null;
    return `ADD COLUMN ${colDef.name} ${colDef.type}`;
  }).filter(Boolean);

  if (alterStatements.length === 0) return "";

  return `ALTER TABLE ${tableName}\n  ${alterStatements.join(",\n  ")};`;
};

// Required schema for the POS system
export const REQUIRED_SCHEMA = {
  products: {
    tableName: "products",
    columns: [
      { name: "id", type: "INT AUTO_INCREMENT PRIMARY KEY" },
      { name: "name", type: "VARCHAR(255) NOT NULL" },
      { name: "price", type: "DECIMAL(10,2) NOT NULL" },
      { name: "category", type: "VARCHAR(100)" },
      { name: "image_url", type: "TEXT" },
      { name: "stock_quantity", type: "INT DEFAULT 0" },
      { name: "low_stock_threshold", type: "INT DEFAULT 5" },
      { name: "skip_stock_tracking", type: "TINYINT(1) DEFAULT 0" },
      { name: "variations", type: "JSON DEFAULT NULL" },
      { name: "created_at", type: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP" },
    ],
    createSQL: `CREATE TABLE IF NOT EXISTS products (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      price DECIMAL(10,2) NOT NULL,
      category VARCHAR(100),
      image_url TEXT,
      stock_quantity INT DEFAULT 0,
      low_stock_threshold INT DEFAULT 5,
      skip_stock_tracking TINYINT(1) DEFAULT 0,
      variations JSON DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
  },
  sales: {
    tableName: "sales",
    columns: [
      { name: "id", type: "INT AUTO_INCREMENT PRIMARY KEY" },
      { name: "items", type: "JSON" },
      { name: "total", type: "DECIMAL(10,2) NOT NULL" },
      { name: "payment_method", type: "VARCHAR(50) NOT NULL" },
      { name: "amount_tendered", type: "DECIMAL(10,2)" },
      { name: "change_amount", type: "DECIMAL(10,2)" },
      { name: "bottle_deposit_refunded", type: "TINYINT(1) DEFAULT 0" },
      { name: "created_at", type: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP" },
    ],
    createSQL: `CREATE TABLE IF NOT EXISTS sales (
      id INT AUTO_INCREMENT PRIMARY KEY,
      items JSON,
      total DECIMAL(10,2) NOT NULL,
      payment_method VARCHAR(50) NOT NULL,
      amount_tendered DECIMAL(10,2),
      change_amount DECIMAL(10,2),
      bottle_deposit_refunded TINYINT(1) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
  },
  quantity_history: {
    tableName: "quantity_history",
    columns: [
      { name: "id", type: "INT AUTO_INCREMENT PRIMARY KEY" },
      { name: "product_id", type: "VARCHAR(50) NOT NULL" },
      { name: "quantities", type: "JSON" },
    ],
    createSQL: `CREATE TABLE IF NOT EXISTS quantity_history (
      id INT AUTO_INCREMENT PRIMARY KEY,
      product_id VARCHAR(50) NOT NULL,
      quantities JSON,
      UNIQUE KEY unique_product (product_id)
    )`,
  },
  stock_adjustments: {
    tableName: "stock_adjustments",
    columns: [
      { name: "id", type: "INT AUTO_INCREMENT PRIMARY KEY" },
      { name: "product_id", type: "VARCHAR(50) NOT NULL" },
      { name: "adjustment_type", type: "ENUM('add', 'remove', 'set', 'sale') NOT NULL" },
      { name: "quantity_change", type: "INT NOT NULL" },
      { name: "previous_quantity", type: "INT NOT NULL" },
      { name: "new_quantity", type: "INT NOT NULL" },
      { name: "reason", type: "VARCHAR(255)" },
      { name: "supplier", type: "VARCHAR(255)" },
      { name: "unit_cost", type: "DECIMAL(10,2)" },
      { name: "total_cost", type: "DECIMAL(10,2)" },
      { name: "notes", type: "TEXT" },
      { name: "created_at", type: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP" },
    ],
    createSQL: `CREATE TABLE IF NOT EXISTS stock_adjustments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      product_id VARCHAR(50) NOT NULL,
      adjustment_type ENUM('add', 'remove', 'set', 'sale') NOT NULL,
      quantity_change INT NOT NULL,
      previous_quantity INT NOT NULL,
      new_quantity INT NOT NULL,
      reason VARCHAR(255),
      supplier VARCHAR(255),
      unit_cost DECIMAL(10,2),
      total_cost DECIMAL(10,2),
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_product_id (product_id),
      INDEX idx_created_at (created_at),
      INDEX idx_supplier (supplier)
    )`,
  },
  expenses: {
    tableName: "expenses",
    columns: [
      { name: "id", type: "INT AUTO_INCREMENT PRIMARY KEY" },
      { name: "product_id", type: "VARCHAR(50) NOT NULL" },
      { name: "product_name", type: "VARCHAR(255) NOT NULL" },
      { name: "quantity", type: "INT NOT NULL" },
      { name: "unit_cost", type: "DECIMAL(10,2) NOT NULL" },
      { name: "total_cost", type: "DECIMAL(10,2) NOT NULL" },
      { name: "supplier", type: "VARCHAR(255)" },
      { name: "notes", type: "TEXT" },
      { name: "category", type: "VARCHAR(100)" },
      { name: "payment_source", type: "VARCHAR(50) DEFAULT 'cash'" },
      { name: "created_at", type: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP" },
    ],
    createSQL: `CREATE TABLE IF NOT EXISTS expenses (
      id INT AUTO_INCREMENT PRIMARY KEY,
      product_id VARCHAR(50) NOT NULL,
      product_name VARCHAR(255) NOT NULL,
      quantity INT NOT NULL,
      unit_cost DECIMAL(10,2) NOT NULL,
      total_cost DECIMAL(10,2) NOT NULL,
      supplier VARCHAR(255),
      notes TEXT,
      category VARCHAR(100),
      payment_source VARCHAR(50) DEFAULT 'cash',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_product_id (product_id),
      INDEX idx_supplier (supplier),
      INDEX idx_category (category),
      INDEX idx_created_at (created_at)
    )`,
  },
  store_funds: {
    tableName: "store_funds",
    columns: [
      { name: "id", type: "INT AUTO_INCREMENT PRIMARY KEY" },
      { name: "transaction_type", type: "ENUM('add', 'withdraw', 'expense', 'income') NOT NULL" },
      { name: "amount", type: "DECIMAL(10,2) NOT NULL" },
      { name: "balance_after", type: "DECIMAL(10,2) NOT NULL" },
      { name: "notes", type: "TEXT" },
      { name: "category", type: "VARCHAR(100)" },
      { name: "created_at", type: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP" },
    ],
    createSQL: `CREATE TABLE IF NOT EXISTS store_funds (
      id INT AUTO_INCREMENT PRIMARY KEY,
      transaction_type ENUM('add', 'withdraw', 'expense', 'income') NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      balance_after DECIMAL(10,2) NOT NULL,
      notes TEXT,
      category VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_transaction_type (transaction_type),
      INDEX idx_created_at (created_at)
    )`,
  },
  gcash_funds: {
    tableName: "gcash_funds",
    columns: [
      { name: "id", type: "INT AUTO_INCREMENT PRIMARY KEY" },
      { name: "transaction_type", type: "ENUM('add-credits', 'add-cash', 'gcash-in', 'gcash-out') NOT NULL" },
      { name: "amount", type: "DECIMAL(10,2) NOT NULL" },
      { name: "service_charge", type: "DECIMAL(10,2) DEFAULT 0" },
      { name: "credits_balance_after", type: "DECIMAL(10,2) NOT NULL" },
      { name: "cash_balance_after", type: "DECIMAL(10,2) NOT NULL" },
      { name: "notes", type: "TEXT" },
      { name: "gcash_number", type: "VARCHAR(20)" },
      { name: "operator_name", type: "VARCHAR(100)" },
      { name: "created_at", type: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP" },
    ],
    createSQL: `CREATE TABLE IF NOT EXISTS gcash_funds (
      id INT AUTO_INCREMENT PRIMARY KEY,
      transaction_type ENUM('add-credits', 'add-cash', 'gcash-in', 'gcash-out') NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      service_charge DECIMAL(10,2) DEFAULT 0,
      credits_balance_after DECIMAL(10,2) NOT NULL,
      cash_balance_after DECIMAL(10,2) NOT NULL,
      notes TEXT,
      gcash_number VARCHAR(20),
      operator_name VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_transaction_type (transaction_type),
      INDEX idx_created_at (created_at),
      INDEX idx_operator_name (operator_name)
    )`,
  },
  categories: {
    tableName: "categories",
    columns: [
      { name: "id", type: "INT AUTO_INCREMENT PRIMARY KEY" },
      { name: "name", type: "VARCHAR(100) NOT NULL" },
      { name: "parent_id", type: "INT DEFAULT NULL" },
      { name: "is_parent", type: "TINYINT(1) DEFAULT 0" },
      { name: "display_order", type: "INT DEFAULT 0" },
      { name: "created_at", type: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP" },
      { name: "updated_at", type: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP" },
    ],
    createSQL: `CREATE TABLE IF NOT EXISTS categories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      parent_id INT DEFAULT NULL,
      is_parent TINYINT(1) DEFAULT 0,
      display_order INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_parent_id (parent_id),
      INDEX idx_is_parent (is_parent),
      INDEX idx_display_order (display_order),
      FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL,
      UNIQUE KEY unique_name (name)
    )`,
  },
  transaction_log: {
    tableName: "transaction_log",
    columns: [
      { name: "id", type: "INT AUTO_INCREMENT PRIMARY KEY" },
      { name: "transaction_type", type: "VARCHAR(50) NOT NULL" },
      { name: "transaction_id", type: "INT DEFAULT NULL" },
      { name: "table_name", type: "VARCHAR(100) DEFAULT NULL" },
      { name: "operator_name", type: "VARCHAR(100) NOT NULL" },
      { name: "action", type: "VARCHAR(50) NOT NULL" },
      { name: "data_before", type: "JSON DEFAULT NULL" },
      { name: "data_after", type: "JSON DEFAULT NULL" },
      { name: "description", type: "TEXT" },
      { name: "ip_address", type: "VARCHAR(45) DEFAULT NULL" },
      { name: "user_agent", type: "TEXT DEFAULT NULL" },
      { name: "created_at", type: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP" },
    ],
    createSQL: `CREATE TABLE IF NOT EXISTS transaction_log (
      id INT AUTO_INCREMENT PRIMARY KEY,
      transaction_type VARCHAR(50) NOT NULL,
      transaction_id INT DEFAULT NULL,
      table_name VARCHAR(100) DEFAULT NULL,
      operator_name VARCHAR(100) NOT NULL,
      action VARCHAR(50) NOT NULL,
      data_before JSON DEFAULT NULL,
      data_after JSON DEFAULT NULL,
      description TEXT,
      ip_address VARCHAR(45) DEFAULT NULL,
      user_agent TEXT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_transaction_type (transaction_type),
      INDEX idx_operator_name (operator_name),
      INDEX idx_created_at (created_at),
      INDEX idx_transaction_id (transaction_id, transaction_type),
      INDEX idx_table_name (table_name)
    )`,
  },
};

