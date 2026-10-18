/**
 * ============================================================================
 * ANGSURAN HAJI MANAGER (AngsuranHajiManager.gs)
 * ============================================================================
 * Backend manager untuk mengelola pencatatan angsuran haji nasabah & master Jamaah Haji:
 * 1. Sheet DataJamaahHaji (Haji Terencana, Pembiayaan Haji, Setoran Awal)
 * 2. Sheet EntryAngsuranHaji (Pencatatan angsuran & import batch)
 */

/**
 * Helper sanitasi format jumlah / nominal
 */
function parseSanitizedAmount(rawVal) {
  if (rawVal === undefined || rawVal === null) return 0;
  if (typeof rawVal === 'number') return isNaN(rawVal) ? 0 : rawVal;
  let s = String(rawVal).trim();
  if (!s) return 0;

  s = s.replace(/(IDR|USD|Rp)\s*/gi, '');
  if (s.includes(',')) {
    s = s.replace(/\./g, '');
    s = s.replace(/,/g, '.');
  } else {
    s = s.replace(/\./g, '');
  }

  s = s.replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(s);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Helper formula untuk mengisi BulanPendaftaran apabila data jamaah baru (tidak ditemukan)
 * - Haji Terencana -> "HT"+Bulan(2 digits)+" "+Tahun(4 digits), contoh: "HT09 2026"
 * - Setoran Awal -> "SA"+Bulan(2 digits)+" "+Tahun(4 digits), contoh: "SA09 2026"
 * - Pembiayaan Haji -> "PH"+Bulan(2 digits)+" "+Tahun(4 digits), contoh: "PH09 2026"
 */
function generateBulanPendaftaran(jenisHajiStr) {
  const now = new Date();
  const monthStr = String(now.getMonth() + 1).padStart(2, '0');
  const yearStr = String(now.getFullYear());

  const j = String(jenisHajiStr || '').toLowerCase().trim();
  let prefix = 'HT';
  if (j.includes('setoran') || j.includes('awal') || j === 'sa') {
    prefix = 'SA';
  } else if (j.includes('pembiayaan') || j === 'ph') {
    prefix = 'PH';
  } else if (j.includes('terencana') || j === 'ht') {
    prefix = 'HT';
  }

  return prefix + monthStr + ' ' + yearStr;
}

/**
 * Format string NoHP agar selalu diperlakukan sebagai teks murni (Text)
 */
function formatTextPhone(rawHp) {
  if (rawHp === undefined || rawHp === null) return '-';
  let s = String(rawHp).trim();
  if (!s || s === '-') return '-';
  if (/^8\d+$/.test(s)) {
    s = '0' + s;
  }
  return s;
}

/**
 * Memastikan nilai NoHP disimpan ke Google Sheets sebagai Teks murni
 */
function formatPhoneForSheet(rawHp) {
  const s = formatTextPhone(rawHp);
  if (!s || s === '-') return '-';
  if (s.startsWith('0') && !s.startsWith("'")) {
    return "'" + s;
  }
  return s;
}

/**
 * Helper untuk menyinkronkan & memastikan header kolom pada Sheet jika ada kolom baru
 */
function ensureSheetHeaders(sheet, expectedHeaders) {
  if (!sheet) return;
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(expectedHeaders);
    const headerRange = sheet.getRange(1, 1, 1, expectedHeaders.length);
    headerRange.setBackground('#1e293b');
    headerRange.setFontColor('#ffffff');
    headerRange.setFontWeight('bold');
    sheet.setFrozenRows(1);
    return;
  }

  const existingHeaders = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0].map(h => String(h || '').trim());
  const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  expectedHeaders.forEach(eh => {
    const found = existingHeaders.some(ex => norm(ex) === norm(eh));
    if (!found) {
      const nextCol = sheet.getLastColumn() + 1;
      const cell = sheet.getRange(1, nextCol);
      cell.setValue(eh);
      cell.setBackground('#1e293b');
      cell.setFontColor('#ffffff');
      cell.setFontWeight('bold');
      existingHeaders.push(eh);
    }
  });
}

/**
 * Memastikan Sheet DataJamaahHaji dan EntryAngsuranHaji siap digunakan & header lengkap
 */
