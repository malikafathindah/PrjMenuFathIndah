/**
 * ============================================================================
 * EMPLOYEE BIO MANAGER (EmployeeBioManager.gs)
 * ============================================================================
 * Modul khusus mengelola Sheet "Bio Karyawan" (mod_bio_karyawan)
 * - Pembacaan header dinamis & pengelompokan materi form
 * - Timestamp otomatis dari sistem (diabaikan pada form input)
 * - Pencarian alamat otomatis berdasarkan Kodepos (Provinsi, Kota, Kec, Kel)
 */

/**
 * Helper alias untuk mendapatkan database spreadsheet
 */
function getSpreadsheet() {
  return getDb();
}

/**
 * Mengambil atau membuat Sheet "Bio Karyawan"
 */
function getBioKaryawanSheet() {
  let sheet = findSheetByNameFlexible('Bio Karyawan');
  
  if (!sheet) {
    sheet = getDb().insertSheet('Bio Karyawan');
  }
  
  seedDefaultBioKaryawanSheetIfEmpty(sheet);
  return sheet;
}

/**
 * Mengambil seluruh data karyawan dari Sheet "Bio Karyawan" secara valid & terhubung langsung
 */
function getLiveBioKaryawanData() {
  const sources = [];

  // 1. Ambil dari getDb()
  try {
    const db = getDb();
    if (db) sources.push(db);
  } catch (e) {}

  // 2. Ambil dari Active Spreadsheet
  try {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active && !sources.some(s => s.getId() === active.getId())) {
      sources.push(active);
    }
  } catch (e) {}

  // 3. Ambil dari CONFIG.SPREADSHEET_ID
  try {
    if (CONFIG.SPREADSHEET_ID && CONFIG.SPREADSHEET_ID !== 'YOUR_SPREADSHEET_ID_HERE') {
      const openBy = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
      if (openBy && !sources.some(s => s.getId() === openBy.getId())) {
        sources.push(openBy);
      }
    }
  } catch (e) {}

  for (let s = 0; s < sources.length; s++) {
    const ss = sources[s];
    const sheet = findSheetByNameFlexibleInSs(ss, 'Bio Karyawan');
    if (!sheet) continue;

    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    if (lastRow <= 1 || lastCol === 0) continue;

    const data = sheet.getRange(1, 1, lastRow, lastCol).getValues();
    if (!data || data.length <= 1) continue;

    // Cari baris header (baris yang memiliki nama kolom valid di 5 baris teratas)
    let headerRowIndex = 0;
    for (let i = 0; i < Math.min(5, data.length); i++) {
      const rowCells = data[i].map(c => String(c || '').trim().toLowerCase());
      const hasKeywords = rowCells.some(c => 
        c.includes('nama') || c.includes('kelamin') || c.includes('status') || 
        c.includes('lahir') || c.includes('nik') || c.includes('pendidikan') || 
        c.includes('jabatan') || c.includes('alamat') || c.includes('hp')
      );
      const nonCount = rowCells.filter(c => c !== '').length;
      if (hasKeywords && nonCount >= 2) {
        headerRowIndex = i;
        break;
      }
    }

    const headers = data[headerRowIndex].map(h => String(h || '').trim());
    const dataRows = data.slice(headerRowIndex + 1);

    const result = dataRows
      .filter(row => row && row.some(cell => cell !== '' && cell !== null && cell !== undefined && String(cell).trim() !== ''))
      .map((row, rowIndex) => {
        const obj = { _rowIndex: headerRowIndex + 2 + rowIndex };
        headers.forEach((header, colIndex) => {
          if (header) {
            const val = row[colIndex];
            obj[header] = (val instanceof Date) ? val.toISOString().substring(0, 10) : val;
          }
        });
        return obj;
      });

    if (result.length > 0) {
      return result;
    }
  }

  return [];
}

/**
 * Helper pencarian sheet fleksibel pada instance Spreadsheet spesifik
 */
function findSheetByNameFlexibleInSs(ss, sheetName) {
  if (!ss) return null;
  let sheets = [];
  try {
    sheets = ss.getSheets();
  } catch (e) {
    return null;
  }
  if (!sheets || sheets.length === 0) return null;

  // 1. Exact match
  let sheet = ss.getSheetByName(sheetName);
  if (sheet) return sheet;

  // 2. Trim & case-insensitive match
  const targetTrim = String(sheetName).trim().toLowerCase();
  for (let i = 0; i < sheets.length; i++) {
    if (sheets[i].getName().trim().toLowerCase() === targetTrim) return sheets[i];
  }

  // 3. Clean alphanumeric match
  const targetClean = targetTrim.replace(/[^a-z0-9]/g, '');
  for (let i = 0; i < sheets.length; i++) {
    const nameClean = sheets[i].getName().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (nameClean === targetClean) return sheets[i];
  }

  // 4. Keyword match (bio, karyawan, biodata, sdm, pegawai, employee, data)
  for (let i = 0; i < sheets.length; i++) {
    const n = sheets[i].getName().toLowerCase();
    if (n.includes('bio') || n.includes('karyawan') || n.includes('biodata') || n.includes('sdm') || n.includes('pegawai') || n.includes('employee')) {
      return sheets[i];
    }
  }

  // 5. Scan sheet content for keywords if row count > 1
  for (let i = 0; i < sheets.length; i++) {
    const s = sheets[i];
    if (s.getLastRow() > 1) {
      const sampleText = s.getRange(1, 1, Math.min(5, s.getLastRow()), Math.min(20, s.getLastColumn())).getValues().flat().join(' ').toLowerCase();
      if (sampleText.includes('nama') || sampleText.includes('kelamin') || sampleText.includes('status') || sampleText.includes('nik')) {
        return s;
      }
    }
  }

  // 6. Default to first sheet with rows
  for (let i = 0; i < sheets.length; i++) {
    if (sheets[i].getLastRow() > 1) return sheets[i];
  }

  return sheets[0];
}

/**
 * Mengisi header default jika Sheet "Bio Karyawan" masih kosong
 */
function seedDefaultBioKaryawanSheetIfEmpty(sheet) {
  if (sheet.getLastRow() === 0) {
    const defaultHeaders = [
      'Timestamp',
      'Nama Karyawan',
      'Status Karyawan',
      'Jenis Kelamin',
      'Tempat Lahir',
      'Tanggal Lahir',
      'Golongan Darah',
      'Nomor Telephone/HP',
      'Email',
      'Alamat Rumah Lengkap',
      'Kode Pos',
      'Kelurahan/Desa',
      'Kecamatan',
      'Kabupaten/Kota',
      'Provinsi',
      'Pendidikan Terakhir',
      'Jurusan Pendidikan Terakhir',
      'Nama Lembaga Pendidikan',
      'Nama Ibu Kandung',
      'Nama Suami/Istri',
      'Tanggal Lahir Suami/Istri',
      'Nama Anak Kandung 1',
      'Tanggal Lahir Anak Kandung 1',
      'Nama Anak Kandung 2',
      'Tanggal Lahir Anak Kandung 2',
      'Nama Anak Kandung 3',
      'Tanggal Lahir Anak Kandung 3',
      'Nama Anak Kandung 4',
      'Tanggal Lahir Anak Kandung 4',
      'Nomor Kartu Keluarga (KK)',
      'Nomor Kartu Tanda Penduduk (KTP)',
      'NPWP',
      'Nomor BP Ketenagakerjaan',
      'Nomor BPJS Kesehatan',
      'Penanggung BPJS Kesehatan',
      'Nama Di Bank',
      'Nama Bank',
      'No Rekening'
    ];
    
    sheet.appendRow(defaultHeaders);
    
    // Format Header Baris 1
    const headerRange = sheet.getRange(1, 1, 1, defaultHeaders.length);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#0f172a');
    headerRange.setFontColor('#38bdf8');
  }
}

