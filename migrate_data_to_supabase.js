/**
 * ============================================================================
 * MIGRASI LENGKAP: GOOGLE SHEETS -> SUPABASE
 * PT. FATH INDAH WEB PORTAL
 * ============================================================================
 * Membaca seluruh data dari Google Spreadsheet ID:
 * 1VL8trcMIcZ6n5Be-2-9YwmC1pOsKliO_wbILmU_cC1s
 * dan menyalinnya ke Supabase:
 * https://utqexpkwtatwzknjftpx.supabase.co
 */

const https = require('https');
const fs = require('fs');

const CONFIG = {
  SPREADSHEET_ID: '1VL8trcMIcZ6n5Be-2-9YwmC1pOsKliO_wbILmU_cC1s',
  SUPABASE_URL: 'https://utqexpkwtatwzknjftpx.supabase.co',
  SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0cWV4cGt3dGF0d3prbmpmdHB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIxODQ5MTYsImV4cCI6MjEwNzc2MDkxNn0.s17as0ZuXm11AMJyYp01omnHkiqTRTGrKtYZfAI7kwE'
};

const mappings = JSON.parse(fs.readFileSync('scratch/migration_mappings.json', 'utf8'));

// CSV Parser
function parseCSV(text) {
  const rows = [];
  let currentRow = [];
  let currentField = '';
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentField += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') i++;
      currentRow.push(currentField.trim());
      if (currentRow.some(f => f.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some(f => f.length > 0)) {
      rows.push(currentRow);
    }
  }
  return rows;
}

