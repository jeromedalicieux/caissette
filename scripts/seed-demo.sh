#!/bin/bash
# Seed demo data for testing Rebond
# Usage: ./scripts/seed-demo.sh [API_URL]

API=${1:-"https://rebond-api.jerome-dalicieux9824.workers.dev"}
echo "Seeding $API ..."

# 1. Create shop
echo "--- Création boutique ---"
SHOP=$(curl -s -X POST "$API/shops" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Boutique Démo Rebond",
    "siret": "12345678901234",
    "address": "12 rue du Commerce, 31000 Toulouse",
    "vatRegime": "deposit"
  }')
SHOP_ID=$(echo "$SHOP" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Shop: $SHOP_ID"

if [ -z "$SHOP_ID" ]; then
  echo "Erreur création shop: $SHOP"
  exit 1
fi

# 2. Register user
echo "--- Création utilisateur ---"
USER=$(curl -s -X POST "$API/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"demo@rebond.fr\",
    \"password\": \"demo1234\",
    \"name\": \"Jérôme (démo)\",
    \"shopId\": \"$SHOP_ID\",
    \"role\": \"owner\"
  }")
TOKEN=$(echo "$USER" | grep -o '"token":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Token obtenu: ${TOKEN:0:20}..."

if [ -z "$TOKEN" ]; then
  echo "Erreur register: $USER"
  exit 1
fi

# Helper: authenticated request
api() {
  curl -s -X "$1" "$API$2" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    "$3" "$4"
}

# 3. Create depositors
echo "--- Création déposants ---"
DEP1=$(api POST /api/depositors -d '{
  "firstName": "Marie",
  "lastName": "Martin",
  "email": "marie.martin@example.com",
  "phone": "0612345678",
  "address": "5 place du Capitole, 31000 Toulouse",
  "idDocumentType": "cni",
  "idDocumentNumber": "CNI-123456789",
  "defaultCommissionRate": 4000
}')
DEP1_ID=$(echo "$DEP1" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Déposant 1 (Marie Martin): $DEP1_ID"

DEP2=$(api POST /api/depositors -d '{
  "firstName": "Pierre",
  "lastName": "Dupont",
  "email": "pierre.dupont@example.com",
  "phone": "0698765432",
  "address": "22 allée Jean Jaurès, 31000 Toulouse",
  "idDocumentType": "passport",
  "idDocumentNumber": "PASS-987654321",
  "defaultCommissionRate": 3500
}')
DEP2_ID=$(echo "$DEP2" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Déposant 2 (Pierre Dupont): $DEP2_ID"

DEP3=$(api POST /api/depositors -d '{
  "firstName": "Sophie",
  "lastName": "Leclerc",
  "phone": "0655443322",
  "idDocumentType": "driver_license",
  "idDocumentNumber": "PERM-112233445",
  "defaultCommissionRate": 4500
}')
DEP3_ID=$(echo "$DEP3" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Déposant 3 (Sophie Leclerc): $DEP3_ID"

# 4. Create contracts
echo "--- Création contrats ---"
EXPIRES=$(($(date +%s) * 1000 + 90 * 86400000))

C1=$(api POST /api/contracts -d "{
  \"depositorId\": \"$DEP1_ID\",
  \"commissionRate\": 4000,
  \"expiresAt\": $EXPIRES
}")
echo "Contrat 1: $(echo "$C1" | grep -o '"number":"[^"]*"' | cut -d'"' -f4)"

C2=$(api POST /api/contracts -d "{
  \"depositorId\": \"$DEP2_ID\",
  \"commissionRate\": 3500,
  \"expiresAt\": $EXPIRES
}")
echo "Contrat 2: $(echo "$C2" | grep -o '"number":"[^"]*"' | cut -d'"' -f4)"

# 5. Create items (with depositors → should trigger police ledger)
echo "--- Création articles ---"
api POST /api/items -d "{
  \"name\": \"Veste en cuir vintage\",
  \"category\": \"Vêtements\",
  \"brand\": \"Schott\",
  \"size\": \"M\",
  \"initialPrice\": 8500,
  \"depositorId\": \"$DEP1_ID\",
  \"vatRegime\": \"deposit\",
  \"vatRate\": 2000
}" | echo "  Veste cuir: $(grep -o '"sku":"[^"]*"' | cut -d'"' -f4)"

api POST /api/items -d "{
  \"name\": \"Robe été fleurie\",
  \"category\": \"Vêtements\",
  \"brand\": \"Sézane\",
  \"size\": \"38\",
  \"initialPrice\": 4500,
  \"depositorId\": \"$DEP1_ID\",
  \"vatRegime\": \"deposit\",
  \"vatRate\": 2000
}" | echo "  Robe été: $(grep -o '"sku":"[^"]*"' | cut -d'"' -f4)"

api POST /api/items -d "{
  \"name\": \"Lampe Art Déco\",
  \"category\": \"Décoration\",
  \"brand\": \"\",
  \"initialPrice\": 12000,
  \"depositorId\": \"$DEP2_ID\",
  \"vatRegime\": \"deposit\",
  \"vatRate\": 2000
}" | echo "  Lampe Art Déco: $(grep -o '"sku":"[^"]*"' | cut -d'"' -f4)"

api POST /api/items -d "{
  \"name\": \"Sac à main Louis Vuitton\",
  \"category\": \"Accessoires\",
  \"brand\": \"Louis Vuitton\",
  \"initialPrice\": 35000,
  \"depositorId\": \"$DEP2_ID\",
  \"vatRegime\": \"deposit\",
  \"vatRate\": 2000
}" | echo "  Sac LV: $(grep -o '"sku":"[^"]*"' | cut -d'"' -f4)"

api POST /api/items -d "{
  \"name\": \"Jean Levi's 501\",
  \"category\": \"Vêtements\",
  \"brand\": \"Levi's\",
  \"size\": \"32\",
  \"initialPrice\": 3000,
  \"depositorId\": \"$DEP3_ID\",
  \"vatRegime\": \"deposit\",
  \"vatRate\": 2000
}" | echo "  Jean Levi's: $(grep -o '"sku":"[^"]*"' | cut -d'"' -f4)"

api POST /api/items -d '{
  "name": "Livre ancien - Les Misérables",
  "category": "Livres",
  "initialPrice": 2500,
  "vatRegime": "resale_item_by_item",
  "vatRate": 550
}' | echo "  Livre (stock propre): $(grep -o '"sku":"[^"]*"' | cut -d'"' -f4)"

api POST /api/items -d "{
  \"name\": \"Montre Casio vintage\",
  \"category\": \"Accessoires\",
  \"brand\": \"Casio\",
  \"initialPrice\": 5500,
  \"depositorId\": \"$DEP3_ID\",
  \"vatRegime\": \"deposit\",
  \"vatRate\": 2000
}" | echo "  Montre Casio: $(grep -o '"sku":"[^"]*"' | cut -d'"' -f4)"

echo ""
echo "==================================="
echo "  SEED TERMINÉ"
echo "==================================="
echo ""
echo "Identifiants de connexion :"
echo "  Shop ID : $SHOP_ID"
echo "  Email   : demo@rebond.fr"
echo "  Mot de passe : demo1234"
echo ""
echo "Données créées :"
echo "  3 déposants"
echo "  2 contrats"
echo "  7 articles (5 en dépôt, 1 stock propre, 1 en dépôt)"
echo "  → Vérifier le livre de police pour les entrées auto"
echo ""
