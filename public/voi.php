<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method Not Allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$cmd  = isset($input['cmd'])  ? trim($input['cmd'])  : '';
$data = isset($input['data']) ? $input['data']        : [];

if ($cmd === '') {
    http_response_code(400);
    echo json_encode(['error' => 'cmd parameter is required']);
    exit;
}

// Allowlist: map cmd -> [method, path]
$routes = [
    'v1/auth/verify/phone'           => ['POST', '/v1/auth/verify/phone'],
    'v2/auth/verify/code'            => ['POST', '/v2/auth/verify/code'],
    'v1/auth/verify/presence'        => ['POST', '/v1/auth/verify/presence'],
    'v3/auth/verify/device/activate' => ['POST', '/v3/auth/verify/device/activate'],
    'v1/auth/session'                => ['POST', '/v1/auth/session'],
    'v1/zones'                       => ['GET',  '/v1/zones'],
    'v2/rides/vehicles'              => ['GET',  '/v2/rides/vehicles'],
];

if (!array_key_exists($cmd, $routes)) {
    http_response_code(400);
    echo json_encode(['error' => 'Unknown command']);
    exit;
}

[$method, $path] = $routes[$cmd];

$voiBaseUrl = 'https://api.voiapp.io';
$url = $voiBaseUrl . $path;

$curlHeaders = ['Content-Type: application/json'];

// Extract access token from data and place it in the request header
if (isset($data['access_token'])) {
    $curlHeaders[] = 'x-access-token: ' . $data['access_token'];
    unset($data['access_token']);
}

$ch = curl_init();
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 10);
curl_setopt($ch, CURLOPT_HTTPHEADER, $curlHeaders);

if ($method === 'GET') {
    if (!empty($data)) {
        $url .= '?' . http_build_query($data);
    }
    curl_setopt($ch, CURLOPT_HTTPGET, true);
} else {
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
}

curl_setopt($ch, CURLOPT_URL, $url);

$response  = curl_exec($ch);
$httpCode  = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_errno($ch);

curl_close($ch);

if ($curlError) {
    http_response_code(502);
    echo json_encode(['error' => 'Failed to fetch data from Voi API']);
    exit;
}

http_response_code($httpCode);
echo $response;