function setupAngsuranHajiSheets() {
  const db = getDb();
  if (!db) return;

  // 1. Setup Sheet DataJamaahHaji
  const headersJamaah = [
    'Nama', 'NoSPPH', 'BulanPendaftaran', 'NoBPIH', 'NoHP', 'Mahram', 'JenisHaji',
    'IDJamaah', 'BankSetorAwal', 'Timestamp', 'CreatedAt', 'UpdatedAt',
    'BPJS', 'BuktiAngsuran', 'BuktiSetor', 'BuktiTransfer', 'KartuKeluarga', 'KTP', 'Paspor', 'SPPH', 'Foto', 'BukuNikah',
    'Visa', 'Tasreh', 'BPIHLunas', 'Doc', 'NoPorsi', 'NamaJamaah', 'NoKTP', 'NamaOrtu', 'TempatLahir', 'TanggalLahir', 'Umur',
    'JenisKelamin', 'Kewarganegaraan', 'Alamat', 'DesaKel', 'Kecamatan', 'KabKot', 'KabKota', 'Provinsi', 'NmProvinsi',
    'KodePos', 'Pendidikan', 'Pekerjaan', 'PergiHaji', 'HubMahram', 'NoPendaftaran', 'GolDarah', 'StatusNikah', 'TglSPPH',
    'PIN', 'Travel', 'Telp', 'StatusBPIH', 'StatusHaji', 'Bank', 'TglInput', 'TglLunas'
  ];
  const sheetJamaahName = (CONFIG.SHEETS && CONFIG.SHEETS.DATA_JAMAAH_HAJI) || 'DataJamaahHaji';
  const jamaahSheet = getOrCreateSheet(sheetJamaahName, headersJamaah);
  ensureSheetHeaders(jamaahSheet, headersJamaah);

  // Seed data awal jika Sheet DataJamaahHaji masih kosong (hanya ada header)
  if (jamaahSheet && jamaahSheet.getLastRow() <= 1) {
    const timeNow = getJakartaTimeString();
    const seedData = [
      {
        Timestamp: timeNow,
        IDJamaah: 'JH-2026-0001',
        Nama: 'H. Ahmad Dahlan',
        NoSPPH: 'SPPH-2026-0012',
        BulanPendaftaran: 'Januari 2026',
        NoBPIH: 'BPIH-9988771',
        NoHP: "'081234567890",
        Mahram: 'Hj. Siti Walidah (Istri)',
        JenisHaji: 'Setoran Awal',
        BankSetorAwal: 'Bank Syariah Indonesia (BSI)',
        CreatedAt: timeNow,
        UpdatedAt: timeNow
      },
      {
        Timestamp: timeNow,
        IDJamaah: 'JH-2026-0002',
        Nama: 'Hj. Siti Walidah',
        NoSPPH: 'SPPH-2026-0013',
        BulanPendaftaran: 'Januari 2026',
        NoBPIH: 'BPIH-9988772',
        NoHP: "'081298765432",
        Mahram: 'H. Ahmad Dahlan (Suami)',
        JenisHaji: 'Haji Terencana',
        BankSetorAwal: 'Bank Muamalat Indonesia',
        CreatedAt: timeNow,
        UpdatedAt: timeNow
      },
      {
        Timestamp: timeNow,
        IDJamaah: 'JH-2026-0003',
        Nama: 'Budi Santoso',
        NoSPPH: 'SPPH-2026-0014',
        BulanPendaftaran: 'Februari 2026',
        NoBPIH: 'BPIH-9988773',
        NoHP: "'085678901234",
        Mahram: '-',
        JenisHaji: 'Pembiayaan Haji',
        BankSetorAwal: 'Bank Mega Syariah',
        CreatedAt: timeNow,
        UpdatedAt: timeNow
      }
    ];
    seedData.forEach(item => insertRow(sheetJamaahName, item));
  }

  // 2. Setup Sheet EntryAngsuranHaji
  const headersAngsuran = [
    'Timestamp', 'ID', 'NoJurnal', 'IDJamaah', 'NoBPIH', 
    'NamaNasabah', 'Bank', 'Uraian', 'Jumlah', 'NilaiKurs', 
    'User', 'Tanggal', 'MetodePembayaran', 'Status', 'CreatedAt', 
    'TypeHaji', 'NoHP', 'LinkDokumen', 'NoJurnalErahajj'
  ];
  const sheetAngsuranName = (CONFIG.SHEETS && CONFIG.SHEETS.ENTRY_ANGSURAN_HAJI) || 'EntryAngsuranHaji';
  const angsuranSheet = getOrCreateSheet(sheetAngsuranName, headersAngsuran);
  ensureSheetHeaders(angsuranSheet, headersAngsuran);
}

