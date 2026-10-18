/**
 * ============================================================================
 * JAMAAH DATA MANAGER & REGISTRY HANDLER (JamaahManager.gs)
 * ============================================================================
 * Mengolah seluruh operasi CRUD database Google Sheets "Data Jamaah"
 * yang mendukung formulir pendaftaran jamaah Umrah lengkap, penempatan kamar,
 * dan penerbitan Surat Pendaftaran Pergi Umrah.
 */

const JAMAAH_CONFIG = {
  SHEET_NAME: 'Data Jamaah',
  HEADERS: [
    'ID Jamaah',
    'Timestamp',
    'Referensi',
    'Nama Lengkap',
    'Nama Ayah Kandung',
    'Tempat Lahir',
    'Tanggal Lahir',
    'Jenis Kelamin',
    'Alamat KTP',
    'Kelurahan/Desa',
    'Kecamatan',
    'Kabupaten/Kota',
    'Provinsi',
    'Kode Pos',
    'Nomor KTP',
    'Nomor Seluler',
    'Nomor Telepon Rumah',
    'Nomor Seluler Keluarga',
    'Email Address',
    'Pendidikan Terakhir',
    'Pekerjaan',
    'Nomor Passport',
    'Tempat Dikeluarkan Paspor',
    'Tanggal Dikeluarkan Paspor',
    'Tanggal Berakhir Paspor',
    'Jenis Paket Umrah',
    'Tanggal Keberangkatan',
    'Cara Pembayaran',
    'Ukuran Baju',
    'Kantor Cabang',
    'Upload KTP',
    'Upload Pasport',
    'Buku Nikah',
    'Surat Nikah',
    'Foto Jamaah',
    'Kartu Keluarga',
    'Upload Bukti Transfer',
    'Tanggal Daftar',
    'Tipe Kamar',
    'Harga Paket',
    'Potongan',
    'Voucher',
    'Jumlah Harus Dibayar',
    'Hotel Makkah',
    'No Kamar Makkah',
    'Hotel Madinah',
    'No Kamar Madinah',
    'Status Jamaah',
    'CreatedAt',
    'UpdatedAt',
    'User Input',
    'Status Pernikahan',
    'Titel',
    'NamaAgen', 'NoTelp', 'Faedah', 'Bank', 'NoRekening', 'TanggalKirim', 'NoJurnalEraHajj', 'Catatan'
  ]
};

/**
 * Menentukan Titel (TUAN / NYONYA / NONA) secara otomatis berdasarkan Jenis Kelamin & Status Pernikahan:
 * - Laki-laki & MENIKAH -> TUAN (Mr.)
 * - Perempuan & MENIKAH -> NYONYA (Mrs.)
 * - Perempuan & BELUM MENIKAH -> NONA (Miss)
 * - Laki-laki & BELUM MENIKAH / JANDA / DUDA -> TUAN
 * - Perempuan & JANDA / DUDA -> NYONYA
 */
function determineTitel(jenisKelamin, statusPernikahan) {
  const jk = String(jenisKelamin || '').trim().toLowerCase();
  const sp = String(statusPernikahan || '').trim().toUpperCase();
  if (!jk && !sp) return '';

  if (jk.includes('laki') || jk === 'pria' || jk === 'l') {
    return 'TUAN';
  } else if (jk.includes('perempuan') || jk === 'wanita' || jk === 'p') {
    if (sp === 'MENIKAH') return 'NYONYA';
    if (sp === 'BELUM MENIKAH') return 'NONA';
    if (sp.includes('JANDA') || sp.includes('DUDA')) return 'NYONYA';
    return '';
  }
  return '';
}

/**
 * Memastikan header 'Status Pernikahan' dan 'Titel' ada pada Sheet Data Jamaah tanpa merusak kolom yang ada
 */
function ensureJamaahSheetHeaders_(sheet) {
  try {
    const lastCol = Math.max(sheet.getLastColumn(), 1);
    const existingHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h || '').trim());
    const existingLower = existingHeaders.map(h => h.toLowerCase());

    const neededHeaders = ['Status Pernikahan', 'Titel'];
    let appendList = [];
    neededHeaders.forEach(nh => {
      const nhLower = nh.toLowerCase();
      const exists = existingLower.some(eh => eh === nhLower || (nhLower === 'titel' && eh === 'title') || (nhLower === 'status pernikahan' && (eh === 'status nikah' || eh === 'pernikahan')));
      if (!exists) {
        appendList.push(nh);
      }
    });

    if (appendList.length > 0) {
      const startCol = existingHeaders.length + 1;
      sheet.getRange(1, startCol, 1, appendList.length).setValues([appendList]);
      const newHeaderRange = sheet.getRange(1, startCol, 1, appendList.length);
      newHeaderRange.setBackground('#0f172a');
      newHeaderRange.setFontColor('#ffffff');
      newHeaderRange.setFontWeight('bold');
      Logger.log('ensureJamaahSheetHeaders_: Menambahkan header baru: ' + appendList.join(', '));
    }
  } catch (e) {
    Logger.log('Error ensureJamaahSheetHeaders_: ' + e.message);
  }
}

/**
 * Helper fleksibel untuk mengambil nilai kolom berdasarkan berbagai kemungkinan nama header
 */
function getRowVal(r, possibleKeys, defaultVal = '') {
  if (!r) return defaultVal;
  for (let i = 0; i < possibleKeys.length; i++) {
    const k = possibleKeys[i];
    if (r[k] !== undefined && r[k] !== null && String(r[k]).trim() !== '') {
      return String(r[k]).trim();
    }
  }
  // Soft matching: abaikan spasi & karakter khusus
  const rowKeys = Object.keys(r);
  for (let i = 0; i < possibleKeys.length; i++) {
    const cleanKey = String(possibleKeys[i]).toLowerCase().replace(/[^a-z0-9]/g, '');
    for (let j = 0; j < rowKeys.length; j++) {
      const cleanRowKey = String(rowKeys[j]).toLowerCase().replace(/[^a-z0-9]/g, '');
      if (cleanRowKey === cleanKey && r[rowKeys[j]] !== undefined && r[rowKeys[j]] !== null && String(r[rowKeys[j]]).trim() !== '') {
        return String(r[rowKeys[j]]).trim();
      }
    }
  }
  return defaultVal;
}

/**
 * Format string teks agar angka dengan 0 di depan (Nomor HP, Telepon, KTP/NIK, Kode Pos)
 * tetap tersimpan sebagai teks murni di Google Sheets tanpa kehilangan angka 0 di depan.
 */
function formatTextNumberVal(val) {
  if (val === null || val === undefined) return '';
  let str = String(val).trim();
  if (str === '') return '';
  if (str.startsWith('0') && !str.startsWith("'")) {
    return "'" + str;
  }
  return str;
}

function cleanTextNumberVal(val, isPhone = false) {
  if (val === null || val === undefined) return '';
  let str = String(val).trim();
  if (str.startsWith("'")) str = str.substring(1);
  if (isPhone && /^[1-9]\d{7,12}$/.test(str)) {
    str = '0' + str;
  }
  return str;
}

/**
 * Mengambil seluruh daftar Data Jamaah secara langsung dari Google Sheet
 */
