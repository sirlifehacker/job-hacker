# Deployment Guide for n8n Cloud

This service needs to be publicly accessible for n8n cloud to call it. Here are recommended deployment options:

## Quick Deploy Options

### Railway
1. Connect your GitHub repo to Railway
2. Railway auto-detects Node.js and runs `npm start`
3. Your service will be available at `https://your-app.railway.app`
4. Free tier available with usage limits

### Render
1. Create a new Web Service
2. Connect your GitHub repo
3. Build command: `npm install`
4. Start command: `npm start`
5. Free tier available (spins down after inactivity)

### Fly.io
1. Install Fly CLI: `flyctl install`
2. Run: `flyctl launch` (creates `fly.toml`)
3. Deploy: `flyctl deploy`
4. Free tier with generous limits

### Heroku
1. Create a new app
2. Connect GitHub repo
3. Deploy branch
4. Note: Free tier discontinued, paid plans available

## Environment Variables

Set these in your deployment platform:

- `PORT` - Port to listen on (usually auto-set by platform)
- `NODE_ENV` - Set to `production` for production deployments

## Testing Your Deployment

Once deployed, test with:

```bash
curl https://your-service-url.com/health
```

Should return:
```json
{
  "status": "ok",
  "message": "Docx renderer service is running",
  "timestamp": "2024-..."
}
```

## n8n Cloud Configuration

In your n8n workflow:

1. **HTTP Request Node Settings:**
   - URL: `https://your-service-url.com/render`
   - Method: `POST`
   - Body Content Type: `JSON`
   - Timeout: `60` seconds (or maximum allowed)
   - Response Format: `JSON`

2. **Request Body:**
   ```json
   {
     "templateBase64": "{{ $json.templateBase64 }}",
     "data": {
       "summary_bullets": {{ $json.summary_bullets }},
       "skills": "{{ $json.skills }}"
     }
   }
   ```

3. **Handle Response:**
   - Access output: `{{ $json.outputBase64 }}`
   - Save to file or use in next node

## Security Considerations

For production use, consider adding:

1. **API Key Authentication** - Add a simple API key check
2. **Rate Limiting** - Prevent abuse
3. **HTTPS Only** - Most platforms provide this automatically
4. **Request Size Limits** - Already implemented (40MB template limit)

## Monitoring

Check your deployment platform's logs to monitor:
- Request processing times
- Error rates
- Template sizes
- Success/failure rates

The service logs include timestamps and processing metrics for debugging.