/**
 * Membaca header sheet "Bio Karyawan" dan menyusun skema pengelompokan materi
 */
function getBioKaryawanHeadersData() {
  try {
    const sheet = getBioKaryawanSheet();
    const data = sheet.getDataRange().getValues();
    
    if (!data || data.length === 0) {
      return { success: false, message: 'Header Sheet Bio Karyawan tidak ditemukan.' };
    }
    
    const rawHeaders = data[0].map(h => String(h || '').trim());
    
    // Saring header: Timestamp diambil otomatis dari sistem (TIDAK dimunculkan di form)
    const entryHeaders = rawHeaders.filter(h => !/timestamp/i.test(h));
    
    return {
      success: true,
      rawHeaders: rawHeaders,
      entryHeaders: entryHeaders
    };
  } catch (err) {
    return { success: false, message: 'Gagal membaca header Bio Karyawan: ' + err.toString() };
  }
}

/**
 * Utilitas Pencarian Alamat Berdasarkan Kodepos
 * (Mengisi Provinsi, Kabupaten/Kota, Kecamatan, Kelurahan)
 */
function lookupKodeposData(kodepos) {
  try {
    const cleanKodepos = String(kodepos || '').trim();
    if (!cleanKodepos || cleanKodepos.length < 5) {
      return { success: false, message: 'Masukkan 5 digit angka Kodepos.' };
    }

    // 1. Kamus Internal Kodepos Utama Indonesia (Fallback Cepat & Andal)
    const internalDatabase = {
      '10110': { kelurahan: 'Petojo Selatan', kecamatan: 'Gambir', kota: 'Kota Jakarta Pusat', provinsi: 'DKI Jakarta' },
      '10120': { kelurahan: 'Gambir', kecamatan: 'Gambir', kota: 'Kota Jakarta Pusat', provinsi: 'DKI Jakarta' },
      '12110': { kelurahan: 'Gunung', kecamatan: 'Kebayoran Baru', kota: 'Kota Jakarta Selatan', provinsi: 'DKI Jakarta' },
      '15111': { kelurahan: 'Tangerang', kecamatan: 'Tangerang', kota: 'Kota Tangerang', provinsi: 'Banten' },
      '16111': { kelurahan: 'Gudang', kecamatan: 'Bogor Tengah', kota: 'Kota Bogor', provinsi: 'Jawa Barat' },
      '16411': { kelurahan: 'Depok', kecamatan: 'Pancasari', kota: 'Kota Depok', provinsi: 'Jawa Barat' },
      '17111': { kelurahan: 'Bekasi Jaya', kecamatan: 'Bekasi Timur', kota: 'Kota Bekasi', provinsi: 'Jawa Barat' },
      '40111': { kelurahan: 'Braga', kecamatan: 'Sumur Bandung', kota: 'Kota Bandung', provinsi: 'Jawa Barat' },
      '40132': { kelurahan: 'Lebak Siliwangi', kecamatan: 'Coblong', kota: 'Kota Bandung', provinsi: 'Jawa Barat' },
      '50111': { kelurahan: 'Kauman', kecamatan: 'Semarang Tengah', kota: 'Kota Semarang', provinsi: 'Jawa Tengah' },
      '55111': { kelurahan: 'Ngupasan', kecamatan: 'Gondomanan', kota: 'Kota Yogyakarta', provinsi: 'DI Yogyakarta' },
      '60111': { kelurahan: 'Surabaya', kecamatan: 'Tegalsari', kota: 'Kota Surabaya', provinsi: 'Jawa Timur' },
      '20111': { kelurahan: 'Kesawan', kecamatan: 'Medan Barat', kota: 'Kota Medan', provinsi: 'Sumatera Utara' },
      '90111': { kelurahan: 'Pattunuang', kecamatan: 'Wajo', kota: 'Kota Makassar', provinsi: 'Sulawesi Selatan' },
      '80111': { kelurahan: 'Dangin Puri', kecamatan: 'Denpasar Timur', kota: 'Kota Denpasar', provinsi: 'Bali' }
    };

    if (internalDatabase[cleanKodepos]) {
      return {
        success: true,
        source: 'internal',
        data: internalDatabase[cleanKodepos]
      };
    }

    // 2. Pencarian External Public API Kodepos Indonesia
    try {
      const url = `https://kodepos-266e6.firebaseapp.com/search?q=${cleanKodepos}`;
      const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
      if (response.getResponseCode() === 200) {
        const json = JSON.parse(response.getContentText());
        if (json && json.data && json.data.length > 0) {
          const item = json.data[0];
          return {
            success: true,
            source: 'api',
            data: {
              kelurahan: item.urban || item.kelurahan || '',
              kecamatan: item.subdistrict || item.kecamatan || '',
              kota: item.city || item.kabupaten || item.kota || '',
              provinsi: item.province || item.provinsi || ''
            }
          };
        }
      }
    } catch (e) {
      Logger.log('External Kodepos API error: ' + e.toString());
    }

    return {
      success: false,
      message: `Data lokasi untuk Kodepos ${cleanKodepos} tidak ditemukan. Silakan isi manual.`
    };
  } catch (err) {
    return { success: false, message: 'Gagal pencarian Kodepos: ' + err.toString() };
  }
}

/**
 * Menyimpan data Karyawan baru ke Sheet "Bio Karyawan"
 * - Timestamp diisi otomatis oleh sistem
 */
