import psycopg, psycopg.rows, time

conn = psycopg.connect(
    host='ep-dark-math-amjfrucb-pooler.c-5.us-east-1.aws.neon.tech',
    port=5432, dbname='lms_leo', user='neondb_owner',
    password='npg_8QolsfgR5Kqn', sslmode='require',
    row_factory=psycopg.rows.dict_row
)
print("Watching upload_summary... (Ctrl+C to stop)\n")
seen = set()
while True:
    with conn.cursor() as cur:
        cur.execute("SELECT id, created_at, hles FROM upload_summary ORDER BY created_at DESC LIMIT 5")
        for row in cur.fetchall():
            uid = str(row['id'])
            hles = row['hles'] or {}
            status = hles.get('ingestion_status', 'success')
            key = uid + status
            if key not in seen:
                seen.add(key)
                print(f"[{row['created_at']}] id={uid[:8]}... status={status} newLeads={hles.get('newLeads')} updated={hles.get('updated')} error={hles.get('ingestion_error')}")
    time.sleep(2)