function getJamaahList() {
  try {
    setupJamaahSheet();
    const rows = getSheetData(JAMAAH_CONFIG.SHEET_NAME);
    return rows.map((r, index) => ({
      rowIndex: index + 2,
      id: getRowVal(r, ['ID Jamaah', 'ID', 'No Registrasi'], 'JM-' + (index + 1)),
      timestamp: getRowVal(r, ['Timestamp', 'Waktu']),
      referensi: getRowVal(r, ['Refrensi', 'Referensi', 'Agent', 'Ustadz']),
      namaLengkap: getRowVal(r, ['Nama Lengkap', 'Nama', 'Nama Jemaah', 'Nama Jamaah']),
      namaAyah: getRowVal(r, ['Nama Ayah Kandung', 'Nama Ayah', 'Ayah Kandung']),
      tempatLahir: getRowVal(r, ['Tempat Lahir', 'Kota Lahir']),
      tanggalLahir: getRowVal(r, ['Tanggal Lahir', 'Tgl Lahir']),
      jenisKelamin: getRowVal(r, ['Jenis Kelamin', 'Gender', 'JK']),
      statusPernikahan: getRowVal(r, ['Status Pernikahan', 'Status Nikah', 'Pernikahan']),
      titel: getRowVal(r, ['Titel', 'Title']) || determineTitel(getRowVal(r, ['Jenis Kelamin', 'Gender', 'JK']), getRowVal(r, ['Status Pernikahan', 'Status Nikah', 'Pernikahan'])),
      alamatKtp: getRowVal(r, ['Alamat Sesuai KTP', 'Alamat KTP', 'Alamat']),
      kelurahan: getRowVal(r, ['Kelurahan/Desa', 'Kelurahan', 'Desa']),
      kecamatan: getRowVal(r, ['Kecamatan']),
      kabupaten: getRowVal(r, ['Kabupaten/Kota', 'Kabupaten', 'Kota']),
      provinsi: getRowVal(r, ['Provinsi']),
      kodePos: cleanTextNumberVal(getRowVal(r, ['Kode Pos', 'Kodepos'])),
      noKtp: cleanTextNumberVal(getRowVal(r, ['Nomor KTP', 'No KTP', 'NIK'])),
      noHp: cleanTextNumberVal(getRowVal(r, ['Nomor Seluler', 'No Seluler', 'No HP', 'Nomor WhatsApp', 'No WhatsApp']), true),
      noTelpRumah: cleanTextNumberVal(getRowVal(r, ['Nomor Telephon Rumah', 'Nomor Telepon Rumah', 'Telp Rumah']), true),
      noHpKeluarga: cleanTextNumberVal(getRowVal(r, ['Nomor Seluler Keluarga', 'No HP Keluarga', 'Kontak Darurat']), true),
      email: getRowVal(r, ['Email Address', 'Email', 'Alamat Email']),
      pendidikan: getRowVal(r, ['Pendidikan Terakhir', 'Pendidikan']),
      pekerjaan: getRowVal(r, ['Pekerjaan', 'Profesi']),
      noPassport: getRowVal(r, ['Nomor Passport', 'No Passport', 'Nomor Paspor', 'No Paspor']),
      tempatPaspor: getRowVal(r, ['Tempat Dikeluarkan Paspor', 'Tempat Dikeluarkan']),
      tglDikeluarkanPaspor: getRowVal(r, ['Tanggal Dikeluarkan Paspor', 'Tanggal Dikeluarkan']),
      tglExpiredPaspor: getRowVal(r, ['Tanggal Berakhir Paspor', 'Tanggal Berakhir']),
      jenisPaket: getRowVal(r, ['Jenis Paket Umrah', 'Jenis Paket', 'Paket Umrah', 'Paket']),
      rencanaKeberangkatan: getRowVal(r, ['Rencana Keberangkatan', 'Tanggal Keberangkatan', 'Tgl Keberangkatan']),
      actualKeberangkatan: getRowVal(r, ['Actual Keberangkatan', 'Actual Flaight', 'Actual Flight']),
      embarkasi: getRowVal(r, ['Embarkasi', 'Embarkasih']),
      tglKeberangkatan: getRowVal(r, ['Rencana Keberangkatan', 'Tanggal Keberangkatan', 'Tgl Keberangkatan']),
      caraPembayaran: getRowVal(r, ['Cara Pembayaran', 'Metode Pembayaran']),
      ukuranBaju: getRowVal(r, ['Ukuran Baju']),
      kantorCabang: getRowVal(r, ['Kantor Cabang Fath Indah Asal Jemaah', 'Kantor Cabang', 'Cabang']),
      uploadKtp: getRowVal(r, ['Upload KTP', 'KTP']),
      uploadPasport: getRowVal(r, ['Upload Pasport', 'Upload Paspor', 'Passport']),
      bukuNikah: getRowVal(r, ['Buku Nikal', 'Buku Nikah']),
      suratNikah: getRowVal(r, ['Surat Nikah']),
      fotoJamaah: getRowVal(r, ['Foto Jamaah', 'Foto Paspor', 'Foto']),
      kartuKeluarga: getRowVal(r, ['Kartu Keluarga', 'KK']),
      uploadBuktiTransfer: getRowVal(r, ['Upload Bukti Transfer', 'Bukti Transfer']),
      tglDaftar: getRowVal(r, ['Tanggal Daftar', 'Timestamp'], getJakartaTimeString()),
      tipeKamar: getRowVal(r, ['Tipe Kamar'], 'Quad'),
      hargaPaket: Number(getRowVal(r, ['Harga Paket', 'Harga', 'Harga Paket Umrah'], 0)) || 0,
      potongan: Number(getRowVal(r, ['Potongan', 'Diskon', 'Potongan Harga'], 0)) || 0,
      voucher: Number(getRowVal(r, ['Voucher'], 0)) || 0,
      jumlahHarusDibayar: Number(getRowVal(r, ['Jumlah Harus Dibayar', 'TotalHarga', 'Total Harga', 'Total Harus Dibayar', 'Jumlah Tagihan'], 0)) || 0,
      totalHarga: Number(getRowVal(r, ['TotalHarga', 'Total Harga', 'Jumlah Harus Dibayar', 'Total Harus Dibayar', 'Jumlah Tagihan'], 0)) || 0,
      hotelMakkah: getRowVal(r, ['Hotel Makkah']),
      noKamarMakkah: getRowVal(r, ['No Kamar Makkah', 'No. Kamar Makkah']),
      hotelMadinah: getRowVal(r, ['Hotel Madinah']),
      noKamarMadinah: getRowVal(r, ['No Kamar Madinah', 'No. Kamar Madinah']),
      namaAgen: getRowVal(r, ['NamaAgen', 'Nama Agen']),
      noTelpAgen: getRowVal(r, ['NoTelp', 'No Telp Agen']),
      faedah: Number(getRowVal(r, ['Faedah'], 0)) || 0,
      bankAgen: getRowVal(r, ['Bank', 'Bank Agen']),
      noRekeningAgen: getRowVal(r, ['NoRekening', 'No Rekening Agen']),
      tanggalKirim: getRowVal(r, ['TanggalKirim', 'Tanggal Kirim']),
      noJurnalErahajj: getRowVal(r, ['NoJurnalEraHajj', 'No Jurnal Erahajj']),
      catatanAgen: getRowVal(r, ['Catatan', 'Catatan Agen']),
      status: getRowVal(r, ['Status Jamaah', 'Status'], 'Terdaftar'),
      createdAt: getRowVal(r, ['CreatedAt']),
      updatedAt: getRowVal(r, ['UpdatedAt']),
      userInput: getRowVal(r, ['User Input'])
    }));
  } catch (e) {
    Logger.log('Error getJamaahList: ' + e.message);
    return [];
  }
}

/**
 * Mengambil daftar Jenis Paket Umrah dari sheet "DashProg" (GID 1483869261) / "DataPaket"
 * Memfilter header Type Paket, Actual Flight, dan Embarkasih
 */