function saveBioKaryawanRecordData(formData) {
  try {
    if (!formData || typeof formData !== 'object') {
      return { success: false, message: 'Data form tidak valid.' };
    }

    const sheet = getBioKaryawanSheet();
    const data = sheet.getDataRange().getValues();
    if (!data || data.length === 0) {
      return { success: false, message: 'Sheet Bio Karyawan belum memiliki header.' };
    }

    const rawHeaders = data[0].map(h => String(h || '').trim());
    
    // Timestamp diisi otomatis oleh sistem
    const now = new Date();
    const timestampFormatted = formatBioDateISO(now) + ' ' + formatBioTimeHHMMSS(now);

    // Petakan data form ke urutan header sheet
    const newRow = rawHeaders.map(header => {
      if (/timestamp/i.test(header)) {
        return timestampFormatted;
      }
      return formData[header] !== undefined && formData[header] !== null ? String(formData[header]).trim() : '';
    });

    sheet.appendRow(newRow);

    // Invalidate cache setelah data baru ditambahkan
    try {
      const cache = CacheService.getScriptCache();
      cache.remove('BIO_KARYAWAN_LIST_CACHE_V4');
      cache.remove('BIO_KARYAWAN_LIST_CACHE_V3');
      cache.remove('BIO_KARYAWAN_LIST_CACHE_V2');
    } catch (e) {}

    return {
      success: true,
      message: 'Data Bio Karyawan berhasil disimpan dengan Timestamp otomatis!',
      timestamp: timestampFormatted
    };
  } catch (err) {
    return { success: false, message: 'Gagal menyimpan Bio Karyawan: ' + err.toString() };
  }
}

/**
 * Helper format tanggal WIB mandiri
 */
function formatBioDateISO(d) {
  try {
    return Utilities.formatDate(d || new Date(), 'Asia/Jakarta', 'yyyy-MM-dd');
  } catch (e) {
    const now = d || new Date();
    return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  }
}

/**
 * Helper format jam WIB mandiri
 */
function formatBioTimeHHMMSS(d) {
  try {
    return Utilities.formatDate(d || new Date(), 'Asia/Jakarta', 'HH:mm:ss');
  } catch (e) {
    const now = d || new Date();
    return String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0') + ':' + String(now.getSeconds()).padStart(2, '0');
  }
}

/**
 * Membaca seluruh data Bio Karyawan yang sudah terdaftar dengan RAM Caching Super Cepat
 */
function getBioKaryawanList(forceRefresh) {
  try {
    const cache = CacheService.getScriptCache();
    if (!forceRefresh) {
      const cached = cache.get('BIO_KARYAWAN_LIST_CACHE_V4');
      if (cached) {
        try {
          return { success: true, data: JSON.parse(cached), source: 'cache' };
        } catch (e) {}
      }
    }

    const sheet = getBioKaryawanSheet();
    const data = sheet.getDataRange().getValues();
    if (!data || data.length < 2) {
      return { success: true, data: [] };
    }

    const headers = data[0].map(h => String(h || '').trim());
    const rows = data.slice(1);
    const result = [];

    rows.forEach((row, idx) => {
      const isRowEmpty = row.every(c => c === '' || c === null || c === undefined);
      if (isRowEmpty) return;

      const obj = { id: idx + 1 };
      headers.forEach((h, hIdx) => {
        let val = row[hIdx];
        if (val instanceof Date) {
          val = formatBioDateISO(val) + ' ' + formatBioTimeHHMMSS(val);
        } else if (val !== undefined && val !== null) {
          val = String(val).trim();
        } else {
          val = '';
        }
        obj[h] = val;
        obj['col' + (hIdx + 1)] = val;
      });

      // Pemetaan langsung Kolom 48 (Index 47) - TGL TUGAS
      let val48 = row[47];
      if (val48 instanceof Date) {
        val48 = formatBioDateISO(val48);
      } else if (val48 !== undefined && val48 !== null) {
        val48 = String(val48).trim();
      } else {
        val48 = '';
      }
      obj._col48 = val48;
      obj['col48'] = val48;

      // Pemetaan langsung Kolom 42, 43, 44, 45 dari Sheet Bio Karyawan (Riwayat Jabatan: Divisi=42, Jabatan=43, Fungsional=44, Kantor=45)
      let val42 = row[41] !== undefined && row[41] !== null ? String(row[41]).trim() : '';
      obj._col42 = val42 || obj.col42 || obj['Divisi'] || obj['Departemen'] || '';

      let val43 = row[42] !== undefined && row[42] !== null ? String(row[42]).trim() : '';
      obj._col43 = val43 || obj.col43 || obj['Jabatan'] || obj['Posisi'] || '';

      let val44 = row[43] !== undefined && row[43] !== null ? String(row[43]).trim() : '';
      obj._col44 = val44 || obj.col44 || obj['Fungsional'] || '';

      let val45Kantor = row[44] !== undefined && row[44] !== null ? String(row[44]).trim() : '';
      obj._col45 = val45Kantor || obj.col45 || obj['Kantor'] || obj['Lokasi'] || '';

      // Pemetaan Pasfoto (Index 48 atau Kolom Pasfoto)
      let valPhoto = row[48] !== undefined && row[48] !== null ? String(row[48]).trim() : (obj['Pasfoto'] || obj['Foto'] || obj['Photo'] || '');
      obj._colPhoto = valPhoto;

      // Pemetaan langsung Kolom 15 (Index 14 - Pendidikan Terakhir) & Kolom 16 (Index 15 - Jurusan)
      let val15 = row[14] !== undefined && row[14] !== null ? String(row[14]).trim() : '';
      obj._col15 = val15 || obj.col15 || obj['Pendidikan Terakhir'] || '';
      obj['col15'] = obj._col15;

      let val16 = row[15] !== undefined && row[15] !== null ? String(row[15]).trim() : '';
      obj._col16 = val16 || obj.col16 || obj['Jurusan Pendidikan Terakhir'] || obj['Jurusan'] || '';
      obj['col16'] = obj._col16;

      // Pemetaan langsung Kolom 38 (Index 37 - STATUS) & STATUSEMP & Kolom 39 (Index 38 - TANGGAL)
      let val38 = row[37] !== undefined && row[37] !== null ? String(row[37]).trim() : '';
      obj._col38 = val38 || obj.col38 || obj['Status Karyawan'] || obj['Status'] || '';
      obj['col38'] = obj._col38;

      let valStatusEmp = obj['STATUSEMP'] || obj['StatusEMP'] || obj['Status EMP'] || obj['StatusEmp'] || obj['Status Kepegawaian'] || obj['Status Kerja'] || '';
      obj._statusEmp = valStatusEmp;
      obj['STATUSEMP'] = valStatusEmp;

      let val39 = row[38];
      if (val39 instanceof Date) {
        val39 = formatBioDateISO(val39);
      } else if (val39 !== undefined && val39 !== null) {
        val39 = String(val39).trim();
      } else {
        val39 = '';
      }
      obj._col39 = val39 || obj.col39 || obj['Tanggal'] || '';
      obj['col39'] = obj._col39;

      // Pemetaan langsung Kolom 40 (Index 39) & Kolom 47 (Index 46) dari Sheet Bio Karyawan
      let val40 = row[39];
      if (val40 instanceof Date) {
        val40 = formatBioDateISO(val40);
      } else if (val40 !== undefined && val40 !== null) {
        val40 = String(val40).trim();
      } else {
        val40 = '';
      }
      obj._col40 = val40;
      obj['col40'] = val40;

      let val47 = row[46];
      if (val47 instanceof Date) {
        val47 = formatBioDateISO(val47);
      } else if (val47 !== undefined && val47 !== null) {
        val47 = String(val47).trim();
      } else {
        val47 = '';
      }
      obj._col47 = val47;
      obj['col47'] = val47;

      // Pemetaan langsung Kolom 51 (Index 50 - Nomor Induk Kepegawaian) / Header "Nomor Induk Kepegawaian"
      let val51 = row[50];
      if (val51 instanceof Date) {
        val51 = formatBioDateISO(val51);
      } else if (val51 !== undefined && val51 !== null) {
        val51 = String(val51).trim();
      } else {
        val51 = '';
      }
      obj._col51 = obj['Nomor Induk Kepegawaian'] || val51 || obj.col51 || obj['NIK Kepegawaian'] || obj['NIK Pegawai'] || obj['NIK'] || '';
      obj['col51'] = obj._col51;

      result.push(obj);
    });

    try {
      cache.put('BIO_KARYAWAN_LIST_CACHE_V4', JSON.stringify(result), 1800); // 30 Menit Cache
    } catch (e) {}

    return { success: true, data: result, source: 'sheet' };
  } catch (err) {
    return { success: false, message: 'Gagal mengambil data list Bio Karyawan: ' + err.toString() };
  }
}