// Fetch Google Sheet as CSV
function fetchSheet(sheetName) {
  return new Promise((resolve, reject) => {
    const url = `https://docs.google.com/spreadsheets/d/${CONFIG.SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 400) {
          return reject(new Error(`Gagal memuat sheet ${sheetName}: HTTP ${res.statusCode}`));
        }
        const rows = parseCSV(data);
        resolve(rows);
      });
    }).on('error', reject);
  });
}

// Request ke Supabase REST API
function supabaseRequest(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(CONFIG.SUPABASE_URL + path);
    const headers = {
      'apikey': CONFIG.SUPABASE_KEY,
      'Authorization': `Bearer ${CONFIG.SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    };

    if (method === 'POST') {
      headers['Prefer'] = 'return=representation';
    }

    const req = https.request(url, { method, headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, data });
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

// Insert batch ke Supabase
async function insertBatch(tableName, records, batchSize = 50) {
  let inserted = 0;
  for (let i = 0; i < records.length; i += batchSize) {
    const chunk = records.slice(i, i + batchSize);
    const res = await supabaseRequest(`/rest/v1/${tableName}`, 'POST', chunk);
    if (res.status === 201 || res.status === 200) {
      inserted += chunk.length;
    } else {
      console.warn(`    ⚠️  Batch ${i / batchSize + 1} status ${res.status}: ${res.data.slice(0, 150)}`);
      // Fallback: coba per row jika ada constraint violation
      for (const row of chunk) {
        const singleRes = await supabaseRequest(`/rest/v1/${tableName}`, 'POST', [row]);
        if (singleRes.status === 201 || singleRes.status === 200) {
          inserted++;
        }
      }
    }
  }
  return inserted;
}

// Hapus seluruh data di tabel Supabase
async function clearTable(tableName) {
  // PostgREST DELETE memerlukan filter, gunakan id neq nil-uuid
  const res = await supabaseRequest(`/rest/v1/${tableName}?id=neq.00000000-0000-0000-0000-000000000000`, 'DELETE');
  return res.status;
}

async function migrateAll() {
  console.log('================================================================');
  console.log('🚀 MEMULAI PROSES SINKRONISASI GOOGLE SHEETS -> SUPABASE');
  console.log('================================================================\n');

  // Urutkan sheet: users & absensi lebih dulu jika ada relasi
  const sheetNames = Object.keys(mappings);
  const summary = [];

  for (const sheetName of sheetNames) {
    const { tableName, colMapping } = mappings[sheetName];
    console.log(`\n📋 [Sheet: ${sheetName}] -> Tabel Supabase: "${tableName}"`);

    try {
      // 1. Ambil data dari Google Sheet
      const rows = await fetchSheet(sheetName);
      if (rows.length <= 1) {
        console.log(`   ℹ️  Sheet kosong (hanya header atau tanpa data).`);
        summary.push({ sheetName, tableName, sheetRows: 0, inserted: 0, status: 'KOSONG' });
        continue;
      }

      const header = rows[0];
      const dataRows = rows.slice(1);
      console.log(`   📥 Ditemukan ${dataRows.length} baris data dari Google Sheet.`);

      // 2. Clear data yang sudah ada di Supabase untuk tabel ini (sesuai instruksi user)
      const clearStatus = await clearTable(tableName);
      if (clearStatus === 200 || clearStatus === 204) {
        console.log(`   🗑️  Tabel "${tableName}" di Supabase berhasil dikosongkan (status: ${clearStatus}).`);
      } else {
        console.log(`   ⚠️  Catatan: Tabel "${tableName}" belum tersedia di Supabase atau butuh schema update (status: ${clearStatus}).`);
      }

      // 3. Transform data sesuai kolom Supabase
      const payload = [];

      for (const row of dataRows) {
        const record = {};
        
        if (tableName === 'users') {
          // Mapping khusus untuk tabel users agar support sistem auth & biometric
          const rawId = row[header.indexOf('ID')] || '';
          const rawUser = row[header.indexOf('Username')] || '';
          const rawPass = row[header.indexOf('Password')] || '';
          const rawName = row[header.indexOf('FullName')] || '';
          const rawRole = row[header.indexOf('Role')] || 'Karyawan';
          const rawKanwil = row[header.indexOf('Kanwil')] || '';
          const rawKantor = row[header.indexOf('Kantor')] || '';
          const rawStatus = row[header.indexOf('Status')] || 'Active';
          const rawCreated = row[header.indexOf('CreatedAt')] || new Date().toISOString();

          if (!rawUser) continue;

          record.user_id = rawUser;
          record.username = rawUser;
          record.password = rawPass;
          record.nama = rawName;
          record.full_name = rawName;
          record.role = rawRole;
          record.jabatan = rawRole;
          record.kanwil = rawKanwil;
          record.kantor = rawKantor;
          record.status = rawStatus;
          record.created_at = rawCreated;
        } else {
          let hasContent = false;
          header.forEach((colName, idx) => {
            const targetCol = colMapping[colName];
            if (targetCol) {
              const val = row[idx];
              if (val !== undefined && val !== null && String(val).trim() !== '') {
                record[targetCol] = String(val).trim();
                hasContent = true;
              }
            }
          });
          if (!hasContent) continue;
        }

        payload.push(record);
      }

      // 4. Insert ke Supabase
      console.log(`   📤 Mengunggah ${payload.length} data ke Supabase...`);
      const insertedCount = await insertBatch(tableName, payload);
      console.log(`   ✅ Selesai: Berhasil menyalin ${insertedCount}/${payload.length} baris ke tabel "${tableName}".`);

      summary.push({
        sheetName,
        tableName,
        sheetRows: payload.length,
        inserted: insertedCount,
        status: insertedCount === payload.length ? 'SEMPURNA (100%)' : (insertedCount > 0 ? 'SEBAGIAN' : 'MENUNGGU TABEL')
      });

    } catch (err) {
      console.error(`   ❌ Error pada sheet ${sheetName}:`, err.message);
      summary.push({ sheetName, tableName, sheetRows: 0, inserted: 0, status: 'GAGAL: ' + err.message });
    }
  }

  console.log('\n================================================================');
  console.log('📊 RINGKASAN HASIL MIGRASI KE SUPABASE:');
  console.log('================================================================');
  console.table(summary);
}

migrateAll();