function getPaketOptions() {
  try {
    let list = [];

    // Prioritas 1: Ambil data pivot dari DashProg (GID 1483869261)
    if (typeof getDashProgDataList === 'function') {
      const dashRes = getDashProgDataList();
      if (dashRes && dashRes.success && Array.isArray(dashRes.data) && dashRes.data.length > 0) {
        dashRes.data.forEach(r => {
          const typePaket = (r['typePaket'] || r['Type Paket'] || r['typepaket'] || r['Jenis Paket Umrah'] || r['Nama Paket'] || r['Program'] || '').toString().trim();
          const scheduleKeberangkatan = (r['scheduleKeberangkatan'] || r['Schedule Keberangkatan'] || r['Schedule'] || r['Tanggal Keberangkatan'] || '').toString().trim();
          const actualFlight = (r['actualFlight'] || r['Actual Flight'] || r['actualflight'] || r['Actual Flaight'] || scheduleKeberangkatan).toString().trim();
          const embarkasi = (r['embarkasi'] || r['Embarkasih'] || r['embarkasih'] || r['Embarkasi'] || '').toString().trim();
          const ket = (r['keterangan'] || r['Keterangan'] || r['Status'] || 'Open').toString().trim();

          if (typePaket && typePaket !== '-' && typePaket.toLowerCase() !== 'null' && typePaket.toLowerCase() !== 'undefined') {
            if (!list.some(x => x.typePaket === typePaket)) {
              list.push({
                typePaket: typePaket,
                namaPaket: typePaket,
                keterangan: ket || 'Open',
                actualFlight: actualFlight,
                scheduleKeberangkatan: scheduleKeberangkatan || actualFlight,
                tglKeberangkatan: scheduleKeberangkatan || actualFlight,
                embarkasi: embarkasi
              });
            }
          }
        });
      }
    }

    // Prioritas 2: Fallback ke DataPaket jika list masih kosong
    if (list.length === 0) {
      const rows = getSheetData('DataPaket') || [];
      rows.forEach(r => {
        const typePaket = getRowVal(r, ['Jenis Paket Umrah', 'Type Paket', 'Tipe Paket', 'Jenis Paket', 'Nama Paket'], '').trim();
        const keterangan = getRowVal(r, ['Keterangan', 'Status'], '').trim();
        const actualFlight = getRowVal(r, ['Actual Flaight', 'Actual Flight', 'Tanggal Keberangkatan', 'Rencana Keberangkatan'], '').trim();
        const embarkasi = getRowVal(r, ['Embarkasih', 'Embarkasi'], '').trim();

        if (typePaket !== '' && typePaket !== '-' && typePaket.toLowerCase() !== 'null' && (keterangan === '' || keterangan.toLowerCase() === 'open')) {
          if (!list.some(x => x.typePaket === typePaket)) {
            list.push({
              typePaket: typePaket,
              keterangan: keterangan || 'Open',
              actualFlight: actualFlight,
              tglKeberangkatan: actualFlight,
              embarkasi: embarkasi
            });
          }
        }
      });
    }

    return { success: true, data: list };
  } catch (e) {
    Logger.log('Error getPaketOptions: ' + e.message);
    return { success: false, message: e.message, data: [] };
  }
}

/**
 * Generate Auto ID Jamaah (Format: JM-YYYY-XXXX)
 */
function generateJamaahId() {
  try {
    const list = getJamaahList();
    const currentYear = new Date().getFullYear();
    const prefix = 'JM-' + currentYear + '-';
    let maxNum = 0;

    list.forEach(item => {
      if (item.id && item.id.startsWith(prefix)) {
        const numPart = parseInt(item.id.replace(prefix, ''), 10);
        if (!isNaN(numPart) && numPart > maxNum) {
          maxNum = numPart;
        }
      }
    });

    const nextNum = String(maxNum + 1).padStart(4, '0');
    return prefix + nextNum;
  } catch (e) {
    return 'JM-' + new Date().getFullYear() + '-0001';
  }
}

function setupJamaahSheet() {
  try {
    const ss = getDb();
    if (!ss) return null;
    let sheet = ss.getSheetByName(JAMAAH_CONFIG.SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(JAMAAH_CONFIG.SHEET_NAME);
      sheet.appendRow(JAMAAH_CONFIG.HEADERS);
      const headerRange = sheet.getRange(1, 1, 1, JAMAAH_CONFIG.HEADERS.length);
      headerRange.setBackground('#0f172a');
      headerRange.setFontColor('#ffffff');
      headerRange.setFontWeight('bold');
      sheet.setFrozenRows(1);
    } else {
      ensureJamaahSheetHeaders_(sheet);
    }

    // Auto-repair existing rows for Buku Nikah (Col 33) & Upload Bukti Transfer (Col 37)
    autoFixJamaahSheetColumns_();

    // Auto-seed sample data jika sheet masih kosong (getLastRow <= 1)
    if (sheet.getLastRow() <= 1) {
      const now = getJakartaTimeString();
      const defaultRows = [
        [
          'JM-2026-0001', now, 'Ustadz Mansur', 'H. Ahmad Subandi', 'H. Abdullah',
          'Jakarta', '1978-05-12', 'Laki-laki', 'Jl. Merdeka No. 12', 'Gambir',
          'Gambir', 'Jakarta Pusat', 'DKI Jakarta', '10110', '3171012345670001',
          '081299887766', '0215551234', '081288776655', 'ahmad@gmail.com', 'S1',
          'Wiraswasta', 'A1234567', 'Imigrasi Jakpus', '2022-01-10', '2032-01-10',
          'Paket VIP', '2026-10-15', 'Transfer Bank', 'XL', 'Cabang Jakarta',
          'https://drive.google.com/sample_ktp', 'https://drive.google.com/sample_paspor',
          'https://drive.google.com/sample_nikah', 'https://drive.google.com/sample_nikah', 'https://drive.google.com/sample_foto',
          'https://drive.google.com/sample_kk', 'https://drive.google.com/sample_tf',
          now, 'Quad', 35000000, 1000000, 500000, 33500000, 'Swissotel Makkah', '402', 'Pullman Zamzam', '305',
          'Lunas', now, now, 'Admin'
        ],
        [
          'JM-2026-0002', now, 'Kemitraan', 'Hj. Siti Fatimah', 'H. Rahmat',
          'Surabaya', '1985-08-20', 'Perempuan', 'Jl. Pemuda No. 45', 'Gubeng',
          'Gubeng', 'Surabaya', 'Jawa Timur', '60281', '3578012345670002',
          '081311223344', '', '081399887766', 'siti.fatimah@gmail.com', 'S1',
          'PNS', 'B9876543', 'Imigrasi Surabaya', '2023-03-15', '2033-03-15',
          'Paket Reguler', '2026-11-20', 'Tunai', 'L', 'Cabang Surabaya',
          'https://drive.google.com/sample_ktp2', 'https://drive.google.com/sample_paspor2',
          '', '', 'https://drive.google.com/sample_foto2',
          'https://drive.google.com/sample_kk2', 'https://drive.google.com/sample_tf2',
          now, 'Double', 30000000, 0, 0, 30000000, 'Movenpick Makkah', '512', 'Anwar Movenpick', '408',
          'DP Paid', now, now, 'Admin'
        ]
      ];
      sheet.getRange(2, 1, defaultRows.length, JAMAAH_CONFIG.HEADERS.length).setValues(defaultRows);
    }
    return sheet;
  } catch (e) {
    Logger.log('Error setupJamaahSheet: ' + e.message);
    return null;
  }
}