/**
 * Mengambil data Sheet "KodePos" dengan CacheService 6 Jam untuk kecepatan instan kilat
 */
function getKodePosSheetData(forceRefresh) {
  try {
    const cache = CacheService.getScriptCache();
    if (!forceRefresh) {
      const cachedData = cache.get('KODEPOS_SHEET_DATA_V2');
      if (cachedData) {
        try {
          return { success: true, data: JSON.parse(cachedData), source: 'cache' };
        } catch (e) {}
      }
    }

    const ss = getDb();
    let sheet = ss.getSheetByName('KodePos') || 
                ss.getSheetByName('Kode Pos') || 
                ss.getSheetByName('Kodepos') || 
                ss.getSheetByName('Kode_Pos');
    
    if (!sheet) {
      const sheets = ss.getSheets();
      for (let i = 0; i < sheets.length; i++) {
        const sName = sheets[i].getName().trim().toLowerCase();
        if (sName.includes('kodepos') || sName.includes('kode pos')) {
          sheet = sheets[i];
          break;
        }
      }
    }
    
    if (!sheet) {
      sheet = ss.insertSheet('KodePos');
    }
    
    if (sheet.getLastRow() === 0) {
      const defaultHeaders = ['Kode Pos', 'Kelurahan/Desa', 'Kecamatan', 'Kabupaten/Kota', 'Provinsi'];
      sheet.appendRow(defaultHeaders);
      
      const sampleData = [
        ['10110', 'Petojo Selatan', 'Gambir', 'Kota Jakarta Pusat', 'DKI Jakarta'],
        ['10120', 'Gambir', 'Gambir', 'Kota Jakarta Pusat', 'DKI Jakarta'],
        ['12110', 'Gunung', 'Kebayoran Baru', 'Kota Jakarta Selatan', 'DKI Jakarta'],
        ['15111', 'Tangerang', 'Tangerang', 'Kota Tangerang', 'Banten'],
        ['16111', 'Gudang', 'Bogor Tengah', 'Kota Bogor', 'Jawa Barat'],
        ['16411', 'Depok', 'Pancasari', 'Kota Depok', 'Jawa Barat'],
        ['17111', 'Bekasi Jaya', 'Bekasi Timur', 'Kota Bekasi', 'Jawa Barat'],
        ['40111', 'Braga', 'Sumur Bandung', 'Kota Bandung', 'Jawa Barat'],
        ['40132', 'Lebak Siliwangi', 'Coblong', 'Kota Bandung', 'Jawa Barat'],
        ['50111', 'Kauman', 'Semarang Tengah', 'Kota Semarang', 'Jawa Tengah'],
        ['55111', 'Ngupasan', 'Gondomanan', 'Kota Yogyakarta', 'DI Yogyakarta'],
        ['60111', 'Surabaya', 'Tegalsari', 'Kota Surabaya', 'Jawa Timur'],
        ['20111', 'Kesawan', 'Medan Barat', 'Kota Medan', 'Sumatera Utara'],
        ['90111', 'Pattunuang', 'Wajo', 'Kota Makassar', 'Sulawesi Selatan'],
        ['80111', 'Dangin Puri', 'Denpasar Timur', 'Kota Denpasar', 'Bali']
      ];
      
      sampleData.forEach(r => sheet.appendRow(r));
      
      const headerRange = sheet.getRange(1, 1, 1, defaultHeaders.length);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#0f172a');
      headerRange.setFontColor('#38bdf8');
    }
    
    const data = sheet.getDataRange().getValues();
    if (!data || data.length < 2) return { success: true, data: [] };
    
    const headers = data[0].map(h => String(h || '').trim());
    const rows = data.slice(1);
    const result = [];
    
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (r.every(c => c === '' || c === null || c === undefined)) continue;
      const item = { id: i + 1 };
      for (let j = 0; j < headers.length; j++) {
        item[headers[j]] = r[j] !== undefined && r[j] !== null ? String(r[j]).trim() : '';
      }
      result.push(item);
    }

    try {
      cache.put('KODEPOS_SHEET_DATA_V2', JSON.stringify(result), 21600);
    } catch (e) {}

    return { success: true, data: result, source: 'sheet' };
  } catch (err) {
    return { success: false, message: 'Gagal mengambil data Sheet KodePos: ' + err.toString() };
  }
}

/**
 * Utilitas Khusus: Mengambil Detail Lengkap Data Kepegawaian (mod_detail_emp)
 */
function getEmployeeDetailData(empIdentifier) {
  try {
    const listRes = getBioKaryawanList(false);
    if (!listRes.success || !listRes.data || listRes.data.length === 0) {
      return { success: false, message: 'Data Karyawan kosong atau tidak ditemukan.' };
    }

    const list = listRes.data;
    let target = null;

    if (empIdentifier) {
      const query = String(empIdentifier).trim().toLowerCase();
      target = list.find(emp => {
        const idStr = String(emp.id || '');
        const nameStr = String(emp['Nama Karyawan'] || emp.Nama || '').toLowerCase();
        const nikStr = String(emp['NIK'] || emp['No NIK'] || emp['Nomor KTP'] || '').toLowerCase();
        return idStr === query || nameStr === query || nikStr === query || nameStr.includes(query);
      });
    }

    // Default ke karyawan pertama jika tidak ada query spesifik
    if (!target) {
      target = list[0];
    }

    return {
      success: true,
      data: target
    };
  } catch (e) {
    return { success: false, message: 'Gagal memuat detail karyawan: ' + e.message };
  }
}

/**
 * ============================================================================
 * EMPLOYEE BIO ANALYTICS HANDLER (mod_emp_analytics)
 * ============================================================================
 * Menghitung & mengagregasi data statistik demografi bio karyawan
 * Menggunakan CacheService RAM Caching untuk performa super instan
 */
