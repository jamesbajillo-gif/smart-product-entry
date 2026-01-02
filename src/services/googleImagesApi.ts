export interface GoogleImageResult {
  query: string;
  product: string;
  variation: string;
  count: number;
  links: string[];
}

/**
 * Parses XML response from Google Images API
 */
function parseXmlResponse(xmlText: string, product: string, variation?: string): GoogleImageResult {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

  // Check for parsing errors
  const parserError = xmlDoc.querySelector('parsererror');
  if (parserError) {
    throw new Error('Failed to parse XML response');
  }

  // Check for error element in response
  const errorElement = xmlDoc.querySelector('error');
  if (errorElement) {
    throw new Error(errorElement.textContent || 'Unknown error from API');
  }

  // Parse XML structure
  const query = xmlDoc.querySelector('query')?.textContent || '';
  const productName = xmlDoc.querySelector('product')?.textContent || product;
  const variationName = xmlDoc.querySelector('variation')?.textContent || variation || '';
  const count = parseInt(xmlDoc.querySelector('count')?.textContent || '0', 10);
  
  // Extract all link elements
  const linkElements = xmlDoc.querySelectorAll('link');
  const links: string[] = [];
  linkElements.forEach((link) => {
    const url = link.textContent?.trim();
    if (url && url.length > 0) {
      links.push(url);
    }
  });

  return {
    query,
    product: productName,
    variation: variationName,
    count,
    links,
  };
}

/**
 * Searches Google Images using the techpinoy.net API
 * Handles CORS by trying multiple methods:
 * 1. Backend proxy endpoint (if available)
 * 2. Direct fetch (if CORS allows)
 * 3. CORS proxy service (fallback)
 * 
 * The search query is built as: "sari sari store" + product name + variation name
 * Example: "sari sari store coke mismo"
 * 
 * @param product - Product name to search for
 * @param variation - Optional variation/attribute of the product
 * @returns Promise with image search results
 */
export async function searchGoogleImages(
  product: string,
  variation?: string
): Promise<GoogleImageResult> {
  // Validate that at least one parameter is provided
  if (!product && !variation) {
    throw new Error("At least one of 'product' or 'variation' must be provided");
  }

  // Build search query: "sari sari store" + product name + variation name
  // Example: "sari sari store coke mismo"
  const searchPrefix = "sari sari store";
  const productName = product.trim();
  const variationName = variation?.trim() || "";
  
  // Construct the full search query by combining everything
  // The API combines product + variation with a +, but we want spaces
  // So we'll combine everything into the product parameter
  let fullSearchQuery = searchPrefix;
  if (productName) {
    fullSearchQuery += ` ${productName}`;
  }
  if (variationName) {
    fullSearchQuery += ` ${variationName}`;
  }
  
  // Pass the combined query as the product parameter
  // Don't pass variation to avoid the API adding a + separator
  const params = new URLSearchParams();
  params.append('product', fullSearchQuery);

  const searchUrl = `https://api.techpinoy.net/gsearch/?${params.toString()}`;
  
  // Try methods in order: Vite proxy (dev) -> backend proxy -> direct -> CORS proxy
  const methods = [
    // Method 1: Try Vite dev server proxy (development only)
    async () => {
      // Only try in development (when running on localhost or local IP)
      if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        const isDevelopment = hostname === 'localhost' || 
                            hostname === '127.0.0.1' || 
                            hostname.startsWith('192.168.') ||
                            hostname.startsWith('10.') ||
                            hostname.startsWith('172.');
        
        if (isDevelopment) {
          try {
            const proxyUrl = `/api/gsearch/?${params.toString()}`;
            const response = await fetch(proxyUrl);
            
            if (response.ok) {
              const xmlText = await response.text();
              return parseXmlResponse(xmlText, product, variation);
            }
          } catch (e) {
            // Vite proxy not available, try next method
          }
        }
      }
      throw new Error('Vite proxy not available');
    },

    // Method 2: Try backend proxy endpoint (if available)
    async () => {
      try {
        // Try to use the MySQL API as a proxy
        const { getConfiguredApiUrl } = await import('./mysqlApi');
        const apiUrl = getConfiguredApiUrl();
        const proxyUrl = apiUrl.replace('/mysql/api.php', '/gsearch-proxy.php');
        
        const response = await fetch(proxyUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            product,
            variation,
          }),
        });

        if (response.ok) {
          const xmlText = await response.text();
          return parseXmlResponse(xmlText, product, variation);
        }
      } catch (e) {
        // Backend proxy not available, try next method
      }
      throw new Error('Backend proxy not available');
    },

    // Method 3: Try direct fetch (may fail due to CORS)
    async () => {
      const response = await fetch(searchUrl);
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const xmlText = await response.text();
      return parseXmlResponse(xmlText, product, variation);
    },

    // Method 4: Use CORS proxy (fallback - not recommended for production)
    async () => {
      // Use a CORS proxy service
      // Note: For production, you should set up your own CORS proxy
      const corsProxyUrl = `https://corsproxy.io/?${encodeURIComponent(searchUrl)}`;
      
      const response = await fetch(corsProxyUrl);
      
      if (!response.ok) {
        throw new Error(`CORS proxy request failed: ${response.status} ${response.statusText}`);
      }

      const xmlText = await response.text();
      return parseXmlResponse(xmlText, product, variation);
    },
  ];

  // Try each method until one succeeds
  let lastError: Error | null = null;
  
  for (const method of methods) {
    try {
      return await method();
    } catch (error) {
      // If it's a CORS error or network error, try next method
      if (error instanceof TypeError && error.message.includes('fetch')) {
        lastError = error;
        continue; // Try next method
      }
      
      // If it's our "not available" error, try next method
      if (error instanceof Error && error.message.includes('not available')) {
        lastError = error;
        continue;
      }
      
      // For other errors, check if it's a CORS error
      if (error instanceof Error) {
        const errorMsg = error.message.toLowerCase();
        if (errorMsg.includes('cors') || errorMsg.includes('cross-origin')) {
          lastError = error;
          continue; // Try next method
        }
        // If it's a different error, throw it
        throw error;
      }
      
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  // If all methods failed, throw the last error with helpful message
  throw new Error(
    `Failed to fetch images: ${lastError?.message || 'Unknown error'}. ` +
    `Please ensure CORS is enabled on the API server or set up a backend proxy endpoint.`
  );
}

