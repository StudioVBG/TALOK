#!/bin/bash

# Script de test automatisé pour le flux d'ajout de logement
# Teste les endpoints API et le flux complet

set -e

# Couleurs pour l'output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
API_BASE="${NEXT_PUBLIC_APP_URL:-http://localhost:3000}/api"
SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL}"
SUPABASE_ANON_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY}"

echo -e "${YELLOW}🧪 Test du flux d'ajout de logement${NC}\n"

# Vérifier les variables d'environnement
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
    echo -e "${RED}❌ Variables d'environnement manquantes${NC}"
    echo "NEXT_PUBLIC_SUPABASE_URL: ${SUPABASE_URL:-non défini}"
    echo "NEXT_PUBLIC_SUPABASE_ANON_KEY: ${SUPABASE_ANON_KEY:-non défini}"
    exit 1
fi

echo -e "${GREEN}✅ Variables d'environnement configurées${NC}\n"

# Test 1: Vérifier que l'API répond
echo -e "${YELLOW}Test 1: Vérification de l'API...${NC}"
if curl -s -f "${API_BASE}/properties" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ API accessible${NC}\n"
else
    echo -e "${RED}❌ API non accessible à ${API_BASE}${NC}"
    echo "Assurez-vous que le serveur Next.js est démarré (npm run dev)"
    exit 1
fi

# Test 2: Vérifier la structure de la migration
echo -e "${YELLOW}Test 2: Vérification de la migration Storage...${NC}"
MIGRATION_FILE="supabase/migrations/202502150000_property_photos_storage_policies.sql"
if [ -f "$MIGRATION_FILE" ]; then
    echo -e "${GREEN}✅ Migration trouvée: ${MIGRATION_FILE}${NC}"
    
    # Vérifier que la migration contient les policies nécessaires
    if grep -q "CREATE POLICY.*upload.*property photos" "$MIGRATION_FILE"; then
        echo -e "${GREEN}✅ Policy INSERT trouvée${NC}"
    else
        echo -e "${RED}❌ Policy INSERT manquante${NC}"
    fi
    
    if grep -q "CREATE POLICY.*view.*property photos" "$MIGRATION_FILE"; then
        echo -e "${GREEN}✅ Policy SELECT trouvée${NC}"
    else
        echo -e "${RED}❌ Policy SELECT manquante${NC}"
    fi
    
    if grep -q "CREATE POLICY.*update.*property photos" "$MIGRATION_FILE"; then
        echo -e "${GREEN}✅ Policy UPDATE trouvée${NC}"
    else
        echo -e "${RED}❌ Policy UPDATE manquante${NC}"
    fi
    
    if grep -q "CREATE POLICY.*delete.*property photos" "$MIGRATION_FILE"; then
        echo -e "${GREEN}✅ Policy DELETE trouvée${NC}"
    else
        echo -e "${RED}❌ Policy DELETE manquante${NC}"
    fi
else
    echo -e "${RED}❌ Migration non trouvée: ${MIGRATION_FILE}${NC}"
fi

echo ""

# Test 3: Vérifier les routes du wizard
echo -e "${YELLOW}Test 3: Vérification des routes du wizard...${NC}"

ROUTES=(
    "/app/owner/properties/new"
    "/app/owner/properties/new?mode=fast"
    "/app/owner/properties/new?mode=full"
    "/properties/new"
)

for route in "${ROUTES[@]}"; do
    FULL_URL="${NEXT_PUBLIC_APP_URL:-http://localhost:3000}${route}"
    if curl -s -f -o /dev/null -w "%{http_code}" "$FULL_URL" | grep -q "200\|301\|302"; then
        echo -e "${GREEN}✅ Route accessible: ${route}${NC}"
    else
        echo -e "${YELLOW}⚠️  Route non accessible (peut nécessiter auth): ${route}${NC}"
    fi
done

echo ""

# Test 4: Vérifier les fichiers modifiés
echo -e "${YELLOW}Test 4: Vérification des fichiers modifiés...${NC}"

FILES=(
    "features/properties/components/v3/property-wizard-v3.tsx"
    "app/app/owner/properties/new/page.tsx"
    "app/properties/new/page.tsx"
    "supabase/migrations/202502150000_property_photos_storage_policies.sql"
)

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✅ ${file}${NC}"
    else
        echo -e "${RED}❌ ${file} manquant${NC}"
    fi
done

echo ""

# Test 5: Vérifier les imports et syntaxe TypeScript
echo -e "${YELLOW}Test 5: Vérification de la syntaxe TypeScript...${NC}"

if command -v npx &> /dev/null; then
    if npx tsc --noEmit --skipLibCheck features/properties/components/v3/property-wizard-v3.tsx 2>&1 | grep -q "error"; then
        echo -e "${RED}❌ Erreurs TypeScript détectées${NC}"
        npx tsc --noEmit --skipLibCheck features/properties/components/v3/property-wizard-v3.tsx 2>&1 | head -10
    else
        echo -e "${GREEN}✅ Pas d'erreurs TypeScript${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  TypeScript non disponible, vérification ignorée${NC}"
fi

echo ""

# Résumé
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Tests terminés${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}📝 Prochaines étapes:${NC}"
echo "1. Appliquer la migration dans Supabase:"
echo "   supabase migration up"
echo ""
echo "2. Vérifier les policies Storage dans Supabase Dashboard"
echo ""
echo "3. Tester manuellement le wizard:"
echo "   - Mode FAST: /app/owner/properties/new?mode=fast"
echo "   - Mode FULL: /app/owner/properties/new?mode=full"
echo ""
echo "4. Tester l'upload de photos après connexion"