/**
 * Perbaikan otomatis untuk baris-baris terdaftar di sheet Data Jamaah:
 * 1. Mengopi link dari Surat Nikah (Col 34) ke Buku Nikah (Col 33) bila kosong.
 * 2. Mengambil link Upload Bukti Transfer dari kolom legacy 47 (bila ada) ke Kolom 37 (Col AK).
 */
function autoFixJamaahSheetColumns_() {
  try {
    const ss = getDb();
    if (!ss) return;
    const sheet = ss.getSheetByName(JAMAAH_CONFIG.SHEET_NAME);
    if (!sheet) return;
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return;

    const maxCols = Math.max(sheet.getLastColumn(), 52);
    const range = sheet.getRange(1, 1, lastRow, maxCols);
    const values = range.getValues();
    const headers = values[0].map(h => String(h).trim().toLowerCase());

    let idxBukuNikah = headers.findIndex(h => h.includes('buku nikah') || h.includes('buku nikal'));
    let idxSuratNikah = headers.findIndex(h => h.includes('surat nikah'));
    let idxBuktiTf = headers.findIndex(h => h.includes('upload bukti transfer') || h.includes('bukti transfer') || h.includes('bukti tf'));
    let idxGender = headers.findIndex(h => h.includes('kelamin') || h === 'gender' || h === 'jk');
    let idxStatusNikah = headers.findIndex(h => h.includes('status pernikahan') || h.includes('status nikah') || h === 'pernikahan');
    let idxTitel = headers.findIndex(h => h === 'titel' || h.includes('titel') || h === 'title');

    if (idxBukuNikah === -1) idxBukuNikah = 32; // col 33
    if (idxSuratNikah === -1) idxSuratNikah = 33; // col 34
    if (idxBuktiTf === -1) idxBuktiTf = 36; // col 37

    let modified = false;

    for (let r = 1; r < values.length; r++) {
      const row = values[r];
      const bukuVal = String(row[idxBukuNikah] || '').trim();
      const suratVal = String(row[idxSuratNikah] || '').trim();
      const buktiVal = String(row[idxBuktiTf] || '').trim();
      const legacyCol47Val = row.length >= 47 ? String(row[46] || '').trim() : '';

      // Fix Buku Nikah / Surat Nikah mirror
      if (!bukuVal && suratVal) {
        row[idxBukuNikah] = suratVal;
        modified = true;
      } else if (!suratVal && bukuVal) {
        row[idxSuratNikah] = bukuVal;
        modified = true;
      }

      // Fix Upload Bukti Transfer from legacy col 47
      if (!buktiVal && legacyCol47Val && (legacyCol47Val.startsWith('http://') || legacyCol47Val.startsWith('https://'))) {
        row[idxBuktiTf] = legacyCol47Val;
        modified = true;
      }

      // Auto-populate Titel bila kosong
      if (idxTitel !== -1 && idxGender !== -1) {
        const curTitel = String(row[idxTitel] || '').trim();
        const curGender = String(row[idxGender] || '').trim();
        const curStatusNikah = idxStatusNikah !== -1 ? String(row[idxStatusNikah] || '').trim() : '';
        if (!curTitel && (curGender || curStatusNikah)) {
          const autoTitel = determineTitel(curGender, curStatusNikah);
          if (autoTitel) {
            row[idxTitel] = autoTitel;
            modified = true;
          }
        }
      }
    }

    if (modified) {
      range.setValues(values);
      Logger.log('autoFixJamaahSheetColumns_: Berhasil menyelaraskan kolom Buku Nikah & Upload Bukti Transfer pada sheet Data Jamaah.');
    }
  } catch (err) {
    Logger.log('Warning autoFixJamaahSheetColumns_: ' + err.message);
  }
}

/**
 * Menyimpan / Memperbarui Data Jamaah
 */