/**
 * Mengambil daftar master DataJamaahHaji
 */
function getJamaahHajiListData() {
  try {
    setupAngsuranHajiSheets();
    const sheetName = (CONFIG.SHEETS && (CONFIG.SHEETS.DATA_HAJI || CONFIG.SHEETS.DATA_JAMAAH_HAJI)) || 'DataHaji';
    const rawData = getSheetData(sheetName) || [];

    const list = rawData.map((row, idx) => {
      const rawHp = getRowValue(row, ['nohp', 'no_hp', 'hp', 'telepon', 'phone', 'wa', 'nohandphone']);
      const bpihVal = getRowValue(row, ['nobpih', 'no_bpih', 'bpih', 'no bpih', 'no. bpih']);
      return {
        idJamaah: String(getRowValue(row, ['idjamaah', 'id_jamaah', 'id', 'nik']) || ('JH-' + (idx + 1).toString().padStart(4, '0'))),
        nama: String(getRowValue(row, ['nama', 'namajamaah', 'namanasabah']) || '-'),
        noSpph: String(getRowValue(row, ['nospph', 'no_spph', 'spph']) || '-'),
        bulanPendaftaran: String(getRowValue(row, ['bulanpendaftaran', 'bulan_pendaftaran', 'bulan']) || '-'),
        noBpih: String(bpihVal || '-'),
        noHp: formatTextPhone(rawHp),
        mahram: String(getRowValue(row, ['mahram', 'pendamping']) || '-'),
        jenisHaji: String(getRowValue(row, ['jenishaji', 'jenis_haji', 'typehaji']) || 'Setoran Awal'),
        bankSetorAwal: String(getRowValue(row, ['banksetorawal', 'bank_setor_awal', 'bank']) || 'Bank Syariah Indonesia (BSI)')
      };
    });

    return {
      success: true,
      data: list
    };
  } catch (e) {
    Logger.log('Error getJamaahHajiListData: ' + e.message);
    return { success: false, message: e.message, data: [] };
  }
}

/**
 * Mengambil seluruh data transaksi Angsuran Haji & master Jamaah Haji
 */
