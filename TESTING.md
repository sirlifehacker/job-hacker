# Testing Guide

This guide will help you test the DOCX renderer service locally before deploying to production.

## Prerequisites

1. Install dependencies:
   ```bash
   npm install
   ```

2. Make sure you have a DOCX template file (or use the auto-generated test template)

## Quick Test

### Step 1: Start the Server

In one terminal window, start the server:

```bash
npm start
```

You should see:
```
Docx engine running on port 3000
```

### Step 2: Run Automated Tests

In another terminal window, run the test script:

**On Windows (PowerShell):**
```powershell
.\test.ps1
```

**On Mac/Linux:**
```bash
npm test
```

**Or directly with Node:**
```bash
node test.js
```

This will:
- Create a test DOCX template (if it doesn't exist)
- Test the `/health` endpoint
- Test the `/` root endpoint
- Test the `/render` endpoint with sample data
- Test error handling
- Save the rendered output to `test-output.docx` for inspection

## Manual Testing

### Test 1: Health Check

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "ok",
  "message": "Docx renderer service is running",
  "timestamp": "2024-..."
}
```

### Test 2: Root Endpoint

```bash
curl http://localhost:3000/
```

Expected response:
```json
{
  "service": "DOCX Renderer Service",
  "version": "1.0.0",
  "endpoints": {
    "health": "GET /health",
    "render": "POST /render"
  }
}
```

### Test 3: Render Endpoint (with your template)

First, convert your DOCX template to Base64:

**On Windows (PowerShell):**
```powershell
$bytes = [System.IO.File]::ReadAllBytes("path\to\your\template.docx")
$base64 = [System.Convert]::ToBase64String($bytes)
$base64 | Out-File -Encoding ASCII template-base64.txt
```

**On Mac/Linux:**
```bash
base64 -i your-template.docx -o template-base64.txt
```

**Or using Node.js:**
```bash
node -e "const fs=require('fs'); console.log(fs.readFileSync('your-template.docx').toString('base64'))" > template-base64.txt
```

Then create a test request file `test-request.json`:

```json
{
  "templateBase64": "PASTE_YOUR_BASE64_HERE",
  "data": {
    "summary_bullets": [
      "Experienced developer with 5+ years",
      "Strong problem-solving skills",
      "Proven track record"
    ],
    "head_vendor_mgmt_bullets": [
      "Managed vendor relationships",
      "Optimized vendor processes"
    ],
    "eu_vendor_partner_bullets": [],
    "na_sales_ops_bullets": [],
    "decathlon_bullets": [],
    "pwc_bullets": [],
    "virtusa_bullets": [],
    "saltnsoap_bullets": [],
    "international_bullets": [],
    "skills": "JavaScript, Node.js, Express, React, Python",
    "tools": "VS Code, Git, Docker, AWS"
  }
}
```

**On Windows (PowerShell):**
```powershell
$json = Get-Content test-request.json -Raw
Invoke-RestMethod -Uri http://localhost:3000/render -Method POST -Body $json -ContentType "application/json" | ConvertTo-Json -Depth 10
```

**On Mac/Linux:**
```bash
curl -X POST http://localhost:3000/render \
  -H "Content-Type: application/json" \
  -d @test-request.json \
  -o response.json
```

### Test 4: Save the Output

The response will contain `outputBase64`. To save it as a DOCX file:

**On Windows (PowerShell):**
```powershell
$response = Invoke-RestMethod -Uri http://localhost:3000/render -Method POST -Body $json -ContentType "application/json"
[System.IO.File]::WriteAllBytes("output.docx", [System.Convert]::FromBase64String($response.outputBase64))
```

**On Mac/Linux:**
```bash
# Extract base64 from response and decode
cat response.json | jq -r '.outputBase64' | base64 -d > output.docx
```

**Or using Node.js:**
```bash
node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync('response.json')); fs.writeFileSync('output.docx', Buffer.from(data.outputBase64, 'base64'))"
```

## Testing Error Cases

### Test Missing Fields

```bash
curl -X POST http://localhost:3000/render \
  -H "Content-Type: application/json" \
  -d '{"data": {"skills": "test"}}'
```

Expected: `400` status with error message about missing `templateBase64`

### Test Invalid Base64

```bash
curl -X POST http://localhost:3000/render \
  -H "Content-Type: application/json" \
  -d '{"templateBase64": "invalid!!!", "data": {}}'
```

Expected: `400` status with error about invalid Base64

## Using Postman or Insomnia

1. Create a new POST request to `http://localhost:3000/render`
2. Set Headers: `Content-Type: application/json`
3. In Body (raw JSON), paste your request:
   ```json
   {
     "templateBase64": "...",
     "data": { ... }
   }
   ```
4. Send the request
5. Check the response - it should have `success: true` and `outputBase64`
6. Copy the `outputBase64` value and decode it to verify the DOCX

## Verifying the Output

After getting a successful response:

1. Save the `outputBase64` as a DOCX file (see Test 4 above)
2. Open the DOCX file in Microsoft Word or LibreOffice
3. Verify that:
   - All placeholders are replaced with actual data
   - Lists/bullets are rendered correctly
   - Formatting is preserved
   - No template syntax errors

## Common Issues

### Server not starting
- Check if port 3000 is already in use
- Try changing the port: `PORT=3001 npm start`

### Template not rendering correctly
- Check your template syntax matches Docxtemplater format
- Verify all data fields in your JSON match template placeholders
- Check server logs for detailed error messages

### Timeout errors
- Large templates may take longer to process
- Check the `metadata.processingTimeMs` in the response
- Consider reducing template size or complexity

### Base64 encoding issues
- Make sure you're using the correct encoding (no line breaks in Base64 string)
- Verify the Base64 string is complete (not truncated)

## Next Steps

Once all tests pass locally:

1. Review the `DEPLOYMENT.md` guide
2. Deploy to your chosen platform (Railway, Render, etc.)
3. Test the deployed URL with the same requests
4. Configure your n8n workflow to use the deployed URL

