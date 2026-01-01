<?php
/**
 * Google Images Search Proxy
 * 
 * This file proxies requests to the Google Images Search API to avoid CORS issues.
 * Place this file in the same directory as your MySQL API (api.techpinoy.net/gsearch-proxy.php)
 * 
 * Usage:
 * POST /gsearch-proxy.php
 * Body: { "product": "laptop", "variation": "black" }
 */

header('Content-Type: application/xml; charset=UTF-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Get request data
$input = file_get_contents('php://input');
$data = json_decode($input, true);

// Get product and variation from POST data or query params
$product = $data['product'] ?? $_GET['product'] ?? '';
$variation = $data['variation'] ?? $_GET['variation'] ?? '';

// Validate that at least one parameter is provided
if (empty($product) && empty($variation)) {
    http_response_code(400);
    echo '<?xml version="1.0" encoding="UTF-8"?>';
    echo '<error>Missing required parameters. Please provide at least one of: product or variation</error>';
    exit;
}

// Build the Google Images API URL
$params = [];
if (!empty($product)) {
    $params[] = 'product=' . urlencode($product);
}
if (!empty($variation)) {
    $params[] = 'variation=' . urlencode($variation);
}

$apiUrl = 'https://api.techpinoy.net/gsearch/?' . implode('&', $params);

// Make the request to the Google Images API
$ch = curl_init($apiUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 30);
curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$error = curl_error($ch);
curl_close($ch);

// Handle errors
if ($response === false || !empty($error)) {
    http_response_code(500);
    echo '<?xml version="1.0" encoding="UTF-8"?>';
    echo '<error>Failed to fetch images: ' . htmlspecialchars($error) . '</error>';
    exit;
}

if ($httpCode !== 200) {
    http_response_code($httpCode);
    echo $response;
    exit;
}

// Return the XML response
echo $response;
?>