function getAngsuranHajiListData() {
  try {
    setupAngsuranHajiSheets();

    // 1. Ambil data master DataJamaahHaji
    const jamaahRes = getJamaahHajiListData();
    const masterJamaahList = jamaahRes.success ? (jamaahRes.data || []) : [];

    // 2. Ambil data transaksi EntryAngsuranHaji
    const sheetName = (CONFIG.SHEETS && CONFIG.SHEETS.ENTRY_ANGSURAN_HAJI) || 'EntryAngsuranHaji';
    const rawData = getSheetData(sheetName) || [];

    const data = rawData.map((row, idx) => {
      const rawJumlah = getRowValue(row, ['jumlah', 'nominal', 'total', 'debit', 'amount']);
      const parsedJumlah = parseSanitizedAmount(rawJumlah);
      const rawHp = getRowValue(row, ['nohp', 'no_hp', 'hp', 'telepon', 'phone', 'wa']);
      const rawKurs = getRowValue(row, ['nilaikurs', 'nilai_kurs', 'kurs']);
      const parsedKurs = (rawKurs !== undefined && rawKurs !== null && rawKurs !== '') ? (parseFloat(rawKurs) || 0) : 0;
      const bpihVal = getRowValue(row, ['nobpih', 'no_bpih', 'bpih', 'no bpih', 'no. bpih']);

      return {
        timestamp: String(getRowValue(row, ['timestamp', 'waktu', 'tglinput']) || ''),
        id: String(getRowValue(row, ['id', 'angsuranid', 'no']) || ('AH-' + (idx + 1).toString().padStart(4, '0'))),
        noJurnal: String(getRowValue(row, ['nojurnal', 'jurnal', 'no_jurnal', 'ref']) || '-'),
        idJamaah: String(getRowValue(row, ['idjamaah', 'id_jamaah', 'idnasabah', 'nik']) || '-'),
        noBpih: String(bpihVal || '-'),
        namaNasabah: String(getRowValue(row, ['namanasabah', 'nama_nasabah', 'nama', 'jamaah']) || '-'),
        bank: String(getRowValue(row, ['bank', 'namabank', 'rekening']) || 'Bank Syariah Indonesia (BSI)'),
        uraian: String(getRowValue(row, ['uraian', 'keterangan', 'deskripsi', 'note']) || '-'),
        jumlah: parsedJumlah,
        nilaiKurs: parsedKurs,
        user: String(getRowValue(row, ['user', 'petugas', 'operator', 'createdby']) || 'Admin'),
        tanggal: String(getRowValue(row, ['tanggal', 'tgl', 'tgltransaksi', 'date']) || ''),
        metodePembayaran: String(getRowValue(row, ['metodepembayaran', 'metode', 'pembayaran']) || 'Transfer'),
        status: String(getRowValue(row, ['status', 'statusangsuran']) || 'Pending'),
        createdAt: String(getRowValue(row, ['createdat']) || ''),
        typeHaji: String(getRowValue(row, ['typehaji', 'type_haji', 'jenishaji']) || 'Setoran Awal'),
        noHp: formatTextPhone(rawHp),
        linkDokumen: String(getRowValue(row, ['linkdokumen', 'link_dokumen', 'linkdok', 'link', 'dokumen', 'url', 'urldokumen']) || '')
      };
    });

    data.sort((a, b) => new Date(b.createdAt || b.timestamp || 0) - new Date(a.createdAt || a.timestamp || 0));

    const bpihJamaahMap = {};
    const namaJamaahMap = {};
    masterJamaahList.forEach(j => {
      if (j.noBpih && j.noBpih !== '-') bpihJamaahMap[String(j.noBpih).trim().toLowerCase()] = j;
      if (j.nama && j.nama !== '-') namaJamaahMap[String(j.nama).trim().toLowerCase()] = j;
    });

    const jamaahMap = {};
    masterJamaahList.forEach(j => {
      if (j.nama && j.nama !== '-') {
        const key = j.nama.trim().toLowerCase();
        jamaahMap[key] = {
          idJamaah: j.idJamaah || '-',
          nama: j.nama.trim(),
          noBpih: j.noBpih || '-',
          noHp: j.noHp || '-',
          typeHaji: j.jenisHaji || 'Setoran Awal',
          mahram: j.mahram || '-'
        };
      }
    });

    // 3. Ambil data Sheet Mahram
    const sheetMahramName = (CONFIG.SHEETS && CONFIG.SHEETS.MAHRAM) || 'Mahram';
    const rawMahramData = getSheetData(sheetMahramName) || [];
    
    // Group Mahram by KodeMahram
    // Key: KodeMahram, Value: Array of Nama
    const mahramGroupByKode = {};
    const namaToKodeMahram = {};

    rawMahramData.forEach(row => {
      const nama = String(getRowValue(row, ['nama', 'namajamaah', 'nama_jamaah', 'namanasabah']) || '').trim();
      const kode = String(getRowValue(row, ['kodemahram', 'kode_mahram', 'kode']) || '').trim();
      if (nama && kode) {
        const namaLower = nama.toLowerCase();
        namaToKodeMahram[namaLower] = kode;
        if (!mahramGroupByKode[kode]) mahramGroupByKode[kode] = [];
        // Avoid duplicate Nama in the same group just in case
        if (!mahramGroupByKode[kode].includes(nama)) {
          mahramGroupByKode[kode].push(nama);
        }
      }
    });

    data.forEach(d => {
      let m = null;
      if (d.noBpih && d.noBpih !== '-') m = bpihJamaahMap[String(d.noBpih).trim().toLowerCase()];
      if (!m && d.namaNasabah && d.namaNasabah !== '-') m = namaJamaahMap[String(d.namaNasabah).trim().toLowerCase()];
      
      let dNamaNasabah = String(d.namaNasabah).trim().toLowerCase();
      let dKodeMahram = namaToKodeMahram[dNamaNasabah];
      let displayMahram = '-';

      if (dKodeMahram && mahramGroupByKode[dKodeMahram]) {
        // Get all other Nama in this group
        const otherNamas = mahramGroupByKode[dKodeMahram].filter(n => n.toLowerCase() !== dNamaNasabah);
        if (otherNamas.length > 0) {
          displayMahram = otherNamas.join(', ');
        }
      }
      
      d.mahram = displayMahram;


      if (d.namaNasabah && d.namaNasabah !== '-' && d.namaNasabah.trim() !== '') {
        const key = d.namaNasabah.trim().toLowerCase();
        if (!jamaahMap[key]) {
          jamaahMap[key] = {
            idJamaah: d.idJamaah || '-',
            nama: d.namaNasabah.trim(),
            noBpih: d.noBpih || '-',
            noHp: d.noHp || '-',
            typeHaji: d.typeHaji || 'Setoran Awal',
            mahram: d.mahram || '-'
          };
        }
      }
    });

    const jamaahHajiOptions = Object.values(jamaahMap).sort((a, b) => a.nama.localeCompare(b.nama));

    return {
      success: true,
      data: data,
      jamaahHajiOptions: jamaahHajiOptions,
      masterJamaahList: masterJamaahList
    };
  } catch (e) {
    Logger.log('Error getAngsuranHajiListData: ' + e.message);
    return { success: false, message: 'Gagal memuat data angsuran haji: ' + e.message, data: [], jamaahHajiOptions: [], masterJamaahList: [] };
  }
}