function getEmployeeBioSummaryData(forceRefresh) {
  try {
    const cache = CacheService.getScriptCache();
    if (!forceRefresh) {
      const cached = cache.get('EMPLOYEE_BIO_ANALYTICS_CACHE_V3');
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch (e) {}
      }
    }

    const listRes = getBioKaryawanList(forceRefresh);
    const list = (listRes && listRes.success && Array.isArray(listRes.data)) ? listRes.data : [];

    const totalEmployees = list.length;
    let activeCount = 0;
    let inactiveCount = 0;
    let maleCount = 0;
    let femaleCount = 0;
    let marriedCount = 0;
    let singleCount = 0;

    let totalAgeYears = 0;
    let validAgeCount = 0;

    const ageGroupCounts = {
      '< 25 Tahun': 0,
      '25 - 34 Tahun': 0,
      '35 - 44 Tahun': 0,
      '≥ 45 Tahun': 0
    };

    const educationCounts = {
      'SMA / SMK': 0,
      'D3': 0,
      'S1': 0,
      'S2': 0,
      'S3': 0,
      'Lainnya': 0
    };

    const tenureCounts = {
      '< 1 Tahun': 0,
      '1 - 3 Tahun': 0,
      '3 - 5 Tahun': 0,
      '> 5 Tahun': 0
    };

    const cityMap = {};
    const nowYear = 2026;
    const nowMonth = 8; // Agustus

    list.forEach(emp => {
      // 1. Status Aktif vs Inaktif (Diambil dari Header "Status")
      const rawStatus = String(emp['Status'] || emp['Status Kepegawaian'] || emp['Status Karyawan'] || emp['_col38'] || emp['col38'] || 'Aktif').trim();
      const statusStr = rawStatus.toLowerCase();
      if (statusStr.includes('inaktif') || statusStr.includes('resign') || statusStr.includes('keluar') || statusStr.includes('non-aktif') || statusStr.includes('non aktif') || statusStr.includes('pasif') || statusStr.includes('off')) {
        inactiveCount++;
      } else {
        activeCount++;
      }

      // 2. Gender
      const jkStr = String(emp['Jenis Kelamin'] || emp['Gender'] || emp['JK'] || emp['col3'] || emp['_col3'] || '').toLowerCase();
      if (jkStr.includes('pria') || jkStr.includes('laki') || jkStr === 'l') {
        maleCount++;
      } else if (jkStr.includes('wanita') || jkStr.includes('perempuan') || jkStr === 'p') {
        femaleCount++;
      }

      // 3. Status Pernikahan
      const spouseName = String(emp['Nama Suami/Istri'] || emp['Status Pernikahan'] || emp['Status Nikah'] || emp['col18'] || '').trim();
      if (spouseName && spouseName !== '-' && spouseName.toLowerCase() !== 'lajang' && spouseName.toLowerCase() !== 'belum menikah') {
        marriedCount++;
      } else {
        singleCount++;
      }

      // 4. Umur / Kelompok Usia
      const birthStr = emp['Tanggal Lahir'] || emp['Tgl Lahir'] || emp['col4'] || emp['_col4'] || '';
      let birthYear = 0;
      if (birthStr) {
        const parts = String(birthStr).split('-');
        if (parts.length === 3) {
          birthYear = parseInt(parts[0]);
        } else {
          const dt = new Date(birthStr);
          if (!isNaN(dt.getTime())) birthYear = dt.getFullYear();
        }
      }

      if (birthYear > 1940 && birthYear <= nowYear) {
        const age = nowYear - birthYear;
        totalAgeYears += age;
        validAgeCount++;

        if (age < 25) {
          ageGroupCounts['< 25 Tahun']++;
        } else if (age >= 25 && age <= 34) {
          ageGroupCounts['25 - 34 Tahun']++;
        } else if (age >= 35 && age <= 44) {
          ageGroupCounts['35 - 44 Tahun']++;
        } else {
          ageGroupCounts['≥ 45 Tahun']++;
        }
      }

      // 5. Jenjang Pendidikan (Diambil dari Header "Pendidikan Terakhir")
      const eduStr = String(emp['Pendidikan Terakhir'] || emp['PendidikanTerakhir'] || emp['Pendidikan'] || emp['Tingkat Pendidikan'] || emp['_col15'] || emp['col15'] || '').trim().toUpperCase();
      if (eduStr.includes('S3')) {
        educationCounts['S3']++;
      } else if (eduStr.includes('S2')) {
        educationCounts['S2']++;
      } else if (eduStr.includes('S1') || eduStr.includes('D4') || eduStr.includes('SARJANA')) {
        educationCounts['S1']++;
      } else if (eduStr.includes('D3') || eduStr.includes('D2') || eduStr.includes('D1') || eduStr.includes('DIPLOMA')) {
        educationCounts['D3']++;
      } else if (eduStr.includes('SMA') || eduStr.includes('SMK') || eduStr.includes('SLTA') || eduStr.includes('STM') || eduStr.includes('SMU')) {
        educationCounts['SMA / SMK']++;
      } else {
        educationCounts['Lainnya']++;
      }

      // 6. Masa Kerja / Senioritas (Diambil dari Header "TanggalMulaiTugas")
      const joinStr = emp['TanggalMulaiTugas'] || emp['Tanggal Mulai Tugas'] || emp['TglMulaiTugas'] || emp['TanggalTugas'] || emp['TGL TUGAS'] || emp['_col48'] || emp['col48'] || emp['Tanggal Masuk'] || emp['Mulai Kerja'] || emp['_col47'] || emp['col47'] || '';
      let joinYear = 0;
      let joinMonth = 1;
      if (joinStr) {
        const parts = String(joinStr).split('-');
        if (parts.length === 3) {
          joinYear = parseInt(parts[0]);
          joinMonth = parseInt(parts[1]) || 1;
        } else {
          const dt = new Date(joinStr);
          if (!isNaN(dt.getTime())) {
            joinYear = dt.getFullYear();
            joinMonth = dt.getMonth() + 1;
          }
        }
      }

      let tenure = 0;
      if (joinYear > 1990 && joinYear <= nowYear) {
        tenure = (nowYear - joinYear) + ((nowMonth - joinMonth) / 12);
      } else {
        tenure = 0.5; // Default < 1 thn jika tanggal mulai tugas belum diisi
      }

      if (tenure < 1.0) tenureCounts['< 1 Tahun']++;
      else if (tenure >= 1.0 && tenure <= 3.0) tenureCounts['1 - 3 Tahun']++;
      else if (tenure > 3.0 && tenure <= 5.0) tenureCounts['3 - 5 Tahun']++;
      else tenureCounts['> 5 Tahun']++;

      // 7. Distribusi Karyawan per Kota & Kantor (Diambil dari Header "Kabupaten/Kota" & "Kantor" Bio Karyawan)
      let rawKota = '';
      for (let key in emp) {
        const kLower = key.toLowerCase();
        if ((kLower.includes('kota') || kLower.includes('kabupaten') || kLower.includes('domisili')) && !kLower.includes('lahir') && emp[key]) {
          const val = String(emp[key]).trim();
          if (val && val !== '-') { rawKota = val; break; }
        }
      }
      if (!rawKota) {
        rawKota = String(emp['Kabupaten/Kota'] || emp['Kota'] || emp['Kabupaten'] || emp['col12'] || emp['_col12'] || '').trim();
      }

      let rawKantor = '';
      for (let key in emp) {
        const kLower = key.toLowerCase();
        if ((kLower.includes('kantor') || kLower.includes('lokasi') || kLower.includes('cabang') || kLower.includes('penempatan')) && emp[key]) {
          const val = String(emp[key]).trim();
          if (val && val !== '-') { rawKantor = val; break; }
        }
      }
      if (!rawKantor) {
        rawKantor = String(emp['Kantor'] || emp['Lokasi Kantor'] || emp['Kantor/Lokasi'] || emp['Lokasi'] || emp['_col45'] || emp['col45'] || '').trim();
      }

      let locLabel = '';
      if (rawKota && rawKota !== '-') {
        if (rawKantor && rawKantor !== '-' && !rawKantor.toLowerCase().includes(rawKota.toLowerCase()) && !rawKota.toLowerCase().includes(rawKantor.toLowerCase())) {
          locLabel = rawKota + ' (' + rawKantor + ')';
        } else {
          locLabel = rawKota;
        }
      } else if (rawKantor && rawKantor !== '-') {
        locLabel = rawKantor;
      }

      if (locLabel) {
        cityMap[locLabel] = (cityMap[locLabel] || 0) + 1;
      }
    });

    // Format Lists & Percentages
    const avgAge = validAgeCount > 0 ? Math.round(totalAgeYears / validAgeCount) : 0;

    let educationList = Object.keys(educationCounts).map(key => {
      const count = educationCounts[key];
      const pct = totalEmployees > 0 ? Math.round((count / totalEmployees) * 100) : 0;
      return { label: key, count: count, percentage: pct };
    }).sort((a, b) => b.count - a.count);

    let dominantEdu = '-';
    let dominantEduCount = 0;
    if (educationList.length > 0 && educationList[0].count > 0) {
      dominantEdu = educationList[0].label;
      dominantEduCount = educationList[0].count;
    }

    let ageGroupList = Object.keys(ageGroupCounts).map(key => {
      const count = ageGroupCounts[key];
      const pct = totalEmployees > 0 ? Math.round((count / totalEmployees) * 100) : 0;
      return { label: key, count: count, percentage: pct };
    });

    let dominantAgeGroup = '-';
    let maxAgeGroupCount = -1;
    ageGroupList.forEach(ag => {
      if (ag.count > maxAgeGroupCount && ag.count > 0) {
        maxAgeGroupCount = ag.count;
        dominantAgeGroup = ag.label;
      }
    });

    let tenureList = Object.keys(tenureCounts).map(key => {
      const count = tenureCounts[key];
      const pct = totalEmployees > 0 ? Math.round((count / totalEmployees) * 100) : 0;
      return { label: key, count: count, percentage: pct };
    });

    let sheetEduList = getRekapDashboardEducationData();
    if (sheetEduList && sheetEduList.length > 0) {
      educationList = sheetEduList;
      if (educationList.length > 0) {
        dominantEdu = educationList[0].label;
        dominantEduCount = educationList[0].count;
      }
    }

    let sheetAgeList = getRekapDashboardAgeGroupData();
    if (sheetAgeList && sheetAgeList.length > 0) {
      ageGroupList = sheetAgeList;
    }

    let sheetTenureList = getRekapDashboardTenureData();
    if (sheetTenureList && sheetTenureList.length > 0) {
      tenureList = sheetTenureList;
    }

    let topCities = getRekapDashboardLocationData();
    if (!topCities || topCities.length === 0) {
      topCities = Object.keys(cityMap).map(c => {
        return { name: c, count: cityMap[c] };
      }).sort((a, b) => b.count - a.count);
    }

    const statusRekap = getRekapDashboardEmployeeStatusData();
    const genderRekap = getRekapDashboardGenderData();
    const typeRekap = getRekapDashboardEmployeeTypeData();

    const result = {
      success: true,
      totalEmployees: totalEmployees,
      activeCount: statusRekap.hasData ? statusRekap.activeCount : activeCount,
      inactiveCount: statusRekap.hasData ? statusRekap.inactiveCount : inactiveCount,
      activeLabel: statusRekap.activeLabel,
      inactiveLabel: statusRekap.inactiveLabel,
      maleCount: genderRekap.hasData ? genderRekap.maleCount : maleCount,
      femaleCount: genderRekap.hasData ? genderRekap.femaleCount : femaleCount,
      maleLabel: genderRekap.maleLabel || 'LAKI-LAKI',
      femaleLabel: genderRekap.femaleLabel || 'PEREMPUAN',
      empTypeActiveCount: typeRekap.activeCount,
      empTypeInactiveCount: typeRekap.inactiveCount,
      empTypeActiveLabel: typeRekap.activeLabel,
      empTypeInactiveLabel: typeRekap.inactiveLabel,
      employeeTypeTotal: typeRekap.totalValue,
      marriedCount: marriedCount,
      singleCount: singleCount,
      avgAge: avgAge,
      dominantAgeGroup: dominantAgeGroup,
      dominantEducation: dominantEdu,
      dominantEducationCount: dominantEduCount,
      educationList: educationList,
      ageGroupList: ageGroupList,
      tenureList: tenureList,
      topCities: topCities
    };

    try {
      cache.put('EMPLOYEE_BIO_ANALYTICS_CACHE_V16', JSON.stringify(result), 1800); // 30 Menit Cache
    } catch (e) {}

    return result;

  } catch (err) {
    Logger.log('Error getEmployeeBioSummaryData: ' + err.toString());
    return {
      success: false,
      message: 'Gagal memuat Analytics Karyawan: ' + err.message,
      totalEmployees: 0,
      educationList: [],
      ageGroupList: [],
      tenureList: [],
      topCities: []
    };
  }
}

