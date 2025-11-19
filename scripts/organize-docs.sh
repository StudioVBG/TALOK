#!/bin/bash
# Script pour organiser la documentation du projet

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "📁 Organisation de la documentation..."

# Créer les dossiers d'archive
mkdir -p docs/archive/{deployment,reports,sessions,refactoring,optimizations,status,fixes,guides}

# ============================================
# DÉPLACER LES FICHIERS PAR CATÉGORIE
# ============================================

# Deployment
echo "📦 Archivage des fichiers de déploiement..."
mv DEPLOYMENT_FIX.md docs/archive/deployment/ 2>/dev/null || true
mv DEPLOY_OPTIMISATIONS.md docs/archive/optimizations/ 2>/dev/null || true
mv DEPLOYMENT_STATUS_FINAL.md docs/archive/status/ 2>/dev/null || true
mv DEPLOYMENT_STATUS.md docs/archive/status/ 2>/dev/null || true
mv DEPLOYMENT_SUCCESS.md docs/archive/status/ 2>/dev/null || true
mv DEPLOYMENT_COMPLETE.md docs/archive/status/ 2>/dev/null || true
mv DEPLOYMENT.md docs/archive/deployment/ 2>/dev/null || true
# Garder DEPLOYMENT_GUIDE.md et DEPLOYMENT_CHECKLIST.md à la racine (utiles)

# Rapports
echo "📊 Archivage des rapports..."
mv RAPPORT_*.md docs/archive/reports/ 2>/dev/null || true

# Sessions et résumés
echo "📝 Archivage des résumés de sessions..."
mv RESUME_*.md docs/archive/sessions/ 2>/dev/null || true
mv SESSION_RESUME.md docs/archive/sessions/ 2>/dev/null || true

# Refactoring
echo "🔧 Archivage des fichiers de refactoring..."
mv REFACTOR_*.md docs/archive/refactoring/ 2>/dev/null || true

# Optimizations
echo "⚡ Archivage des fichiers d'optimisation..."
mv OPTIMISATIONS_*.md docs/archive/optimizations/ 2>/dev/null || true
mv PERFORMANCE_FIXES.md docs/archive/optimizations/ 2>/dev/null || true

# Status
echo "📈 Archivage des fichiers de statut..."
mv STATUS_*.md docs/archive/status/ 2>/dev/null || true
mv ONBOARDING_STATUS.md docs/archive/status/ 2>/dev/null || true
mv ONBOARDING_COMPLETE.md docs/archive/status/ 2>/dev/null || true
mv IMPLEMENTATION_COMPLETE*.md docs/archive/status/ 2>/dev/null || true
mv FINAL_IMPLEMENTATION_STATUS.md docs/archive/status/ 2>/dev/null || true

# Fixes
echo "🐛 Archivage des fichiers de corrections..."
mv FIX_*.md docs/archive/fixes/ 2>/dev/null || true
mv FIXES_APPLIQUES.md docs/archive/fixes/ 2>/dev/null || true
mv BUGFIX_*.md docs/archive/fixes/ 2>/dev/null || true
mv NAVBAR_DUPLICATE_FIX.md docs/archive/fixes/ 2>/dev/null || true
mv ROUTE_FIX_SUMMARY.md docs/archive/fixes/ 2>/dev/null || true
mv VERCEL_DEPLOY_FIX.md docs/archive/fixes/ 2>/dev/null || true
mv URGENT_*.md docs/archive/fixes/ 2>/dev/null || true

# Cleanup
echo "🧹 Archivage des fichiers de nettoyage..."
mv CLEANUP_*.md docs/archive/refactoring/ 2>/dev/null || true
mv HOMOGENIZATION_COMPLETE.md docs/archive/refactoring/ 2>/dev/null || true

# Guides temporaires
echo "📚 Archivage des guides temporaires..."
mv GUIDE_TEST_*.md docs/archive/guides/ 2>/dev/null || true
mv GUIDE_APPLICATION_MIGRATION.md docs/archive/guides/ 2>/dev/null || true
mv QUICK_START_*.md docs/archive/guides/ 2>/dev/null || true
mv QUICK_DEPLOY.md docs/archive/guides/ 2>/dev/null || true
mv QUICK_START.md docs/archive/guides/ 2>/dev/null || true