/**
 * Menyimpan atau memperbarui data Angsuran Haji tunggal
 */
function saveAngsuranHajiData(formData, currentUser) {
  try {
    setupAngsuranHajiSheets();
    const sheetName = (CONFIG.SHEETS && CONFIG.SHEETS.ENTRY_ANGSURAN_HAJI) || 'EntryAngsuranHaji';
    const sheetJamaahName = (CONFIG.SHEETS && CONFIG.SHEETS.DATA_JAMAAH_HAJI) || 'DataJamaahHaji';

    if (!formData.namaNasabah || formData.namaNasabah.trim() === '') {
      return { success: false, message: 'Nama Nasabah / Jamaah wajib diisi!' };
    }

    const cleanNamaNasabah = formData.namaNasabah.trim();
    const noBpihVal = String(formData.noBpih || formData.noBPIH || formData['No. BPIH'] || formData['No BPIH'] || '-').trim();
    const timestamp = formData.timestamp || getJakartaTimeString();
    const operatorUser = (currentUser && currentUser.username) ? currentUser.username : (formData.user || 'Admin');
    const yr = new Date().getFullYear();

    // 1. CEK KETERSEDIAAN No. BPIH DI SHEET DataJamaahHaji
    const existingJamaahData = getSheetData(sheetJamaahName) || [];
    let matchedJamaah = null;

    if (noBpihVal && noBpihVal !== '-') {
      const searchBpihNorm = noBpihVal.toLowerCase().replace(/[^a-z0-9]/g, '');
      matchedJamaah = existingJamaahData.find(row => {
        const bVal = String(getRowValue(row, ['nobpih', 'no_bpih', 'bpih', 'no bpih', 'no. bpih']) || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        return bVal && bVal === searchBpihNorm;
      });
    }

    let targetIdJamaah = formData.idJamaah || formData.idNasabah || '';
    if (targetIdJamaah === '-' || !targetIdJamaah) {
      targetIdJamaah = '';
    }

    if (matchedJamaah) {
      // Jika No. BPIH ADA pada Sheet DataJamaahHaji, ABAIKAN penambahan ke DataJamaahHaji.
      // Ambil IDJamaah yang ada di DataJamaahHaji jika targetIdJamaah belum di-set
      const existingId = String(getRowValue(matchedJamaah, ['idjamaah', 'id_jamaah', 'id', 'nik']) || '').trim();
      if (existingId && existingId !== '-') {
        targetIdJamaah = existingId;
      }
    } else {
      // Jika No. BPIH TIDAK DITEMUKAN, tambahkan ke Sheet DataJamaahHaji & EntryAngsuranHaji
      if (!targetIdJamaah) {
        targetIdJamaah = 'JH-' + yr + '-' + (existingJamaahData.length + 1).toString().padStart(4, '0');
      }
      
      const typeHajiVal = formData.typeHaji || formData.jenisHaji || 'Setoran Awal';
      const autoBulanPendaftaran = (formData.bulanPendaftaran && formData.bulanPendaftaran !== '-')
        ? formData.bulanPendaftaran
        : generateBulanPendaftaran(typeHajiVal);

      const newJamaahRecord = {
        Timestamp: timestamp,
        IDJamaah: targetIdJamaah,
        Nama: cleanNamaNasabah,
        NoSPPH: formData.noSpph || '-',
        BulanPendaftaran: autoBulanPendaftaran,
        NoBPIH: noBpihVal,
        NoHP: formatPhoneForSheet(formData.noHp || formData.noHP),
        Mahram: formData.mahram || '-',
        JenisHaji: typeHajiVal,
        BankSetorAwal: formData.bank || 'Bank Syariah Indonesia (BSI)',
        CreatedAt: timestamp,
        UpdatedAt: timestamp
      };
      insertRow(sheetJamaahName, newJamaahRecord);
      // Di-disable karena sheet ini sifatnya hanya view
      // try { const vSheet = (CONFIG.SHEETS && CONFIG.SHEETS.VIEW_HAJJ_DATA) || 'ViewHajjData'; if (getDb() && getDb().getSheetByName(vSheet)) insertRow(vSheet, newJamaahRecord); } catch(eV) {}
    }

    // fallback targetIdJamaah jika masih kosong
    if (!targetIdJamaah) {
      targetIdJamaah = 'JH-' + yr + '-' + (existingJamaahData.length + 1).toString().padStart(4, '0');
    }

    const existingData = getSheetData(sheetName) || [];
    const id = formData.id || ('AH-' + yr + '-' + (existingData.length + 1).toString().padStart(4, '0'));
    const noJurnal = formData.noJurnal || ('JRN-' + yr + '-' + Math.floor(1000 + Math.random() * 9000));

    const parsedJumlah = parseSanitizedAmount(formData.jumlah);
    const parsedKurs = (formData.nilaiKurs !== undefined && formData.nilaiKurs !== null && formData.nilaiKurs !== '') ? (parseFloat(formData.nilaiKurs) || 0) : 0;

    const record = {
      Timestamp: timestamp,
      ID: id,
      NoJurnal: noJurnal,
      IDJamaah: targetIdJamaah,
      NoBPIH: noBpihVal,
      'No BPIH': noBpihVal,
      'No. BPIH': noBpihVal,
      NamaNasabah: cleanNamaNasabah,
      Bank: formData.bank || 'Bank Syariah Indonesia (BSI)',
      Uraian: formData.uraian || 'Angsuran Haji Terencana',
      Jumlah: parsedJumlah,
      NilaiKurs: parsedKurs,
      User: operatorUser,
      Tanggal: formData.tanggal || timestamp.substring(0, 10),
      MetodePembayaran: formData.metodePembayaran || 'Transfer',
      Status: formData.status || 'Pending',
      CreatedAt: getJakartaTimeString(),
      TypeHaji: formData.typeHaji || formData.jenisHaji || 'Setoran Awal',
      NoHP: formatPhoneForSheet(formData.noHp || formData.noHP),
      LinkDokumen: formData.linkDokumen || formData.link || '',
      NoJurnalErahajj: formData.noJurnalErahajj || ''
    };

    if (formData.id) {
      updateRowWhere(sheetName, 'ID', formData.id, record);
      logActivity(operatorUser, 'UPDATE_ANGSURAN_HAJI', 'Angsuran Haji', 'Memperbarui Angsuran ID: ' + id);
      return { success: true, message: 'Data angsuran ' + id + ' berhasil diperbarui!' };
    } else {
      insertRow(sheetName, record);
      logActivity(operatorUser, 'CREATE_ANGSURAN_HAJI', 'Angsuran Haji', 'Menambahkan Angsuran ID: ' + id + ' a.n ' + cleanNamaNasabah);
      return { success: true, message: 'Data angsuran untuk ' + cleanNamaNasabah + ' berhasil disimpan!' };
    }
  } catch (e) {
    return { success: false, message: 'Gagal menyimpan data angsuran haji: ' + e.message };
  }
}

/**
 * Menyimpan banyak data angsuran sekaligus (batch import hasil checklist file Excel)
 */
function saveBatchAngsuranHajiData(batchItems, currentUser) {
  try {
    setupAngsuranHajiSheets();
    const sheetName = (CONFIG.SHEETS && CONFIG.SHEETS.ENTRY_ANGSURAN_HAJI) || 'EntryAngsuranHaji';
    const sheetJamaahName = (CONFIG.SHEETS && CONFIG.SHEETS.DATA_JAMAAH_HAJI) || 'DataJamaahHaji';

    if (!Array.isArray(batchItems) || batchItems.length === 0) {
      return { success: false, message: 'Tidak ada data angsuran terpilih untuk disimpan!' };
    }

    const existingData = getSheetData(sheetName) || [];
    let existingJamaahData = getSheetData(sheetJamaahName) || [];
    let startCounter = existingData.length + 1;
    let startJamaahCounter = existingJamaahData.length + 1;
    const yr = new Date().getFullYear();
    const operatorUser = (currentUser && currentUser.username) ? currentUser.username : 'Admin';
    const timestamp = getJakartaTimeString();

    let savedCount = 0;
    batchItems.forEach((item, idx) => {
      if (!item) return;

      const namaNasabah = String(item.namaNasabah || item.assignedNamaNasabah || 'Nasabah-Umum').trim();
      const noBpihVal = String(item.noBpih || item.noBPIH || item['No. BPIH'] || item['No BPIH'] || '-').trim();
      const typeHaji = String(item.typeHaji || item.jenisHaji || 'Setoran Awal').trim();

      // Cek No. BPIH di DataJamaahHaji
      let matchedJamaah = null;
      if (noBpihVal && noBpihVal !== '-') {
        const searchBpihNorm = noBpihVal.toLowerCase().replace(/[^a-z0-9]/g, '');
        matchedJamaah = existingJamaahData.find(row => {
          const bVal = String(getRowValue(row, ['nobpih', 'no_bpih', 'bpih', 'no bpih', 'no. bpih']) || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
          return bVal && bVal === searchBpihNorm;
        });
      }

      let targetIdJamaah = item.idJamaah || item.idNasabah || '';
      if (targetIdJamaah === '-' || !targetIdJamaah) targetIdJamaah = '';

      if (matchedJamaah) {
        // Ada: abaikan penambahan ke DataJamaahHaji, gunakan IDJamaah yang ada
        const existingId = String(getRowValue(matchedJamaah, ['idjamaah', 'id_jamaah', 'id', 'nik']) || '').trim();
        if (existingId && existingId !== '-') {
          targetIdJamaah = existingId;
        }
      } else {
        // Tidak ditemukan: tambahkan ke DataJamaahHaji
        if (!targetIdJamaah) {
          targetIdJamaah = 'JH-' + yr + '-' + (startJamaahCounter++).toString().padStart(4, '0');
        }
        const autoBulanPendaftaran = (item.bulanPendaftaran && item.bulanPendaftaran !== '-')
          ? item.bulanPendaftaran
          : generateBulanPendaftaran(typeHaji);

        const newJamaahRecord = {
          Timestamp: timestamp,
          IDJamaah: targetIdJamaah,
          Nama: namaNasabah,
          NoSPPH: item.noSpph || '-',
          BulanPendaftaran: autoBulanPendaftaran,
          NoBPIH: noBpihVal,
          NoHP: formatPhoneForSheet(item.noHp || item.noHP || item.hp),
          Mahram: item.mahram || '-',
          JenisHaji: typeHaji,
          BankSetorAwal: item.bank || 'Bank Syariah Indonesia (BSI)',
          CreatedAt: timestamp,
          UpdatedAt: timestamp
        };
        insertRow(sheetJamaahName, newJamaahRecord);
        // Di-disable karena sheet ini sifatnya hanya view
        // try { const vSheet = (CONFIG.SHEETS && CONFIG.SHEETS.VIEW_HAJJ_DATA) || 'ViewHajjData'; if (getDb() && getDb().getSheetByName(vSheet)) insertRow(vSheet, newJamaahRecord); } catch(eV) {}
        existingJamaahData.push(newJamaahRecord);
      }

      if (!targetIdJamaah) {
        targetIdJamaah = 'JH-' + yr + '-' + (idx + 1).toString().padStart(4, '0');
      }

      const id = 'AH-' + yr + '-' + (startCounter + idx).toString().padStart(4, '0');
      const noJurnal = item.noJurnal || item.jurnal || ('JRN-' + yr + '-' + Math.floor(1000 + Math.random() * 9000));
      const parsedJumlah = parseSanitizedAmount(item.jumlah || item.nominal || item.total);
      const parsedKurs = (item.nilaiKurs !== undefined && item.nilaiKurs !== null && item.nilaiKurs !== '') ? (parseFloat(item.nilaiKurs) || 0) : 0;

      const record = {
        Timestamp: timestamp,
        ID: id,
        NoJurnal: noJurnal,
        IDJamaah: targetIdJamaah,
        NoBPIH: noBpihVal,
        'No BPIH': noBpihVal,
        'No. BPIH': noBpihVal,
        NamaNasabah: namaNasabah,
        Bank: item.bank || 'Bank Syariah Indonesia (BSI)',
        Uraian: item.uraian || item.keterangan || 'Import Angsuran Haji Excel',
        Jumlah: parsedJumlah,
        NilaiKurs: parsedKurs,
        User: operatorUser,
        Tanggal: item.tanggal || timestamp.substring(0, 10),
        MetodePembayaran: item.metodePembayaran || 'Transfer',
        Status: item.status || 'Pending',
        CreatedAt: timestamp,
        TypeHaji: typeHaji,
        NoHP: formatPhoneForSheet(item.noHp || item.noHP || item.hp),
        LinkDokumen: item.linkDokumen || item.link || '',
        NoJurnalErahajj: item.noJurnalErahajj || ''
      };

      insertRow(sheetName, record);
      savedCount++;
    });

    logActivity(operatorUser, 'BATCH_IMPORT_ANGSURAN_HAJI', 'Angsuran Haji', 'Mengimpor ' + savedCount + ' data angsuran dari Excel');

    return {
      success: true,
      message: savedCount + ' data angsuran haji berhasil dimasukkan ke database!'
    };
  } catch (e) {
    return { success: false, message: 'Gagal mengimpor data angsuran haji: ' + e.message };
  }
}

/**
 * Menghapus data transaksi Angsuran Haji
 */
function deleteAngsuranHajiData(id, currentUser) {
  try {
    setupAngsuranHajiSheets();
    const sheetName = (CONFIG.SHEETS && CONFIG.SHEETS.ENTRY_ANGSURAN_HAJI) || 'EntryAngsuranHaji';
    const operatorUser = (currentUser && currentUser.username) ? currentUser.username : 'Admin';

    const res = deleteRowWhere(sheetName, 'ID', id);
    if (res.success) {
      logActivity(operatorUser, 'DELETE_ANGSURAN_HAJI', 'Angsuran Haji', 'Menghapus Angsuran ID: ' + id);
    }
    return res;
  } catch (e) {
    return { success: false, message: 'Gagal menghapus data angsuran: ' + e.message };
  }
}

/**
 * Mengunggah berkas dokumen bukti angsuran haji dari berkas lokal ke Google Drive
 */
function uploadAngsuranDocFile(filePayload, currentUser) {
  try {
    if (!filePayload || !filePayload.fileBase64) {
      return { success: false, message: 'Data berkas lokal tidak ditemukan!' };
    }

    const folderIdTarget = '1lHO7hPfyj6-512vovUNfvVcLbLQhTWIv';
    let folder = null;
    try {
      folder = DriveApp.getFolderById(folderIdTarget);
    } catch (eF) {
      const root = DriveApp.getRootFolder();
      const folders = root.getFoldersByName('Bukti Angsuran Haji');
      if (folders.hasNext()) {
        folder = folders.next();
      } else {
        folder = root.createFolder('Bukti Angsuran Haji');
      }
    }

    const rawName = filePayload.fileName || 'Dokumen_Angsuran.pdf';
    const cleanBase64 = filePayload.fileBase64.includes(',') ? filePayload.fileBase64.split(',')[1] : filePayload.fileBase64;
    const bytes = Utilities.base64Decode(cleanBase64);
    const mimeType = filePayload.fileMimeType || 'application/octet-stream';
    const blob = Utilities.newBlob(bytes, mimeType, rawName);

    const driveFile = folder.createFile(blob);
    try {
      driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (eSharing) {}

    const fileUrl = driveFile.getUrl();

    return {
      success: true,
      message: 'Berkas "' + rawName + '" berhasil diunggah ke Drive!',
      fileUrl: fileUrl,
      fileId: driveFile.getId()
    };
  } catch (e) {
    return { success: false, message: 'Gagal mengunggah berkas: ' + e.message };
  }
}
