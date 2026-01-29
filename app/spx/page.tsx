"use client"

import { SPXQuoteCard } from "@/components/spx-quote-card"

// Minimal SPX Quote Demo Page
// Polls /api/quotes/spx every 2 seconds for live data

export default function SPXPage() {
  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Live SPX Quote</h1>
          <p className="text-sm text-muted-foreground">
            Real-time S&P 500 index data via Public.com API
          </p>
        </div>
        
        <SPXQuoteCard pollInterval={2000} />
        
        <div className="text-center text-xs text-muted-foreground space-y-1">
          <p>Data refreshes every 2 seconds</p>
          <p>Server-side API keys - never exposed to client</p>
        </div>
      </div>
    </main>
  )
}

/*
README: SPX Quote Integration with Public.com API
================================================

## Environment Variables Required

Set these in your Vercel project or .env.local file:

```
PUBLIC_API_KEY=your_public_api_key_here
PUBLIC_ACCOUNT_ID=your_public_account_id_here
```

## How It Works

1. **Server Route** (`/app/api/quotes/spx/route.ts`):
   - Resolves SPX instrument via Public.com API
   - Fetches quote using POST to /userapigateway/marketdata/{accountId}/quotes
   - Returns normalized JSON response
   - API keys NEVER exposed to client

2. **Client Component** (`/components/spx-quote-card.tsx`):
   - Polls /api/quotes/spx every 2 seconds
   - Handles loading and error states
   - Displays last price, change, bid/ask, and timestamp

## Local Development

1. Create `.env.local` in project root:
   ```
   PUBLIC_API_KEY=your_key
   PUBLIC_ACCOUNT_ID=your_account_id
   ```

2. Run the dev server:
   ```
   npm run dev
   ```

3. Visit http://localhost:3000/spx

## Deployment on Vercel

1. Go to your Vercel project settings
2. Navigate to Environment Variables
3. Add:
   - `PUBLIC_API_KEY` - Your Public.com API key
   - `PUBLIC_ACCOUNT_ID` - Your Public.com account ID
4. Redeploy the project

## API Response Format

```json
{
  "symbol": "SPX",
  "type": "INDEX",
  "last": 6032.38,
  "bid": 6032.10,
  "ask": 6032.50,
  "change": 15.42,
  "changePct": 0.26,
  "updatedAt": "2025-01-27T18:30:00.000Z",
  "source": "public.com"
}
```

## Notes

- SPX may resolve to SPY if index data is unavailable
- Uses no-store cache to always get fresh data
- Polling interval is configurable via pollInterval prop
*/
