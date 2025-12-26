// MySQL API Service - works with the General-Purpose MySQL CRUD API

const API_URL = import.meta.env.VITE_MYSQL_API_URL || "";

interface ApiResponse<T = unknown> {
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
}

async function apiRequest<T>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  options: FetchOptions = {}
): Promise<ApiResponse<T>> {
  const { table, id, data, filters, limit, offset, order_by, order_dir } = options;

  let url = API_URL;
  const params = new URLSearchParams();

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

  if (method !== "GET" && (data || table)) {
    fetchOptions.body = JSON.stringify({
      table,
      id,
      data,
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
  if (!API_URL) return false;
  try {
    const response = await fetch(`${API_URL}?action=info`);
    const result = await response.json();
    return result.success === true;
  } catch {
    return false;
  }
};