function saveJamaah(data, userActive = 'Admin') {
  try {
    setupJamaahSheet();
    const sheet = getDb().getSheetByName(JAMAAH_CONFIG.SHEET_NAME);
    if (!sheet) return { success: false, message: 'Sheet Data Jamaah tidak ditemukan.' };

    const currentTime = getJakartaTimeString();
    const isEdit = data.id && String(data.id).trim() !== '';
    const jamaahId = isEdit ? data.id : generateJamaahId();

    /* Process Seksi 8 uploaded files if present */
    if (data.formDocFiles && typeof data.formDocFiles === 'object') {
      const uploadedUrls = processFormDocFilesUpload_(jamaahId, data.namaLengkap || 'Jamaah', data.formDocFiles, userActive);
      if (uploadedUrls.uploadKtp) data.uploadKtp = uploadedUrls.uploadKtp;
      if (uploadedUrls.uploadPasport) data.uploadPasport = uploadedUrls.uploadPasport;
      if (uploadedUrls.bukuNikah) data.bukuNikah = uploadedUrls.bukuNikah;
      if (uploadedUrls.suratNikah) data.suratNikah = uploadedUrls.suratNikah;
      if (uploadedUrls.fotoJamaah) data.fotoJamaah = uploadedUrls.fotoJamaah;
      if (uploadedUrls.kartuKeluarga) data.kartuKeluarga = uploadedUrls.kartuKeluarga;
      if (uploadedUrls.uploadBuktiTransfer) data.uploadBuktiTransfer = uploadedUrls.uploadBuktiTransfer;
    }

    // Normalize property aliases for document links
    data.uploadKtp = data.uploadKtp || data.ktp || '';
    data.uploadPasport = data.uploadPasport || data.pasport || data.uploadPaspor || '';
    data.suratNikah = data.suratNikah || data.bukuNikah || '';
    data.bukuNikah = data.bukuNikah || data.suratNikah || '';
    data.fotoJamaah = data.fotoJamaah || data.foto || '';
    data.kartuKeluarga = data.kartuKeluarga || data.kk || '';
    data.uploadBuktiTransfer = data.uploadBuktiTransfer || data.buktiTransfer || '';

    const lastCol = Math.max(sheet.getLastColumn(), JAMAAH_CONFIG.HEADERS.length);
    const headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    const headerLower = headerRow.map(h => String(h).trim().toLowerCase());
    const rowData = new Array(headerRow.length).fill('');

    // Dynamic Header Index Finder for Documents
    let idxKtp = headerLower.findIndex(h => h.includes('upload ktp') || h === 'ktp');
    let idxPasport = headerLower.findIndex(h => h.includes('upload pasport') || h.includes('upload paspor') || h === 'pasport' || h === 'paspor');
    let idxBukuNikah = headerLower.findIndex(h => h.includes('buku nikah') || h.includes('buku nikal'));
    let idxSuratNikah = headerLower.findIndex(h => h.includes('surat nikah'));
    let idxFoto = headerLower.findIndex(h => h.includes('foto jamaah') || h === 'foto');
    let idxKK = headerLower.findIndex(h => h.includes('kartu keluarga') || h === 'kk');
    let idxBuktiTf = headerLower.findIndex(h => h.includes('upload bukti transfer') || h.includes('bukti transfer') || h.includes('bukti tf'));

    if (idxKtp === -1) idxKtp = 30;
    if (idxPasport === -1) idxPasport = 31;
    if (idxBukuNikah === -1) idxBukuNikah = 32;
    if (idxSuratNikah === -1) idxSuratNikah = 33;
    if (idxFoto === -1) idxFoto = 34;
    if (idxKK === -1) idxKK = 35;
    if (idxBuktiTf === -1) idxBuktiTf = 36;

    function getValByHeader(hName) {
      const h = String(hName).trim().toLowerCase();

      // Priority 1: Document URLs (exact & fuzzy matching)
      if (h.includes('upload ktp') || h === 'ktp') return data.uploadKtp || '';
      if (h.includes('upload pasport') || h.includes('upload paspor') || h === 'pasport' || h === 'paspor') return data.uploadPasport || '';
      if (h.includes('buku nikah') || h.includes('buku nikal')) return data.bukuNikah || data.suratNikah || '';
      if (h.includes('surat nikah')) return data.suratNikah || data.bukuNikah || '';
      if (h.includes('foto jamaah') || h === 'foto') return data.fotoJamaah || '';
      if (h.includes('kartu keluarga') || h === 'kk') return data.kartuKeluarga || '';
      if (h.includes('upload bukti transfer') || h.includes('bukti transfer') || h.includes('bukti tf')) return data.uploadBuktiTransfer || '';

      if (h.includes('id jamaah') || h === 'id') return jamaahId;
      if (h.includes('timestamp')) return data.timestamp || currentTime;
      if (h.includes('referensi') || h.includes('refrensi')) return data.referensi || '';
      if (h.includes('nama lengkap') || h === 'nama') return data.namaLengkap || '';
      if (h.includes('ayah')) return data.namaAyah || '';
      if (h.includes('tempat lahir')) return data.tempatLahir || '';
      if (h.includes('tanggal lahir') || h.includes('tgl lahir')) return data.tanggalLahir || '';
      if (h.includes('kelamin') || h === 'gender' || h === 'jk') return data.jenisKelamin || '';
      if (h.includes('status pernikahan') || h.includes('status nikah') || h === 'pernikahan') return data.statusPernikahan || '';
      if (h === 'titel' || h.includes('titel') || h === 'title') return data.titel || determineTitel(data.jenisKelamin, data.statusPernikahan);
      if (h.includes('alamat')) return data.alamatKtp || '';
      if (h.includes('kelurahan') || h.includes('desa')) return data.kelurahan || '';
      if (h.includes('kecamatan')) return data.kecamatan || '';
      if (h.includes('kabupaten') || h.includes('kota')) return data.kabupaten || '';
      if (h.includes('provinsi')) return data.provinsi || '';
      if (h.includes('kode pos') || h.includes('kodepos')) return formatTextNumberVal(data.kodePos);
      if (h.includes('nomor ktp') || h.includes('no ktp') || h.includes('nik')) return formatTextNumberVal(data.noKtp);
      if (h.includes('seluler') || h.includes('no hp')) return formatTextNumberVal(data.noHp);
      if (h.includes('telepon rumah') || h.includes('telp rumah')) return formatTextNumberVal(data.noTelpRumah);
      if (h.includes('seluler keluarga') || h.includes('kontak darurat')) return formatTextNumberVal(data.noHpKeluarga);
      if (h.includes('email')) return data.email || '';
      if (h.includes('pendidikan')) return data.pendidikan || '';
      if (h.includes('pekerjaan')) return data.pekerjaan || '';
      if (h.includes('passport') || h.includes('paspor')) {
        if (h.includes('tempat')) return data.tempatPaspor || '';
        if (h.includes('dikeluarkan')) return data.tglDikeluarkanPaspor || '';
        if (h.includes('berakhir') || h.includes('expired')) return data.tglExpiredPaspor || '';
        if (!h.includes('upload')) return data.noPassport || '';
      }
      if (h.includes('paket')) {
        if (h.includes('harga')) return Number(data.hargaPaket) || 0;
        return data.jenisPaket || '';
      }
      if (h.includes('keberangkatan')) return data.tglKeberangkatan || data.rencanaKeberangkatan || '';
      if (h.includes('cara pembayaran')) return data.caraPembayaran || '';
      if (h.includes('ukuran baju')) return data.ukuranBaju || '';
      if (h.includes('kantor cabang') || h.includes('cabang')) return data.kantorCabang || '';
      
      if (h.includes('tanggal daftar') || h.includes('tgl daftar')) return data.tglDaftar || currentTime;
      if (h.includes('tipe kamar')) return data.tipeKamar || 'Quad';
      if (h.includes('potongan') || h.includes('diskon')) return Number(data.potongan) || 0;
      if (h.includes('voucher')) return Number(data.voucher) || 0;
      if (h.includes('jumlah harus dibayar') || h.includes('totalharga')) return (Number(data.hargaPaket) || 0) - (Number(data.potongan) || 0) - (Number(data.voucher) || 0);
      if (h.includes('makkah')) {
        if (h.includes('kamar')) return data.noKamarMakkah || '';
        return data.hotelMakkah || '';
      }
      if (h.includes('madinah')) {
        if (h.includes('kamar')) return data.noKamarMadinah || '';
        return data.hotelMadinah || '';
      }
      if (h === 'namaagen') return data.namaAgen || '';
      if (h === 'notelp') return data.noTelpAgen || '';
      if (h === 'faedah') return Number(String(data.faedah || '').replace(/[^0-9]/g, '')) || 0;
      if (h === 'bank') return data.bankAgen || '';
      if (h === 'norekening') return data.noRekeningAgen || '';
      if (h === 'tanggalkirim') return data.tanggalKirim || '';
      if (h === 'nojurnalerahajj') return data.noJurnalErahajj || '';
      if (h === 'catatan') return data.catatanAgen || '';
      if (h.includes('status')) return data.status || 'Terdaftar';
      if (h.includes('createdat')) return isEdit ? (data.createdAt || currentTime) : currentTime;
      if (h.includes('updatedat')) return currentTime;
      if (h.includes('user input') || h.includes('user')) return userActive;
      return '';
    }

    for (let i = 0; i < headerRow.length; i++) {
      rowData[i] = getValByHeader(headerRow[i]);
    }

    // Dynamic Positional Assignment for Document URLs
    if (data.uploadKtp) rowData[idxKtp] = data.uploadKtp;
    if (data.uploadPasport) rowData[idxPasport] = data.uploadPasport;
    if (data.bukuNikah || data.suratNikah) rowData[idxBukuNikah] = data.bukuNikah || data.suratNikah;
    if (data.suratNikah || data.bukuNikah) rowData[idxSuratNikah] = data.suratNikah || data.bukuNikah;
    if (data.fotoJamaah) rowData[idxFoto] = data.fotoJamaah;
    if (data.kartuKeluarga) rowData[idxKK] = data.kartuKeluarga;
    if (data.uploadBuktiTransfer) rowData[idxBuktiTf] = data.uploadBuktiTransfer;

    if (isEdit) {
      const allRows = sheet.getDataRange().getValues();
      let targetRowIndex = -1;
      let existingRow = null;
      for (let i = 1; i < allRows.length; i++) {
        if (String(allRows[i][0]).trim() === String(jamaahId).trim()) {
          targetRowIndex = i + 1;
          existingRow = allRows[i];
          break;
        }
      }

      if (targetRowIndex !== -1) {
        // Retain existing document URLs if not explicitly overridden
        if (existingRow) {
          const docIndices = [idxKtp, idxPasport, idxBukuNikah, idxSuratNikah, idxFoto, idxKK, idxBuktiTf];
          for (let idx of docIndices) {
            if (!rowData[idx] && existingRow[idx]) {
              rowData[idx] = existingRow[idx];
            }
          }
        }
        sheet.getRange(targetRowIndex, 1, 1, rowData.length).setValues([rowData]);
        logActivity(userActive, 'UPDATE_JAMAAH', 'Memperbarui data jamaah ID: ' + jamaahId + ' (' + data.namaLengkap + ')');
        return { success: true, message: 'Data Jamaah berhasil diperbarui!', id: jamaahId };
      }
    }

    // Append New Record
    sheet.appendRow(rowData);
    logActivity(userActive, 'CREATE_JAMAAH', 'Menambahkan jamaah baru ID: ' + jamaahId + ' (' + data.namaLengkap + ')');
    return { success: true, message: 'Data Jamaah berhasil ditambahkan!', id: jamaahId };

  } catch (e) {
    Logger.log('Error saveJamaah: ' + e.message);
    return { success: false, message: 'Gagal menyimpan data: ' + e.message };
  }
}