/**
 * Helper khusus membaca Status Karyawan dari Sheet "RekapDashboard" range D1:E2
 * SESUAI PERINTAH USER: D1:E2 memuat Status Karyawan (misal: Aktif / Inaktif)
 */
function getRekapDashboardEmployeeStatusData() {
  let activeCount = 0; // Row 2 Col 4 (D2 - PKWT)
  let inactiveCount = 0; // Row 2 Col 5 (E2 - PKWTT)
  let activeLabel = 'PKWT'; // Row 1 Col 4 (D1)
  let inactiveLabel = 'PKWTT'; // Row 1 Col 5 (E1)
  let hasData = false;

  try {
    const sheet = findSheetByNameFlexible('RekapDashboard');
    if (sheet && sheet.getLastRow() >= 1) {
      // Range D1:E2 (Row 1-2, Column 4-5)
      const data = sheet.getRange(1, 4, Math.min(sheet.getLastRow(), 2), 2).getValues();
      if (data && data.length > 0) {
        const row1 = data[0] || [];
        const row2 = data.length > 1 ? data[1] : [];

        const d1 = String(row1[0] || '').trim();
        const e1 = String(row1[1] || '').trim();
        const d2 = row2[0] !== undefined && row2[0] !== null ? row2[0] : '';
        const e2 = row2[1] !== undefined && row2[1] !== null ? row2[1] : '';

        if (d1) activeLabel = d1;
        if (e1) inactiveLabel = e1;

        const pD2 = parseInt(String(d2).trim(), 10);
        const pE2 = parseInt(String(e2).trim(), 10);

        if (!isNaN(pD2)) {
          activeCount = pD2;
          hasData = true;
        }
        if (!isNaN(pE2)) {
          inactiveCount = pE2;
          hasData = true;
        }
      }
    }
  } catch (e) {
    Logger.log('Error getRekapDashboardEmployeeStatusData: ' + e.toString());
  }

  return {
    hasData: hasData,
    activeLabel: activeLabel,
    activeCount: activeCount,
    inactiveLabel: inactiveLabel,
    inactiveCount: inactiveCount,
    pkwtLabel: activeLabel,
    pkwtCount: activeCount,
    pkwttLabel: inactiveLabel,
    pkwttCount: inactiveCount
  };
}

