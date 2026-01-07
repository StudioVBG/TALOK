#!/bin/bash

# ==============================================
# Script de backup automatique Supabase
# ==============================================
#
# Usage:
#   ./scripts/backup-database.sh
#   ./scripts/backup-database.sh --upload-s3
#
# Configuration requise:
#   - SUPABASE_DB_URL dans .env
#   - pg_dump installé
#   - (optionnel) AWS CLI configuré pour upload S3
#
# Recommandation: Planifier via cron
#   0 3 * * * /path/to/backup-database.sh --upload-s3 >> /var/log/db-backup.log 2>&1

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${PROJECT_DIR}/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="gestion_locative_backup_${DATE}.sql"
COMPRESSED_FILE="${BACKUP_FILE}.gz"
RETENTION_DAYS=30

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# Charger les variables d'environnement
if [ -f "${PROJECT_DIR}/.env.local" ]; then
    source "${PROJECT_DIR}/.env.local"
elif [ -f "${PROJECT_DIR}/.env" ]; then
    source "${PROJECT_DIR}/.env"
fi

# Vérifier les prérequis
check_prerequisites() {
    log_info "Vérification des prérequis..."
    
    if ! command -v pg_dump &> /dev/null; then
        log_error "pg_dump n'est pas installé. Installez PostgreSQL client."
        exit 1
    fi
    
    if [ -z "$SUPABASE_DB_URL" ]; then
        # Essayer de construire l'URL à partir des variables Supabase
        if [ -n "$SUPABASE_PROJECT_REF" ] && [ -n "$SUPABASE_DB_PASSWORD" ]; then
            SUPABASE_DB_URL="postgresql://postgres.${SUPABASE_PROJECT_REF}:${SUPABASE_DB_PASSWORD}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres"
        else
            log_error "SUPABASE_DB_URL non configuré."
            log_error "Ajoutez SUPABASE_DB_URL dans .env.local ou configurez SUPABASE_PROJECT_REF et SUPABASE_DB_PASSWORD"
            exit 1
        fi
    fi
    
    log_info "Prérequis OK"
}

# Créer le répertoire de backup
create_backup_dir() {
    if [ ! -d "$BACKUP_DIR" ]; then
        mkdir -p "$BACKUP_DIR"
        log_info "Répertoire de backup créé: $BACKUP_DIR"
    fi
}

# Effectuer le backup
perform_backup() {
    log_info "Démarrage du backup..."
    
    cd "$BACKUP_DIR"
    
    # Options pg_dump
    # --no-owner: Ne pas inclure les instructions de propriété
    # --no-acl: Ne pas inclure les permissions
    # --clean: Ajouter DROP avant CREATE
    # --if-exists: Ajouter IF EXISTS aux DROP
    
    PGPASSWORD=$(echo $SUPABASE_DB_URL | sed -n 's/.*:\([^@]*\)@.*/\1/p')
    DB_HOST=$(echo $SUPABASE_DB_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
    DB_PORT=$(echo $SUPABASE_DB_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    DB_NAME=$(echo $SUPABASE_DB_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')
    DB_USER=$(echo $SUPABASE_DB_URL | sed -n 's/.*\/\/\([^:]*\):.*/\1/p')
    
    export PGPASSWORD
    
    pg_dump \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        --no-owner \
        --no-acl \
        --clean \
        --if-exists \
        -f "$BACKUP_FILE" \
        2>&1 | while read line; do
            log_info "$line"
        done
    
    if [ $? -eq 0 ]; then
        log_info "Backup créé: $BACKUP_FILE"
    else
        log_error "Erreur lors du backup"
        exit 1
    fi
    
    # Compression
    log_info "Compression du backup..."
    gzip "$BACKUP_FILE"
    
    BACKUP_SIZE=$(du -h "${COMPRESSED_FILE}" | cut -f1)
    log_info "Backup compressé: ${COMPRESSED_FILE} (${BACKUP_SIZE})"
}

# Upload vers S3 (optionnel)
upload_to_s3() {
    if [ "$1" != "--upload-s3" ]; then
        return
    fi
    
    if [ -z "$AWS_S3_BUCKET" ]; then
        log_warn "AWS_S3_BUCKET non configuré, skip upload S3"
        return
    fi
    
    if ! command -v aws &> /dev/null; then
        log_warn "AWS CLI non installé, skip upload S3"
        return
    fi
    
    log_info "Upload vers S3: s3://${AWS_S3_BUCKET}/backups/${COMPRESSED_FILE}"
    
    aws s3 cp "${BACKUP_DIR}/${COMPRESSED_FILE}" "s3://${AWS_S3_BUCKET}/backups/${COMPRESSED_FILE}"
    
    if [ $? -eq 0 ]; then
        log_info "Upload S3 réussi"
    else
        log_error "Erreur upload S3"
    fi
}

# Nettoyer les anciens backups
cleanup_old_backups() {
    log_info "Nettoyage des backups > ${RETENTION_DAYS} jours..."
    
    find "$BACKUP_DIR" -name "*.sql.gz" -type f -mtime +${RETENTION_DAYS} -delete
    
    REMAINING=$(ls -1 "$BACKUP_DIR"/*.sql.gz 2>/dev/null | wc -l)
    log_info "Backups restants: $REMAINING"
}

# Vérifier l'intégrité du backup
verify_backup() {
    log_info "Vérification de l'intégrité du backup..."
    
    # Vérifier que le fichier n'est pas vide
    if [ ! -s "${BACKUP_DIR}/${COMPRESSED_FILE}" ]; then
        log_error "Le fichier backup est vide!"
        exit 1
    fi
    
    # Vérifier que c'est un fichier gzip valide
    if ! gzip -t "${BACKUP_DIR}/${COMPRESSED_FILE}" 2>/dev/null; then
        log_error "Le fichier gzip est corrompu!"
        exit 1
    fi
    
    # Vérifier que le SQL contient des données attendues
    TABLES_COUNT=$(zcat "${BACKUP_DIR}/${COMPRESSED_FILE}" | grep -c "CREATE TABLE" || true)
    if [ "$TABLES_COUNT" -lt 10 ]; then
        log_warn "Seulement ${TABLES_COUNT} tables trouvées dans le backup"
    else
        log_info "Backup vérifié: ${TABLES_COUNT} tables"
    fi
}

# Envoyer une notification (optionnel)
send_notification() {
    if [ -z "$SLACK_WEBHOOK_URL" ]; then
        return
    fi
    
    BACKUP_SIZE=$(du -h "${BACKUP_DIR}/${COMPRESSED_FILE}" | cut -f1)
    
    curl -s -X POST -H 'Content-type: application/json' \
        --data "{\"text\":\"✅ Backup BDD réussi: ${COMPRESSED_FILE} (${BACKUP_SIZE})\"}" \
        "$SLACK_WEBHOOK_URL" > /dev/null
}

# Main
main() {
    log_info "=========================================="
    log_info "Backup Talok - ${DATE}"
    log_info "=========================================="
    
    check_prerequisites
    create_backup_dir
    perform_backup
    verify_backup
    upload_to_s3 "$1"
    cleanup_old_backups
    send_notification
    
    log_info "=========================================="
    log_info "Backup terminé avec succès!"
    log_info "Fichier: ${BACKUP_DIR}/${COMPRESSED_FILE}"
    log_info "=========================================="
}

main "$@"

