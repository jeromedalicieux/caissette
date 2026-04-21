#!/usr/bin/env bash
# Setup custom domains for Caissette
# Prerequisites: wrangler CLI authenticated, Cloudflare account with domains

set -euo pipefail

echo "=== Caissette — Custom Domain Setup ==="
echo ""
echo "This script provides instructions for configuring custom domains."
echo "You need to run these commands manually after DNS is configured."
echo ""

echo "1. Add DNS records in Cloudflare Dashboard:"
echo "   - api.caissette.fr → CNAME → caissette-api.jerome-music.workers.dev (proxied)"
echo "   - app.caissette.fr → CNAME → caissette-web-488.pages.dev (proxied)"
echo ""

echo "2. Configure Worker custom domain:"
echo "   wrangler domains add api.caissette.fr"
echo ""

echo "3. Configure Pages custom domain (via Dashboard):"
echo "   Cloudflare Dashboard → Pages → caissette-web → Custom domains → Add: app.caissette.fr"
echo ""

echo "4. Update CORS origins in worker (infra/workers/src/index.ts):"
echo "   Add 'https://app.caissette.fr' to the cors origin array"
echo ""

echo "5. Update frontend API URL:"
echo "   Set VITE_API_URL=https://api.caissette.fr in .env.production"
echo ""

echo "6. Set Ed25519 signing key:"
echo "   openssl genpkey -algorithm Ed25519 -out ed25519_private.pem"
echo "   SIGNING_KEY=\$(openssl pkey -in ed25519_private.pem -outform DER | base64)"
echo "   wrangler secret put SIGNING_KEY <<< \"\$SIGNING_KEY\""
echo ""

echo "7. Create .env.production for the frontend:"
echo "   echo 'VITE_API_URL=https://api.caissette.fr' > apps/web/.env.production"
echo ""

echo "Done! After DNS propagation (~5 min with Cloudflare proxy), the app will be live at:"
echo "  - https://app.caissette.fr (frontend)"
echo "  - https://api.caissette.fr (API)"