/**
 * Format Tanggal Sistem Indonesia di tingkat server (dd mmmm yyyy hh:mm:ss)
 */
function formatSystemDateIndoServer_(date = new Date()) {
  try {
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const dateStr = Utilities.formatDate(date, 'Asia/Jakarta', "yyyy-MM-dd HH:mm:ss");
    const parts = dateStr.split(' ');
    const dParts = parts[0].split('-');
    const y = dParts[0];
    const m = months[parseInt(dParts[1], 10) - 1];
    const d = dParts[2];
    return `${d} ${m} ${y} ${parts[1]}`;
  } catch (e) {
    return typeof getJakartaTimeString === 'function' ? getJakartaTimeString(date) : new Date().toISOString();
  }
}

/**
 * Update Penempatan Kamar Jamaah (Quick Room Assignment)
 */
function updateJamaahRoomAssignment(jamaahId, roomData, userActive = 'Admin') {
  try {
    setupJamaahSheet();
    const sheet = getDb().getSheetByName(JAMAAH_CONFIG.SHEET_NAME);
    if (!sheet) return { success: false, message: 'Sheet tidak ditemukan.' };

    const allRows = sheet.getDataRange().getValues();
    let targetRowIndex = -1;
    for (let i = 1; i < allRows.length; i++) {
      if (String(allRows[i][0]).trim() === String(jamaahId).trim()) {
        targetRowIndex = i + 1;
        break;
      }
    }

    if (targetRowIndex === -1) {
      return { success: false, message: 'Jamaah ID tidak ditemukan.' };
    }

    // Deteksi posisi indeks kolom header secara dinamis dari baris 1
    const headers = allRows[0].map(h => String(h).trim().toLowerCase());
    const getColIndex = (nameList, fallback) => {
      for (let name of nameList) {
        const idx = headers.indexOf(name.toLowerCase());
        if (idx !== -1) return idx + 1;
      }
      return fallback;
    };

    const colTipeKamar = getColIndex(['Tipe Kamar'], 39);
    const colHotelMakkah = getColIndex(['Hotel Makkah'], 44);
    const colNoKamarMakkah = getColIndex(['No Kamar Makkah', 'No. Kamar Makkah'], 45);
    const colHotelMadinah = getColIndex(['Hotel Madinah'], 46);
    const colNoKamarMadinah = getColIndex(['No Kamar Madinah', 'No. Kamar Madinah'], 47);
    const colUpdatedAt = getColIndex(['UpdatedAt', 'Updated At'], 50);

    const currentTime = formatSystemDateIndoServer_();
    sheet.getRange(targetRowIndex, colTipeKamar).setValue(roomData.tipeKamar || 'Quad');
    sheet.getRange(targetRowIndex, colHotelMakkah).setValue(roomData.hotelMakkah || '');
    sheet.getRange(targetRowIndex, colNoKamarMakkah).setValue(roomData.noKamarMakkah || '');
    sheet.getRange(targetRowIndex, colHotelMadinah).setValue(roomData.hotelMadinah || '');
    sheet.getRange(targetRowIndex, colNoKamarMadinah).setValue(roomData.noKamarMadinah || '');
    sheet.getRange(targetRowIndex, colUpdatedAt).setValue(currentTime);

    logActivity(userActive, 'ASSIGN_ROOM_JAMAAH', 'Penempatan kamar jamaah ID: ' + jamaahId);
    return { success: true, message: 'Penempatan kamar berhasil diperbarui!' };
  } catch (e) {
    return { success: false, message: 'Error update room assignment: ' + e.message };
  }
}

/**
 * Menghapus Data Jamaah
 */
function deleteJamaah(jamaahId, userActive = 'Admin') {
  try {
    setupJamaahSheet();
    const sheet = getDb().getSheetByName(JAMAAH_CONFIG.SHEET_NAME);
    if (!sheet) return { success: false, message: 'Sheet Data Jamaah tidak ditemukan.' };

    const allRows = sheet.getDataRange().getValues();
    for (let i = 1; i < allRows.length; i++) {
      if (String(allRows[i][0]).trim() === String(jamaahId).trim()) {
        const nama = allRows[i][3] || '';
        sheet.deleteRow(i + 1);
        logActivity(userActive, 'DELETE_JAMAAH', 'Menghapus data jamaah ID: ' + jamaahId + ' (' + nama + ')');
        return { success: true, message: 'Data Jamaah berhasil dihapus.' };
      }
    }
    return { success: false, message: 'Data Jamaah tidak ditemukan.' };
  } catch (e) {
    return { success: false, message: 'Gagal menghapus: ' + e.message };
  }
}

/* ============================================================================
 * PAYMENT & HISTORY MANAGEMENT FUNCTIONS
 * ============================================================================ */

const PAYMENT_CONFIG = {
  SHEET_NAME: 'History Pembayaran',
  HEADERS: [
    'ID Kwitansi',
    'Timestamp',
    'ID Jamaah',
    'Nama Jamaah',
    'Nomor KTP',
    'Jenis Paket',
    'Jumlah Pembayaran',
    'Tipe Pembayaran',
    'Metode Pembayaran',
    'Nama Bank',
    'Nomor Referensi',
    'Keterangan',
    'Tanggal Bayar',
    'User Input',
    'Status',
    'Upload Bukti Transfer'
  ]
};

/**
 * Inisialisasi Sheet "History Pembayaran"
 */
function setupPaymentSheet() {
  try {
    const ss = getDb();
    if (!ss) return null;
    let sheet = ss.getSheetByName(PAYMENT_CONFIG.SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(PAYMENT_CONFIG.SHEET_NAME);
      sheet.appendRow(PAYMENT_CONFIG.HEADERS);
      const headerRange = sheet.getRange(1, 1, 1, PAYMENT_CONFIG.HEADERS.length);
      headerRange.setBackground('#0f172a');
      headerRange.setFontColor('#ffffff');
      headerRange.setFontWeight('bold');
      sheet.setFrozenRows(1);
    }
    return sheet;
  } catch (e) {
    Logger.log('Error setupPaymentSheet: ' + e.message);
    return null;
  }
}

/**
 * Generate Auto ID Kwitansi (Format: KWT-YYYY-XXXX)
 */
function generateKwitansiId() {
  try {
    setupPaymentSheet();
    const rows = getSheetData(PAYMENT_CONFIG.SHEET_NAME);
    const currentYear = new Date().getFullYear();
    const prefix = 'KWT-' + currentYear + '-';
    let maxNum = 0;

    rows.forEach(r => {
      const kwtId = String(r['ID Kwitansi'] || r['Kwitansi'] || '');
      if (kwtId.startsWith(prefix)) {
        const numPart = parseInt(kwtId.replace(prefix, ''), 10);
        if (!isNaN(numPart) && numPart > maxNum) {
          maxNum = numPart;
        }
      }
    });

    const nextNum = String(maxNum + 1).padStart(4, '0');
    return prefix + nextNum;
  } catch (e) {
    return 'KWT-' + new Date().getFullYear() + '-0001';
  }
}

/**
 * Mengambil Riwayat Pembayaran Seluruh Jamaah atau spesifik Jamaah
 */
