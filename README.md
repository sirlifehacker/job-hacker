# DOCX Renderer Service

A Node.js microservice that merges JSON data into DOCX templates using Docxtemplater. Designed to be called from n8n or any HTTP client.

## Features

- Accepts Base64-encoded DOCX templates
- Merges JSON data into templates using Docxtemplater
- Returns rendered DOCX files as Base64
- CORS-enabled for cross-origin requests (optimized for n8n cloud)
- Handles large files (up to 50MB request, 40MB template limit)
- Request timeout handling (55s timeout to work within n8n cloud limits)
- Performance logging for debugging
- Size validation to prevent issues with n8n cloud response limits

## Installation

Install dependencies:

```bash
npm install
```

## Running Locally

Start the server:

```bash
npm start
```

The service will run on `http://localhost:3000` by default.

## Testing

Before deploying, test the service locally:

```bash
# In one terminal, start the server
npm start

# In another terminal, run tests
npm test
```

See `TESTING.md` for detailed testing instructions, including:
- Automated test suite
- Manual testing with curl
- Testing with Postman/Insomnia
- Error case testing
- Verifying output files

## API Endpoints

### POST /render

Renders a DOCX template by merging JSON data into it.

**Request Body:**
```json
{
  "templateBase64": "UEsDBBQAAAAI...",  // Base64-encoded DOCX template
  "data": {
    "summary_bullets": ["Bullet point 1", "Bullet point 2"],
    "head_vendor_mgmt_bullets": ["...", "..."],
    "eu_vendor_partner_bullets": ["...", "..."],
    "na_sales_ops_bullets": ["...", "..."],
    "decathlon_bullets": ["...", "..."],
    "pwc_bullets": ["...", "..."],
    "virtusa_bullets": ["...", "..."],
    "saltnsoap_bullets": ["...", "..."],
    "international_bullets": ["...", "..."],
    "skills": "JavaScript, Node.js, Express",
    "tools": "VS Code, Git, Docker"
  }
}
```

**Success Response (200):**
```json
{
  "success": true,
  "outputBase64": "UEsDBBQAAAAI...",
  "metadata": {
    "outputSizeKB": 123.45,
    "processingTimeMs": 234
  }
}
```

**Error Response (400/500):**
```json
{
  "success": false,
  "error": "Error message here"
}
```

### GET /health

Health check endpoint to verify the service is running.

**Response:**
```json
{
  "status": "ok",
  "message": "Docx renderer service is running"
}
```

## Example Usage

### Using curl

```bash
curl -X POST http://localhost:3000/render \
  -H "Content-Type: application/json" \
  -d '{
    "templateBase64": "YOUR_BASE64_ENCODED_DOCX_HERE",
    "data": {
      "summary_bullets": ["Experienced developer", "Strong problem solver"],
      "skills": "JavaScript, Python",
      "tools": "VS Code, Git"
    }
  }'
```

### Using n8n Cloud

**Important Notes for n8n Cloud:**
- n8n cloud has execution time limits (typically 30-60 seconds)
- This service is optimized with a 55-second timeout to work within those limits
- Keep template files reasonable in size (recommended: under 5MB DOCX files)
- The service validates template size before processing

**Setup Steps:**

1. Deploy this service to a publicly accessible host (e.g., Railway, Render, Fly.io, or your own server)
2. In n8n, add an **HTTP Request** node
3. Configure the node:
   - **Method**: POST
   - **URL**: `https://your-deployed-service.com/render` (use HTTPS for n8n cloud)
   - **Authentication**: None (or add if you implement auth)
   - **Body Content Type**: JSON
   - **Response Format**: JSON
   - **Timeout**: 60 seconds (or maximum allowed)
4. In the **Body**, pass:
   ```json
   {
     "templateBase64": "{{ $json.templateBase64 }}",
     "data": {
       "summary_bullets": "{{ $json.summary_bullets }}",
       "skills": "{{ $json.skills }}",
       ...
     }
   }
   ```
5. The response will include `outputBase64` which you can save or use in subsequent nodes

**Troubleshooting:**
- If you get timeout errors, try reducing template size
- Check the `metadata.processingTimeMs` in the response to see actual processing time
- Ensure your service URL is publicly accessible (n8n cloud can't reach localhost)

## Docker

### Build the image

```bash
docker build -t docx-renderer .
```

### Run the container

```bash
docker run -p 3000:3000 docx-renderer
```

The service will be available at `http://localhost:3000`.

## Template Format

Your DOCX template should use Docxtemplater syntax for placeholders:

- Simple variables: `{skills}`, `{tools}`
- Loops: `{#summary_bullets}{.}{/summary_bullets}`
- Conditionals: `{#condition}...{/condition}`

For more information, see the [Docxtemplater documentation](https://docxtemplater.readthedocs.io/).

## Error Handling

The service returns appropriate HTTP status codes:

- `200` - Success
- `400` - Bad request (missing or invalid input, file too large)
- `500` - Server error (template rendering failed)

All errors include a JSON response with `success: false` and an `error` message.

**Common Errors:**
- `Missing required field: templateBase64` - Template not provided
- `Template too large` - Template exceeds 40MB Base64 limit
- `Invalid Base64 encoding` - Template is not valid Base64
- `Template error: ...` - Issue with template syntax or data structure

## Environment Variables

- `PORT` - Port to listen on (default: 3000)

## License

ISC

