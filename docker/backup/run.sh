#!/bin/sh
# Daily MySQL backup. Dijalankan dari container alpine/mysql.
# Cron-style loop: tunggu sampai 02:00 server time, dump, lalu sleep 24 jam.
#
# Volume mount: /backups (mount ke ./backups host)
# Retention: $RETENTION_DAYS hari (default 14)

set -e

BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
DB_HOST="${MYSQL_HOST:-mysql}"
DB_USER="${MYSQL_USER:-root}"
DB_PASS="${MYSQL_PASSWORD}"
DB_NAME="${MYSQL_DATABASE:-dk_koi}"

mkdir -p "$BACKUP_DIR"

run_backup() {
    TS=$(date +%Y%m%d_%H%M%S)
    FILE="$BACKUP_DIR/${DB_NAME}_${TS}.sql.gz"
    echo "[$(date)] Backup ke $FILE"

    mysqldump \
        -h "$DB_HOST" \
        -u "$DB_USER" \
        -p"$DB_PASS" \
        --single-transaction \
        --routines \
        --triggers \
        --quick \
        --lock-tables=false \
        "$DB_NAME" | gzip > "$FILE"

    if [ -s "$FILE" ]; then
        echo "[$(date)] OK ($(du -h "$FILE" | cut -f1))"
    else
        echo "[$(date)] FAIL — file kosong"
        rm -f "$FILE"
        return 1
    fi

    # Cleanup file lama
    find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -type f -mtime +$RETENTION_DAYS -delete
    echo "[$(date)] Cleanup file >${RETENTION_DAYS} hari selesai"
}

# Backup awal saat container start (untuk verifikasi setup)
echo "[$(date)] Backup awal (container start)..."
run_backup || echo "[$(date)] Backup awal gagal — lanjut loop harian"

# Loop harian
while true; do
    NOW=$(date +%H:%M)
    TARGET_HOUR=02
    TARGET_MIN=00

    # Hitung detik sampai target jam berikutnya
    if [ "$(date +%H)" -lt $TARGET_HOUR ] || \
       { [ "$(date +%H)" -eq $TARGET_HOUR ] && [ "$(date +%M)" -lt $TARGET_MIN ]; }; then
        TARGET=$(date -d "today $TARGET_HOUR:$TARGET_MIN" +%s 2>/dev/null || date +%s)
    else
        TARGET=$(date -d "tomorrow $TARGET_HOUR:$TARGET_MIN" +%s 2>/dev/null || \
                 echo $(($(date +%s) + 86400)))
    fi
    NOW_S=$(date +%s)
    SLEEP_S=$((TARGET - NOW_S))
    [ $SLEEP_S -lt 60 ] && SLEEP_S=86400

    echo "[$(date)] Tidur $SLEEP_S detik (sampai $TARGET_HOUR:$TARGET_MIN)..."
    sleep $SLEEP_S

    run_backup || echo "[$(date)] Backup gagal — lanjut besok"
done