function getPaymentHistory(jamaahId = null) {
  try {
    setupPaymentSheet();
    const rows = getSheetData(PAYMENT_CONFIG.SHEET_NAME);
    const list = rows.map((r, index) => ({
      rowIndex: index + 2,
      idKwitansi: getRowVal(r, ['ID Kwitansi', 'No Kwitansi', 'Kwitansi'], 'KWT-' + (index + 1)),
      timestamp: getRowVal(r, ['Timestamp', 'Waktu']),
      idJamaah: getRowVal(r, ['ID Jamaah', 'ID']),
      namaJamaah: getRowVal(r, ['Nama Jamaah', 'Nama']),
      noKtp: getRowVal(r, ['Nomor KTP', 'NIK']),
      jenisPaket: getRowVal(r, ['Jenis Paket', 'Paket']),
      jumlahPembayaran: Number(getRowVal(r, ['Jumlah Pembayaran', 'Nominal', 'Jumlah'], '0')),
      tipePembayaran: getRowVal(r, ['Tipe Pembayaran', 'Tipe']),
      metodePembayaran: getRowVal(r, ['Metode Pembayaran', 'Metode']),
      namaBank: getRowVal(r, ['Nama Bank', 'Bank']),
      noReferensi: getRowVal(r, ['Nomor Referensi', 'No Ref', 'Bukti']),
      keterangan: getRowVal(r, ['Keterangan', 'Catatan']),
      tglBayar: getRowVal(r, ['Tanggal Bayar', 'Tgl Bayar']),
      userInput: getRowVal(r, ['User Input']),
      status: getRowVal(r, ['Status'], 'Verified'),
      uploadBuktiTransfer: getRowVal(r, ['Upload Bukti Transfer', 'Link Bukti Transfer', 'Bukti Transfer', 'Link Bukti'])
    }));

    if (jamaahId) {
      return list.filter(item => String(item.idJamaah).trim().toLowerCase() === String(jamaahId).trim().toLowerCase());
    }
    return list;
  } catch (e) {
    Logger.log('Error getPaymentHistory: ' + e.message);
    return [];
  }
}

/**
 * Menyimpan Transaksi Pembayaran Jamaah
 */
function saveJamaahPayment(paymentData, userActive = 'Admin') {
  try {
    setupPaymentSheet();
    const sheet = getDb().getSheetByName(PAYMENT_CONFIG.SHEET_NAME);
    if (!sheet) return { success: false, message: 'Sheet History Pembayaran tidak ditemukan.' };

    const kwtId = generateKwitansiId();
    const now = getJakartaTimeString();
    const nominal = Number(paymentData.jumlahPembayaran || 0);

    if (!paymentData.idJamaah || nominal <= 0) {
      return { success: false, message: 'Pilih Jamaah dan masukkan nominal pembayaran yang valid.' };
    }

    /* Unggah Berkas Bukti Transfer dari Drive Lokal jika disertakan base64 file */
    const fileBase64Raw = paymentData.fileBase64 || paymentData.uploadBuktiTransferBase64 || '';
    const rawFileName = paymentData.fileName || paymentData.uploadBuktiTransferFileName || '';

    if (fileBase64Raw && rawFileName) {
      try {
        let fileExt = '';
        const lastDotIdx = rawFileName.lastIndexOf('.');
        if (lastDotIdx !== -1) {
          fileExt = rawFileName.substring(lastDotIdx);
        }
        
        /* Format penamaan file di Drive: "ID Kwitansi - Nama Jamaah.ext" */
        const formattedFileName = kwtId + ' - ' + (paymentData.namaJamaah || 'Jamaah') + fileExt;

        /* Target Google Drive Folder ID: 1lHO7hPfyj6-512vovUNfvVcLbLQhTWIv */
        const folderIdTarget = '1lHO7hPfyj6-512vovUNfvVcLbLQhTWIv';
        let folder = null;
        try {
          folder = DriveApp.getFolderById(folderIdTarget);
        } catch (eF) {
          Logger.log('Gagal getFolderById ' + folderIdTarget + ': ' + eF.toString());
          if (typeof getTargetJamaahUploadFolder_ === 'function') {
            folder = getTargetJamaahUploadFolder_('Bukti Transfer');
          }
        }

        if (folder) {
          const cleanBase64 = fileBase64Raw.includes(',') ? fileBase64Raw.split(',')[1] : fileBase64Raw;
          const bytes = Utilities.base64Decode(cleanBase64);
          const mimeType = paymentData.fileMimeType || paymentData.uploadBuktiTransferMimeType || 'application/octet-stream';
          const blob = Utilities.newBlob(bytes, mimeType, formattedFileName);
          
          const driveFile = folder.createFile(blob);
          try {
            driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
          } catch (eSharing) {}
          
          const uploadedUrl = driveFile.getUrl();
          paymentData.uploadBuktiTransfer = uploadedUrl;

          /* Catat juga ke Sheet UploadDokJamaah jika helper getUploadDokJamaahSheet tersedia */
          try {
            if (typeof getUploadDokJamaahSheet === 'function') {
              const uSheet = getUploadDokJamaahSheet();
              if (uSheet) {
                const uLastRow = uSheet.getLastRow();
                const docId = 'DOCJ-' + String(uLastRow > 0 ? uLastRow : 1).padStart(4, '0') + '-' + Math.floor(100 + Math.random() * 900);
                const uRow = [
                  docId,
                  now,
                  paymentData.idJamaah || '',
                  paymentData.namaJamaah || '',
                  'Bukti Transfer',
                  formattedFileName,
                  uploadedUrl,
                  driveFile.getId(),
                  userActive,
                  'Bukti Transfer Pembayaran Kwitansi ' + kwtId
                ];
                uSheet.appendRow(uRow);
              }
            }
          } catch (eUDok) {
            Logger.log('Informasi sync ke UploadDokJamaah dilewati: ' + eUDok.toString());
          }
        }
      } catch (eUpload) {
        Logger.log('Gagal mengunggah berkas bukti transfer ke Google Drive: ' + eUpload.toString());
      }
    }

    const rowData = [
      kwtId,
      now,
      paymentData.idJamaah,
      paymentData.namaJamaah || '',
      paymentData.noKtp || '',
      paymentData.jenisPaket || '',
      nominal,
      paymentData.tipePembayaran || 'DP / Uang Muka',
      paymentData.metodePembayaran || 'Transfer Bank',
      paymentData.namaBank || '',
      paymentData.noReferensi || '',
      paymentData.keterangan || '',
      paymentData.tglBayar || now.split(' ')[0],
      userActive,
      'Verified',
      paymentData.uploadBuktiTransfer || ''
    ];

    sheet.appendRow(rowData);

    // Update Status Jamaah di sheet Data Jamaah jika tipe lunas / total mencukupi
    try {
      const allHistory = getPaymentHistory(paymentData.idJamaah);
      const totalPaid = allHistory.reduce((sum, item) => sum + Number(item.jumlahPembayaran || 0), 0);
      let newStatus = 'Proses Pembayaran (DP)';
      if (paymentData.tipePembayaran === 'Pelunasan' || totalPaid >= Number(paymentData.estimasiHargaPaket || 35000000)) {
        newStatus = 'Lunas';
      }
      
      const jamaahSheet = getDb().getSheetByName(JAMAAH_CONFIG.SHEET_NAME);
      if (jamaahSheet) {
        const jRows = jamaahSheet.getDataRange().getValues();
        for (let i = 1; i < jRows.length; i++) {
          if (String(jRows[i][0]).trim() === String(paymentData.idJamaah).trim()) {
            jamaahSheet.getRange(i + 1, 28).setValue(paymentData.metodePembayaran); // Cara Pembayaran (Col 28)
            if (paymentData.uploadBuktiTransfer) {
              jamaahSheet.getRange(i + 1, 37).setValue(paymentData.uploadBuktiTransfer); // Upload Bukti Transfer (Col 37, AK)
            }
            jamaahSheet.getRange(i + 1, 48).setValue(newStatus); // Status Jamaah (Col 48)
            jamaahSheet.getRange(i + 1, 50).setValue(now); // UpdatedAt (Col 50)
            break;
          }
        }
      }
    } catch (err) {
      Logger.log('Warning update Jamaah status: ' + err.message);
    }

    logActivity(userActive, 'SAVE_JAMAAH_PAYMENT', 'Pembayaran Jamaah ' + paymentData.namaJamaah + ' sebesar Rp ' + nominal.toLocaleString('id-ID') + ' (' + kwtId + ')');

    return {
      success: true,
      message: 'Pembayaran sebesar Rp ' + nominal.toLocaleString('id-ID') + ' berhasil dicatat!',
      kwtId: kwtId,
      data: {
        idKwitansi: kwtId,
        timestamp: now,
        idJamaah: paymentData.idJamaah,
        namaJamaah: paymentData.namaJamaah,
        noKtp: paymentData.noKtp,
        jenisPaket: paymentData.jenisPaket,
        jumlahPembayaran: nominal,
        tipePembayaran: paymentData.tipePembayaran,
        metodePembayaran: paymentData.metodePembayaran,
        namaBank: paymentData.namaBank,
        noReferensi: paymentData.noReferensi,
        keterangan: paymentData.keterangan,
        tglBayar: paymentData.tglBayar || now.split(' ')[0],
        userInput: userActive
      }
    };
  } catch (e) {
    return { success: false, message: 'Gagal mencatat pembayaran: ' + e.message };
  }
}

