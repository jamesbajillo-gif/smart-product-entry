// MySQL API Service - works with the General-Purpose MySQL CRUD API

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

async function apiRequest<T>(
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
    const result = await response.json();
    return result;
  } catch (error) {
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
  }) => {
    const result = await apiRequest<{ id: number }>("POST", {
      table: "products",
      data: product,
    });
    return result;
  },

  update: async (id: string, data: {
    name?: string;
    price?: number;
    category?: string;
    image_url?: string;
    stock_quantity?: number;
    low_stock_threshold?: number;
  }) => {
    const result = await apiRequest("PUT", {
      table: "products",
      id,
      data,
    });
    return result;
  },

  delete: async (id: string) => {
    const result = await apiRequest("DELETE", {
      table: "products",
      id,
    });
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
    const result = await apiRequest<{ id: number }>("POST", {
      table: "sales",
      data: {
        ...sale,
        created_at: sale.created_at 
          ? formatMySQLDateTime(new Date(sale.created_at))
          : formatMySQLDateTime(new Date()),
      },
    });
    return result;
  },

  getById: async (id: number) => {
    const result = await apiRequest<SaleRecord[]>("GET", {
      table: "sales",
      id,
    });
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
    const result = await apiRequest<{
      table: string;
      columns: TableColumn[];
      primary_keys: string[];
      column_count: number;
    }>("GET", { action: "describe", table: tableName });
    return result;
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
    const adjustmentResult = await apiRequest<{ id: number }>("POST", {
      table: "stock_adjustments",
      data: {
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
        created_at: formatMySQLDateTime(new Date()),
      },
    });

    return { success: true, newStock, adjustmentResult };
  },

  // Record sale (auto-called when sale is made)
  recordSale: async (productId: string, quantitySold: number, currentStock: number) => {
    const newStock = Math.max(0, currentStock - quantitySold);

    // Update product stock
    const updateResult = await productsApi.update(productId, { stock_quantity: newStock });
    if (!updateResult.success) {
      return updateResult;
    }

    // Record adjustment as sale
    await apiRequest("POST", {
      table: "stock_adjustments",
      data: {
        product_id: productId,
        adjustment_type: 'sale',
        quantity_change: -quantitySold,
        previous_quantity: currentStock,
        new_quantity: newStock,
        reason: 'POS Sale',
        created_at: formatMySQLDateTime(new Date()),
      },
    });

    return { success: true, newStock };
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
};

// Helper function to generate ALTER TABLE SQL for missing columns
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
      { name: "image_url", type: "VARCHAR(500)" },
      { name: "stock_quantity", type: "INT DEFAULT 0" },
      { name: "low_stock_threshold", type: "INT DEFAULT 5" },
      { name: "created_at", type: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP" },
    ],
    createSQL: `CREATE TABLE IF NOT EXISTS products (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      price DECIMAL(10,2) NOT NULL,
      category VARCHAR(100),
      image_url VARCHAR(500),
      stock_quantity INT DEFAULT 0,
      low_stock_threshold INT DEFAULT 5,
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
      { name: "created_at", type: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP" },
    ],
    createSQL: `CREATE TABLE IF NOT EXISTS sales (
      id INT AUTO_INCREMENT PRIMARY KEY,
      items JSON,
      total DECIMAL(10,2) NOT NULL,
      payment_method VARCHAR(50) NOT NULL,
      amount_tendered DECIMAL(10,2),
      change_amount DECIMAL(10,2),
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
};


