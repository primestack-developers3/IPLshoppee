# Local Invoice API Setup

## Folder Structure

```text
server.mjs
data/
```

The `data/` folder is created automatically when the server starts.

## Project Setup

If you are starting from scratch:

```bash
npm init -y
```

Install the required packages:

```bash
npm install express cors
```

Note: `fs` is built into Node.js, so you do not need to install it separately.

## Run the Server

The server listens on port `3000`.

```bash
npm start
```

Or:

```bash
node server.mjs
```

## API Key

Set an API key before starting the server:

### PowerShell

```powershell
$env:API_KEY = "replace-with-your-secret"
npm start
```

If you do not set `API_KEY`, the server falls back to:

```text
local-dev-api-key
```

## Endpoints

### `POST /create-invoice`

Required header:

```text
x-api-key: your-api-key
```

Request body:

```json
{
  "name": "Siddhu",
  "product": "Premium Jersey",
  "amount": 2499
}
```

### `GET /invoices`

Returns all stored invoices.

## Testing

### cURL

Create an invoice:

```bash
curl -X POST http://localhost:3000/create-invoice \
  -H "Content-Type: application/json" \
  -H "x-api-key: local-dev-api-key" \
  -d "{\"name\":\"Siddhu\",\"product\":\"Premium Jersey\",\"amount\":2499}"
```

Fetch invoices:

```bash
curl http://localhost:3000/invoices \
  -H "x-api-key: local-dev-api-key"
```

### Fetch

```js
await fetch('http://localhost:3000/create-invoice', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'local-dev-api-key'
  },
  body: JSON.stringify({
    name: 'Siddhu',
    product: 'Premium Jersey',
    amount: 2499
  })
});
```

## Public Access

### ngrok

Start the server locally first, then run:

```bash
ngrok http 3000
```

### Cloudflare Tunnel

```bash
cloudflared tunnel --url http://localhost:3000
```

## Notes

- Invoices are stored as individual JSON files inside `data/`
- Only files named like `invoice-*.json` are returned by `GET /invoices`
- All protected routes require the `x-api-key` header
