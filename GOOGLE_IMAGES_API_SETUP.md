# Google Images API - CORS Setup Guide

## Problem
The Google Images Search API (`https://api.techpinoy.net/gsearch/`) doesn't have CORS headers enabled, which causes browser requests to fail with a CORS error.

## Solution
The application now tries multiple methods to fetch images, in order of preference:

1. **Vite Dev Server Proxy** (Development only)
2. **Backend Proxy Endpoint** (Production - recommended)
3. **Direct Fetch** (May fail due to CORS)
4. **CORS Proxy Service** (Fallback - not recommended for production)

## Setup Instructions

### For Development (Automatic)
The Vite dev server is already configured to proxy requests. No additional setup needed when running `npm run dev`.

### For Production

#### Option 1: Backend Proxy (Recommended)

1. Upload the `gsearch-proxy.php` file to your server at:
   ```
   https://api.techpinoy.net/gsearch-proxy.php
   ```

2. The proxy will automatically be used by the application.

#### Option 2: Enable CORS on API Server (If you control the server)

If you have access to modify `https://api.techpinoy.net/gsearch/`, add these headers to the PHP file:

```php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
```

#### Option 3: Use CORS Proxy Service (Not Recommended)

The application will automatically fall back to a CORS proxy service if other methods fail. However, this is not recommended for production as:
- It may be slower
- It may have rate limits
- It's a third-party dependency

## Testing

1. Open the Product Management page
2. Click "Add Product" or "Add Variation"
3. Enter a product name
4. Click the "Generate" button next to the image URL field
5. The dialog should load 10 images from Google Images

## Troubleshooting

### Error: "Failed to fetch images: CORS error"
- Make sure the Vite dev server is running (for development)
- Or upload `gsearch-proxy.php` to your server (for production)

### Error: "Backend proxy not available"
- The backend proxy endpoint is not set up
- Upload `gsearch-proxy.php` to your server

### No images showing
- Check browser console for errors
- Verify the API endpoint is accessible: `https://api.techpinoy.net/gsearch/?product=test`
- Check network tab to see which method is being used

## File Locations

- **Frontend API Service**: `src/services/googleImagesApi.ts`
- **Backend Proxy**: `gsearch-proxy.php`
- **Vite Config**: `vite.config.ts` (proxy configuration)

