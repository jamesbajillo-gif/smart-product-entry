// MySQL API Service - works with the General-Purpose MySQL CRUD API

// Allow manual override via localStorage
const getApiUrl = (): string => {
  const manualUrl = localStorage.getItem("mysql-api-url");
  if (manualUrl) return manualUrl;
  return import.meta.env.VITE_MYSQL_API_URL || "";
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
    const result = await apiRequest<Array<{ id: string; name: string; price: number; category?: string }>>(
      "GET",
      { table: "products", limit: 1000 }
    );
    return result;
  },

  create: async (product: { name: string; price: number; category?: string }) => {
    const result = await apiRequest<{ id: number }>("POST", {
      table: "products",
      data: product,
    });
    return result;
  },

  update: async (id: string, data: { name?: string; price?: number; category?: string }) => {
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

export const salesApi = {
  getAll: async (limit = 100) => {
    const result = await apiRequest<SaleRecord[]>("GET", {
      table: "sales",
      limit,
      order_by: "created_at",
      order_dir: "DESC",
    });
    return result;
  },

  create: async (sale: Omit<SaleRecord, "id" | "created_at">) => {
    const result = await apiRequest<{ id: number }>("POST", {
      table: "sales",
      data: {
        ...sale,
        created_at: new Date().toISOString(),
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

  // Create table using raw SQL
  createTable: async (createTableSQL: string) => {
    const result = await apiRequest<unknown>("POST", { action: "query", query: createTableSQL });
    return result;
  },
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
      { name: "created_at", type: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP" },
    ],
    createSQL: `CREATE TABLE IF NOT EXISTS products (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      price DECIMAL(10,2) NOT NULL,
      category VARCHAR(100),
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
};


