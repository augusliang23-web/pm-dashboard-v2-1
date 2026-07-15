export function applyCors(request, response, allowedOrigin) {
  const origin = request.headers.origin;
  if (origin !== allowedOrigin) return false;

  response.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  response.setHeader('Vary', 'Origin');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  return true;
}

export function handlePreflight(request, response, allowedOrigin) {
  if (request.method !== 'OPTIONS') return false;
  if (!applyCors(request, response, allowedOrigin)) {
    response.writeHead(403).end();
    return true;
  }
  response.writeHead(204).end();
  return true;
}