/**
 * Helper khusus membaca Rasio Gender dari Sheet "RekapDashboard" range G1:H2
 * SESUAI PERINTAH USER: Baris 2 Kolom 7 (G2) = LAKI-LAKI, Baris 2 Kolom 8 (H2) = PEREMPUAN
 */
function getRekapDashboardGenderData() {
  let maleCount = 0; // Row 2 Col 7 (G2 - LAKI-LAKI)
  let femaleCount = 0; // Row 2 Col 8 (H2 - PEREMPUAN)
  let maleLabel = 'LAKI-LAKI'; // Row 1 Col 7 (G1)
  let femaleLabel = 'PEREMPUAN'; // Row 1 Col 8 (H1)
  let hasData = false;

  try {
    const sheet = findSheetByNameFlexible('RekapDashboard');
    if (sheet && sheet.getLastRow() >= 1) {
      // Range G1:H2 (Row 1-2, Column 7-8)
      const data = sheet.getRange(1, 7, Math.min(sheet.getLastRow(), 2), 2).getValues();
      if (data && data.length > 0) {
        const row1 = data[0] || [];
        const row2 = data.length > 1 ? data[1] : [];

        const g1 = String(row1[0] || '').trim();
        const h1 = String(row1[1] || '').trim();
        const g2 = row2[0] !== undefined && row2[0] !== null ? row2[0] : '';
        const h2 = row2[1] !== undefined && row2[1] !== null ? row2[1] : '';

        if (g1) maleLabel = g1;
        if (h1) femaleLabel = h1;

        const pG2 = parseInt(String(g2).trim(), 10);
        const pH2 = parseInt(String(h2).trim(), 10);

        if (!isNaN(pG2)) {
          maleCount = pG2;
          hasData = true;
        }
        if (!isNaN(pH2)) {
          femaleCount = pH2;
          hasData = true;
        }
      }
    }
  } catch (e) {
    Logger.log('Error getRekapDashboardGenderData: ' + e.toString());
  }

  return {
    hasData: hasData,
    maleLabel: maleLabel,
    maleCount: maleCount,
    femaleLabel: femaleLabel,
    femaleCount: femaleCount
  };
}

/**
 * Helper khusus membaca Tipe Karyawan dari Sheet "RekapDashboard" range J1:L2
 * J2: Aktif, K2: Non Aktif, L2: Total / Nilai Tipe Karyawan
 */
function getRekapDashboardEmployeeTypeData() {
  let activeCount = 0; // Row 2 Col 10 (J2)
  let inactiveCount = 0; // Row 2 Col 11 (K2)
  let totalValue = 0; // Row 2 Col 12 (L2)
  let activeLabel = 'AKTIF'; // Row 1 Col 10 (J1)
  let inactiveLabel = 'NON-AKTIF'; // Row 1 Col 11 (K1)
  let totalLabel = 'Tipe Karyawan'; // Row 1 Col 12 (L1)
  let hasData = false;

  try {
    const sheet = findSheetByNameFlexible('RekapDashboard');
    if (sheet && sheet.getLastRow() >= 1) {
      // Range J1:L2 (Row 1-2, Column 10-12)
      const data = sheet.getRange(1, 10, Math.min(sheet.getLastRow(), 2), 3).getValues();
      if (data && data.length > 0) {
        const row1 = data[0] || [];
        const row2 = data.length > 1 ? data[1] : [];

        const j1 = String(row1[0] || '').trim();
        const k1 = String(row1[1] || '').trim();
        const l1 = String(row1[2] || '').trim();

        const j2 = row2[0] !== undefined && row2[0] !== null ? row2[0] : '';
        const k2 = row2[1] !== undefined && row2[1] !== null ? row2[1] : '';
        const l2 = row2[2] !== undefined && row2[2] !== null ? row2[2] : '';

        if (j1) activeLabel = j1;
        if (k1) inactiveLabel = k1;
        if (l1) totalLabel = l1;

        const pJ2 = parseInt(String(j2).trim(), 10);
        const pK2 = parseInt(String(k2).trim(), 10);
        const pL2 = parseInt(String(l2).trim(), 10);

        if (!isNaN(pJ2)) {
          activeCount = pJ2;
          hasData = true;
        } else if (j2 !== '') {
          activeCount = j2;
          hasData = true;
        }

        if (!isNaN(pK2)) {
          inactiveCount = pK2;
          hasData = true;
        } else if (k2 !== '') {
          inactiveCount = k2;
          hasData = true;
        }

        if (!isNaN(pL2)) {
          totalValue = pL2;
          hasData = true;
        } else if (l2 !== '') {
          totalValue = l2;
          hasData = true;
        }
      }
    }
  } catch (e) {
    Logger.log('Error getRekapDashboardEmployeeTypeData: ' + e.toString());
  }

  return {
    hasData: hasData,
    activeLabel: activeLabel,
    activeCount: activeCount,
    inactiveLabel: inactiveLabel,
    inactiveCount: inactiveCount,
    totalLabel: totalLabel,
    totalValue: totalValue
  };
}

/**
 * Helper khusus membaca Distribusi Karyawan per Kantor/Lokasi dari Sheet "RekapDashboard"
 * PEMETAAN EKSPLISIT KOREKSI USER (VERTIKAL A1:B7):
 * - Kolom A (A1:A7): Nama Lokasi (Pusat, Sumareccon, Surabaya, Samarinda, Sukoharjo, Banyumas, Pemalang)
 * - Kolom B (B1:B7): Jumlah Karyawan masing-masing lokasi
 */
