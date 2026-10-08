// ============================================================
// API documentation: OpenAPI JSON + a tiny Swagger UI page.
// ============================================================
import { Router } from 'express';
import { openapiSpec } from '../docs/openapi';

export const docs = Router();

docs.get('/openapi.json', (_req, res) => {
  res.json(openapiSpec);
});

docs.get('/docs', (_req, res) => {
  res.type('html').send(`<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>HEAVYY TOP UP ID — API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <style>body{margin:0;background:#f6f7f9}</style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.ui = SwaggerUIBundle({ url: './openapi.json', dom_id: '#swagger-ui' });
  </script>
</body>
</html>`);
});