/**
 * Menghapus Transaksi Pembayaran Jamaah
 */
function deleteJamaahPayment(kwitansiId, userActive = 'Admin') {
  try {
    setupPaymentSheet();
    const sheet = getDb().getSheetByName(PAYMENT_CONFIG.SHEET_NAME);
    if (!sheet) return { success: false, message: 'Sheet History Pembayaran tidak ditemukan.' };

    const allRows = sheet.getDataRange().getValues();
    let targetRowIndex = -1;
    let jamaahId = '';

    for (let i = 1; i < allRows.length; i++) {
      if (String(allRows[i][0]).trim() === String(kwitansiId).trim()) {
        targetRowIndex = i + 1;
        jamaahId = allRows[i][2];
        break;
      }
    }

    if (targetRowIndex === -1) {
      return { success: false, message: 'ID Kwitansi ' + kwitansiId + ' tidak ditemukan.' };
    }

    sheet.deleteRow(targetRowIndex);

    // Update ulang status Jamaah
    if (jamaahId) {
      try {
        const remainingHistory = getPaymentHistory(jamaahId);
        const totalPaid = remainingHistory.reduce((sum, item) => sum + Number(item.jumlahPembayaran || 0), 0);
        let newStatus = totalPaid > 0 ? 'Proses Pembayaran (DP)' : 'Terdaftar';

        const jamaahSheet = getDb().getSheetByName(JAMAAH_CONFIG.SHEET_NAME);
        if (jamaahSheet) {
          const jRows = jamaahSheet.getDataRange().getValues();
          for (let i = 1; i < jRows.length; i++) {
            if (String(jRows[i][0]).trim() === String(jamaahId).trim()) {
              jamaahSheet.getRange(i + 1, 48).setValue(newStatus); // Status Jamaah (Col 48)
              break;
            }
          }
        }
      } catch (err) {
        Logger.log('Warning recalculating status after payment delete: ' + err.message);
      }
    }

    logActivity(userActive, 'DELETE_JAMAAH_PAYMENT', 'Menghapus pembayaran ID kwitansi ' + kwitansiId);
    return { success: true, message: 'Transaksi pembayaran ' + kwitansiId + ' berhasil dihapus.' };
  } catch (e) {
    return { success: false, message: 'Gagal menghapus pembayaran: ' + e.message };
  }
}

/**
 * Upload Seksi 8 Document Files to Google Drive & Sync to UploadDokJamaah + Data Jamaah sheet
 */
function processFormDocFilesUpload_(jamaahId, namaLengkap, formDocFiles, userActive) {
  if (!formDocFiles || typeof formDocFiles !== 'object') return {};
  const docTypeMapping = {
    'ktp': { docType: 'KTP', colProp: 'uploadKtp' },
    'pasport': { docType: 'Paspor', colProp: 'uploadPasport' },
    'bukuNikah': { docType: 'Buku Nikah', colProp: 'bukuNikah' },
    'suratNikah': { docType: 'Surat Nikah', colProp: 'suratNikah' },
    'foto': { docType: 'Foto Jamaah', colProp: 'fotoJamaah' },
    'kk': { docType: 'Kartu Keluarga', colProp: 'kartuKeluarga' },
    'buktiTransfer': { docType: 'Upload Bukti Transfer', colProp: 'uploadBuktiTransfer' }
  };

  const results = {};

  for (const key of Object.keys(docTypeMapping)) {
    const fileData = formDocFiles[key];
    if (fileData && fileData.base64) {
      try {
        const config = docTypeMapping[key];
        const folder = getTargetJamaahUploadFolder_(config.docType);
        const rawBase64 = fileData.base64;
        const cleanBase64 = rawBase64.includes(',') ? rawBase64.split(',')[1] : rawBase64;
        const decodedBytes = Utilities.base64Decode(cleanBase64);
        const ext = fileData.name && fileData.name.includes('.') ? fileData.name.split('.').pop() : 'pdf';
        const fileName = jamaahId + ' - ' + namaLengkap + ' - ' + config.docType + '.' + ext;
        const blob = Utilities.newBlob(decodedBytes, fileData.type || 'application/octet-stream', fileName);
        const file = folder.createFile(blob);
        const fileUrl = file.getUrl();

        results[config.colProp] = fileUrl;
        if (config.colProp === 'suratNikah') results['bukuNikah'] = fileUrl;
        if (config.colProp === 'bukuNikah') results['suratNikah'] = fileUrl;

        try {
          file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        } catch (eSharing) {
          Logger.log('Warning setSharing skipped for ' + fileName + ': ' + eSharing.toString());
        }

        // Write metadata to UploadDokJamaah sheet
        try {
          if (typeof getUploadDokJamaahSheet === 'function') {
            const uSheet = getUploadDokJamaahSheet();
            if (uSheet) {
              const uLastRow = uSheet.getLastRow();
              const docId = 'DOCJ-' + String(uLastRow > 0 ? uLastRow : 1).padStart(4, '0') + '-' + Math.floor(100 + Math.random() * 900);
              const uRow = [
                docId,
                getJakartaTimeString(),
                jamaahId || '',
                namaLengkap || '',
                config.docType,
                fileName,
                fileUrl,
                file.getId(),
                userActive || 'Admin',
                'Diunggah bersamaan dengan Form Input Jamaah'
              ];
              uSheet.appendRow(uRow);
            }
          }
        } catch (eUDok) {
          Logger.log('Sync ke UploadDokJamaah dilewati: ' + eUDok.toString());
        }

      } catch (e) {
        Logger.log('Gagal upload file ' + key + ' untuk jamaah ' + jamaahId + ': ' + e.toString());
      }
    }
  }

  return results;
}