function getRekapDashboardLocationData() {
  const list = [];
  try {
    const sheet = findSheetByNameFlexible('RekapDashboard');
    if (!sheet || sheet.getLastRow() < 1) return list;

    // Ambil range A1:B7 (Baris 1 s/d 7, Kolom 1 s/d 2)
    const maxRow = Math.min(sheet.getLastRow(), 7);
    const rangeData = sheet.getRange(1, 1, maxRow, 2).getValues();
    if (!rangeData || rangeData.length === 0) return list;

    for (let r = 0; r < rangeData.length; r++) {
      const row = rangeData[r];
      if (!row || row.length === 0) continue;

      const nameVal = String(row[0] !== undefined && row[0] !== null ? row[0] : '').trim();
      const countVal = row[1] !== undefined && row[1] !== null ? row[1] : 0;

      if (!nameVal || nameVal === '-') continue;

      let parsedCount = 0;
      if (typeof countVal === 'number') {
        parsedCount = countVal;
      } else {
        parsedCount = parseInt(String(countVal).trim(), 10) || 0;
      }

      list.push({
        name: nameVal,
        count: parsedCount
      });
    }
  } catch (e) {
    Logger.log('Error getRekapDashboardLocationData: ' + e.toString());
  }
  return list;
}

/**
 * Helper khusus membaca Distribusi Jenjang Pendidikan dari Sheet "RekapDashboard" (A10:B17)
 * - Kolom A (A10:A17): Jenjang Pendidikan (S1, SMA/SMK, D3, S2, S3, Lainnya)
 * - Kolom B (B10:B17): Jumlah Karyawan
 */
function getRekapDashboardEducationData() {
  const list = [];
  try {
    const sheet = findSheetByNameFlexible('RekapDashboard');
    if (!sheet || sheet.getLastRow() < 10) return list;

    const maxRow = Math.min(sheet.getLastRow(), 17);
    if (maxRow < 10) return list;

    const rangeData = sheet.getRange(10, 1, maxRow - 9, 2).getValues();
    if (!rangeData || rangeData.length === 0) return list;

    let totalCount = 0;
    const rawItems = [];

    for (let r = 0; r < rangeData.length; r++) {
      const row = rangeData[r];
      if (!row || row.length === 0) continue;

      const labelVal = String(row[0] !== undefined && row[0] !== null ? row[0] : '').trim();
      const countVal = row[1] !== undefined && row[1] !== null ? row[1] : 0;

      if (!labelVal || labelVal === '-') continue;

      let parsedCount = 0;
      if (typeof countVal === 'number') {
        parsedCount = countVal;
      } else {
        parsedCount = parseInt(String(countVal).trim(), 10) || 0;
      }

      totalCount += parsedCount;
      rawItems.push({ label: labelVal, count: parsedCount });
    }

    for (let i = 0; i < rawItems.length; i++) {
      const item = rawItems[i];
      const pct = totalCount > 0 ? Math.round((item.count / totalCount) * 100) : 0;
      list.push({
        label: item.label,
        count: item.count,
        percentage: pct
      });
    }
  } catch (e) {
    Logger.log('Error getRekapDashboardEducationData: ' + e.toString());
  }
  return list;
}

/**
 * Helper khusus membaca Demografi Kelompok Umur dari Sheet "RekapDashboard" (A20:B24)
 * - Kolom A (A20:A24): Kelompok Umur (< 25 Tahun, 25 - 34 Tahun, 35 - 44 Tahun, > 45 Tahun)
 * - Kolom B (B20:B24): Jumlah Karyawan
 */
function getRekapDashboardAgeGroupData() {
  const list = [];
  try {
    const sheet = findSheetByNameFlexible('RekapDashboard');
    if (!sheet || sheet.getLastRow() < 20) return list;

    const maxRow = Math.min(sheet.getLastRow(), 24);
    if (maxRow < 20) return list;

    const rangeData = sheet.getRange(20, 1, maxRow - 19, 2).getValues();
    if (!rangeData || rangeData.length === 0) return list;

    let totalCount = 0;
    const rawItems = [];

    for (let r = 0; r < rangeData.length; r++) {
      const row = rangeData[r];
      if (!row || row.length === 0) continue;

      const labelVal = String(row[0] !== undefined && row[0] !== null ? row[0] : '').trim();
      const countVal = row[1] !== undefined && row[1] !== null ? row[1] : 0;

      if (!labelVal || labelVal === '-') continue;

      let parsedCount = 0;
      if (typeof countVal === 'number') {
        parsedCount = countVal;
      } else {
        parsedCount = parseInt(String(countVal).trim(), 10) || 0;
      }

      totalCount += parsedCount;
      rawItems.push({ label: labelVal, count: parsedCount });
    }

    for (let i = 0; i < rawItems.length; i++) {
      const item = rawItems[i];
      const pct = totalCount > 0 ? Math.round((item.count / totalCount) * 100) : 0;
      list.push({
        label: item.label,
        count: item.count,
        percentage: pct
      });
    }
  } catch (e) {
    Logger.log('Error getRekapDashboardAgeGroupData: ' + e.toString());
  }
  return list;
}

/**
 * Helper khusus membaca Masa Kerja & Senioritas dari Sheet "RekapDashboard" (A27:B31)
 * - Kolom A (A27:A31): Rentang Masa Kerja (< 1 Tahun, 1 - 3 Tahun, 3 - 5 Tahun, > 5 Tahun)
 * - Kolom B (B27:B31): Jumlah Karyawan
 */
function getRekapDashboardTenureData() {
  const list = [];
  try {
    const sheet = findSheetByNameFlexible('RekapDashboard');
    if (!sheet || sheet.getLastRow() < 27) return list;

    const maxRow = Math.min(sheet.getLastRow(), 31);
    if (maxRow < 27) return list;

    const rangeData = sheet.getRange(27, 1, maxRow - 26, 2).getValues();
    if (!rangeData || rangeData.length === 0) return list;

    let totalCount = 0;
    const rawItems = [];

    for (let r = 0; r < rangeData.length; r++) {
      const row = rangeData[r];
      if (!row || row.length === 0) continue;

      const labelVal = String(row[0] !== undefined && row[0] !== null ? row[0] : '').trim();
      const countVal = row[1] !== undefined && row[1] !== null ? row[1] : 0;

      if (!labelVal || labelVal === '-') continue;

      let parsedCount = 0;
      if (typeof countVal === 'number') {
        parsedCount = countVal;
      } else {
        parsedCount = parseInt(String(countVal).trim(), 10) || 0;
      }

      totalCount += parsedCount;
      rawItems.push({ label: labelVal, count: parsedCount });
    }

    for (let i = 0; i < rawItems.length; i++) {
      const item = rawItems[i];
      const pct = totalCount > 0 ? Math.round((item.count / totalCount) * 100) : 0;
      list.push({
        label: item.label,
        count: item.count,
        percentage: pct
      });
    }
  } catch (e) {
    Logger.log('Error getRekapDashboardTenureData: ' + e.toString());
  }
  return list;
}