# Analyses
echo "🔍 Archivage des analyses..."
mv DEAD_CODE_ANALYSIS.md docs/archive/reports/ 2>/dev/null || true
mv FK_RELATIONS_ANALYSIS.md docs/archive/reports/ 2>/dev/null || true
mv NAMING_CONVENTIONS_ANALYSIS.md docs/archive/reports/ 2>/dev/null || true
mv INVENTAIRE_DOUBLONS.md docs/archive/reports/ 2>/dev/null || true
mv INDEX_RAPPORTS_ANALYSE.md docs/archive/reports/ 2>/dev/null || true
mv DIAGNOSTIC_CREATION_LOGEMENT.md docs/archive/reports/ 2>/dev/null || true

# Intégrations
echo "🔌 Archivage des fichiers d'intégration..."
mv INTEGRATION_*.md docs/archive/guides/ 2>/dev/null || true
mv MCP_*.md docs/archive/guides/ 2>/dev/null || true
mv SUPABASE_MCP_SETUP.md docs/archive/guides/ 2>/dev/null || true
mv SUPABASE_RAPPORT.md docs/archive/reports/ 2>/dev/null || true

# Plans
echo "📋 Archivage des plans..."
mv PLAN_*.md docs/archive/guides/ 2>/dev/null || true

# Autres fichiers temporaires
mv COMMIT_MESSAGE.md docs/archive/ 2>/dev/null || true
mv VERIFICATION_CONNECTIVITE.md docs/archive/reports/ 2>/dev/null || true
mv TROUBLESHOOTING_*.md docs/archive/guides/ 2>/dev/null || true
mv CONFIGURATION_REDIRECTIONS_EMAIL.md docs/archive/guides/ 2>/dev/null || true
mv ENV_SYNC_GUIDE.md docs/archive/guides/ 2>/dev/null || true
mv VERCEL_ENV_SETUP.md docs/archive/guides/ 2>/dev/null || true
mv VERCEL_DEPLOY.md docs/archive/deployment/ 2>/dev/null || true
mv GITHUB_DEPLOYMENT.md docs/archive/deployment/ 2>/dev/null || true
mv INSTALL_NODE.md docs/archive/guides/ 2>/dev/null || true
mv INSTALLATION.md docs/archive/guides/ 2>/dev/null || true
mv LANCER_APP.md docs/archive/guides/ 2>/dev/null || true
mv START_HERE.md docs/archive/guides/ 2>/dev/null || true
mv README_START.md docs/archive/guides/ 2>/dev/null || true
mv README_V3.md docs/archive/guides/ 2>/dev/null || true
mv TEST_INSCRIPTION.md docs/archive/guides/ 2>/dev/null || true

# Créer un fichier README dans docs/archive pour expliquer la structure
cat > docs/archive/README.md << 'EOF'
# 📁 Archive de Documentation

Ce dossier contient les fichiers de documentation temporaires ou historiques du projet.

## Structure

- `deployment/` - Fichiers liés au déploiement (statuts, fixes, guides)
- `reports/` - Rapports d'analyse et diagnostics
- `sessions/` - Résumés de sessions de développement
- `refactoring/` - Documentation de refactoring
- `optimizations/` - Documentation d'optimisations
- `status/` - Fichiers de statut d'implémentation
- `fixes/` - Documentation de corrections de bugs
- `guides/` - Guides temporaires et migrations

## Note

Ces fichiers sont conservés pour référence historique mais ne sont plus maintenus activement.
EOF

echo "✅ Documentation organisée avec succès !"
echo ""
echo "📁 Structure créée :"
echo "  - docs/archive/deployment/"
echo "  - docs/archive/reports/"
echo "  - docs/archive/sessions/"
echo "  - docs/archive/refactoring/"
echo "  - docs/archive/optimizations/"
echo "  - docs/archive/status/"
echo "  - docs/archive/fixes/"
echo "  - docs/archive/guides/"

