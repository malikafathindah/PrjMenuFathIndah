/**
 * ============================================================================
 * DATABASE HANDLER (Database.gs)
 * ============================================================================
 * Mengolah semua interaksi CRUD dengan Google Sheets secara terpusat dan aman.
 * Target Spreadsheet ID: 1VL8trcMIcZ6n5Be-2-9YwmC1pOsKliO_wbILmU_cC1s
 */

const CONFIG = {
  SPREADSHEET_ID: '1VL8trcMIcZ6n5Be-2-9YwmC1pOsKliO_wbILmU_cC1s',
  DASHPROG_SPREADSHEET_ID: '1kItrJaXUdzvq6WlM6xoslUk7LWTWQGokmBQLBxAIqCg',
  DASHPROG_GID: 1483869261,
  SHEETS: {
    USERS: 'Users',
    ACTIVITY_LOGS: 'ActivityLogs',
    MODULES: 'Modules',
    ATTENDANCE: 'Rekap Absensi',
    UPLOAD_DOK: 'UploadDok',
    HOTEL: 'Hotel',
    COST_STRUCTURE: 'CostStructure',
    JAMAAH: 'Data Jamaah',
    PEMBAYARAN: 'History Pembayaran',
    PAKET: 'Data Paket',
    CUTI_KARYAWAN: 'CutiKaryawan',
    CUTI_BERSAMA: 'CutiBersama',
    ENTRY_ANGSURAN_HAJI: 'EntryAngsuranHaji',
    DATA_JAMAAH_HAJI: 'DataJamaahHaji',
    VIEW_HAJJ_DATA: 'ViewHajjData',
    UPLOAD_DOK_HAJI: 'UploadDokHaji',
    UPDATE_BIPIH: 'UpdateBIPIH',
    MAHRAM: 'Mahram',
    KELENGKAPAN_UMRAH: 'KelengkapanUmrah'
  }
};

let _cachedDbInstance = null;

/**
 * Mendapatkan instance Spreadsheet (Menggunakan caching memori eksekusi)
 */
function getDb() {
  if (_cachedDbInstance) return _cachedDbInstance;
  
  // 1. Coba SpreadsheetApp.openById() via SPREADSHEET_ID terlebih dahulu
  try {
    if (CONFIG.SPREADSHEET_ID && CONFIG.SPREADSHEET_ID !== 'YOUR_SPREADSHEET_ID_HERE') {
      _cachedDbInstance = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
      return _cachedDbInstance;
    }
  } catch (e) {
    Logger.log('Gagal membuka spreadsheet via ID (' + CONFIG.SPREADSHEET_ID + '): ' + e.message);
  }

  // 2. Fallback SpreadsheetApp.getActiveSpreadsheet() jika script terikat langsung
  try {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) {
      _cachedDbInstance = active;
      return _cachedDbInstance;
    }
  } catch (e) {}
  
  return null;
}

/**
 * Mendapatkan sheet berdasarkan nama, buat baru jika belum ada
 */
function getOrCreateSheet(sheetName, headers = []) {
  const db = getDb();
  let sheet = db.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = db.insertSheet(sheetName);
    if (headers && headers.length > 0) {
      sheet.appendRow(headers);
      // Format header baris pertama
      const headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setBackground('#1e293b');
      headerRange.setFontColor('#ffffff');
      headerRange.setFontWeight('bold');
      sheet.setFrozenRows(1);
    }
  }
  return sheet;
}

/**
 * Mendapatkan Waktu & Tanggal standar Asia/Jakarta (WIB)
 */
function getJakartaTimeString(date = new Date()) {
  try {
    return Utilities.formatDate(date, 'Asia/Jakarta', "yyyy-MM-dd HH:mm:ss");
  } catch (e) {
    return new Date().toISOString();
  }
}

/**
 * Menyiapkan basis data awal & sheet jika kosong (Auto-Initialization)
 */
function setupDatabase() {
  const db = getDb();
  
  // 1. Sheet Users
  const userHeaders = ['ID', 'Username', 'Password', 'FullName', 'Tipe', 'Kantor', 'Role', 'Status', 'CreatedAt'];
  const userSheet = getOrCreateSheet(CONFIG.SHEETS.USERS, userHeaders);
  
  const existingUserHeaders = userSheet.getRange(1, 1, 1, Math.max(userSheet.getLastColumn(), 1)).getValues()[0];
  if (existingUserHeaders.length > 0 && (!existingUserHeaders.includes('Tipe') && !existingUserHeaders.includes('Kanwil') || !existingUserHeaders.includes('Kantor'))) {
    userSheet.getRange(1, 1, 1, userHeaders.length).setValues([userHeaders]);
  }
  
  const existingUsers = getSheetData(CONFIG.SHEETS.USERS);
  const existingUsernames = existingUsers.map(u => String(u.Username || '').toLowerCase().trim());

  const defaultUsers = [
    { ID: 'USR-001', Username: 'admin', Password: hashPassword('admin123'), FullName: 'Administrator Utama', Tipe: 'Pusat', Kantor: 'Kantor Pusat Jakarta', Role: 'Admin', Status: 'Active' },
    { ID: 'USR-002', Username: 'manager', Password: hashPassword('manager123'), FullName: 'Manajer Operasional', Tipe: 'Kanwil', Kantor: 'Cabang Surabaya', Role: 'Manager', Status: 'Active' },
    { ID: 'USR-003', Username: 'staff', Password: hashPassword('staff123'), FullName: 'Staff Operasional', Tipe: 'Kancab', Kantor: 'Cabang Samarinda', Role: 'Staff', Status: 'Active' },
    { ID: 'USR-004', Username: 'hrd', Password: hashPassword('hrd123'), FullName: 'Manajer HRD & Absensi', Tipe: 'Pusat', Kantor: 'Kantor Pusat Jakarta', Role: 'Manager', Status: 'Active' },
    { ID: 'USR-005', Username: 'finance', Password: hashPassword('finance123'), FullName: 'Staff Keuangan', Tipe: 'Agent', Kantor: 'Solo Raya', Role: 'Staff', Status: 'Active' }
  ];

  defaultUsers.forEach(u => {
    if (!existingUsernames.includes(u.Username)) {
      userSheet.appendRow([
        u.ID,
        u.Username,
        u.Password,
        u.FullName,
        u.Tipe,
        u.Kantor,
        u.Role,
        u.Status,
        getJakartaTimeString()
      ]);
    }
  });
  
  // 2. Sheet ActivityLogs
  const logHeaders = ['LogID', 'Timestamp', 'Username', 'IP_Address', 'Location', 'Maps_URL', 'Action', 'Module'];
  const logSheet = getOrCreateSheet(CONFIG.SHEETS.ACTIVITY_LOGS, logHeaders);
  
  // Pastikan baris header pertama di ActivityLogs menyertakan 'Maps_URL' (Migrasi otomatis sheet yang sudah ada)
  const existingLogHeaders = logSheet.getRange(1, 1, 1, Math.max(logSheet.getLastColumn(), 1)).getValues()[0];
  if (existingLogHeaders.length > 0 && !existingLogHeaders.includes('Maps_URL')) {
    const locIdx = existingLogHeaders.indexOf('Location');
    if (locIdx !== -1) {
      logSheet.insertColumnAfter(locIdx + 1);
      logSheet.getRange(1, locIdx + 2).setValue('Maps_URL');
    } else {
      logSheet.insertColumnAfter(existingLogHeaders.length);
      logSheet.getRange(1, existingLogHeaders.length + 1).setValue('Maps_URL');
    }
  }
  
  // 3. Sheet Modules
  createModulesSheet();

  // 4. Sheet Data Paket (jika PaketManager loaded)
  if (typeof setupPaketSheet === 'function') {
    try { setupPaketSheet(); } catch (e) { Logger.log('setupPaketSheet note: ' + e.message); }
  }

  // 5. Sheet Cuti Karyawan & Cuti Bersama (jika CutiManager loaded)
  if (typeof setupCutiSheets === 'function') {
    try { setupCutiSheets(); } catch (e) { Logger.log('setupCutiSheets note: ' + e.message); }
  }

  // 6. Sheet Upload Dokumen Haji (jika UploadDocHajiManager loaded)
  if (typeof setupUploadDocHajiSheet === 'function') {
    try { setupUploadDocHajiSheet(); } catch (e) { Logger.log('setupUploadDocHajiSheet note: ' + e.message); }
  }

  // 7. Sheet View Jamaah Haji (jika ViewJamaahHajiManager loaded)
  if (typeof setupViewJamaahHajiSheet === 'function') {
    try { setupViewJamaahHajiSheet(); } catch (e) { Logger.log('setupViewJamaahHajiSheet note: ' + e.message); }
  }

  // 8. Sheet Update BIPIH (jika UpdateStatusBipihManager loaded)
  if (typeof setupUpdateStatusBipihSheet === 'function') {
    try { setupUpdateStatusBipihSheet(); } catch (e) { Logger.log('setupUpdateStatusBipihSheet note: ' + e.message); }
  }

  // 9. Dashboard HT (jika DashboardHTManager loaded)
  if (typeof setupDashboardHT === 'function') {
    try { setupDashboardHT(); } catch (e) { Logger.log('setupDashboardHT note: ' + e.message); }
  }

  return { success: true, message: 'Inisialisasi Database Berhasil!' };
}

/**
 * Fungsi khusus untuk membuat & mengisi sheet "Modules" secara otomatis
 */
function createModulesSheet() {
  const moduleHeaders = ['ModuleID', 'ModuleName', 'Category', 'Status', 'Icon', 'AccessRole', 'Order', 'Description'];
  const moduleSheet = getOrCreateSheet(CONFIG.SHEETS.MODULES, moduleHeaders);
  
  const defaultModules = [
    ['mod_dashboard', 'Dashboard Utama', 'Sistem', 'Active', 'fa-solid fa-chart-pie', 'Admin,Manager,Staff', 1, 'Ringkasan performa dan statistik sistem'],
    ['mod_users', 'Manajemen Pengguna', 'Pengaturan', 'Active', 'fa-solid fa-users-gear', 'Admin', 2, 'Kelola akun user, role, dan hak akses'],
    ['mod_sistem_user', 'Sistem User & Hak Akses', 'Pengaturan', 'Active', 'fa-solid fa-user-lock', 'Admin', 3, 'Pengaturan akun dan hak akses pengguna'],
    ['mod_logs', 'Log Aktivitas & Audit', 'Keamanan', 'Active', 'fa-solid fa-shield-halved', 'Admin,Manager', 4, 'Audit trail jejak aktivitas pengguna'],
    ['mod_inventory', 'Manajemen Inventaris', 'Operasional', 'Active', 'fa-solid fa-boxes-stacked', 'Admin,Manager,Staff', 5, 'Modul plug-and-play kelola stok barang'],
    ['mod_finance', 'Modul Keuangan', 'Keuangan', 'Active', 'fa-solid fa-wallet', 'Admin,Manager', 6, 'Modul plug-and-play kelola arus kas'],
    ['mod_attendance', 'Rekap Absensi', 'Karyawan', 'Active', 'fa-solid fa-clipboard-user', 'Admin,Manager,Staff', 7, 'Rekapitulasi absensi karyawan dari sheet Rekap Absensi'],
    ['mod_data_attendance', 'Data Absensi', 'Karyawan', 'Active', 'fa-solid fa-list-check', 'Admin,Manager,Staff', 8, 'Detail log absensi karyawan dari sheet Data Absensi'],
    ['mod_bio_karyawan', 'Form Entry Karyawan', 'Karyawan', 'Active', 'fa-solid fa-user-plus', 'Admin,Manager,Staff', 9, 'Formulir entry data lengkap biodata karyawan baru'],
    ['mod_daftar_karyawan', 'Daftar Karyawan', 'Karyawan', 'Active', 'fa-solid fa-users', 'Admin,Manager,Staff', 10, 'Daftar rekapitulasi data seluruh karyawan terdaftar'],
    ['mod_upload_dok', 'Upload Dokumen', 'Karyawan', 'Active', 'fa-solid fa-cloud-arrow-up', 'Admin,Manager,Staff', 11, 'Upload dokumen Karyawan ke Google Drive & simpan link ke sheet UploadDok'],
    ['mod_detail_emp', 'Detail Pegawai', 'Karyawan', 'Active', 'fa-solid fa-id-card-clip', 'Admin,Manager,Staff', 12, 'Dokumen lengkap detail kepegawaian dan biodata resmi karyawan'],
    ['mod_emp_analytics', 'Analytics Karyawan', 'Karyawan', 'Active', 'fa-solid fa-chart-column', 'Admin,Manager,Staff', 13, 'Dashboard analytics & demografi statistik karyawan'],
    ['mod_cuti_karyawan', 'Pengajuan & Rekap Cuti', 'Karyawan', 'Active', 'fa-solid fa-calendar-minus', 'Admin,Manager,Staff', 14, 'Pengajuan cuti karyawan, persetujuan, sisa kuota, dan kalender cuti'],
    ['mod_cuti_bersama', 'Cuti Bersama & Libur', 'Karyawan', 'Active', 'fa-solid fa-calendar-day', 'Admin,Manager,Staff', 15, 'Setting hari cuti bersama & tanggal libur nasional per tahun'],
    ['mod_modules', 'Registry Modul', 'Pengaturan', 'Active', 'fa-solid fa-sliders', 'Admin', 16, 'Kelola pendaftaran dan status modul sistem'],
    ['mod_input_hotel', 'Input Data Hotel', 'Marketing', 'Active', 'fa-solid fa-hotel', 'Admin,Manager,Staff', 17, 'Input data hotel, harga kamar (Double/Triple/Quad), vendor provider & kontrak'],
    ['mod_input_flight', 'Input Data Penerbangan', 'Marketing', 'Active', 'fa-solid fa-plane-departure', 'Admin,Manager,Staff', 18, 'Input data penerbangan, rute outbound/inbound, alokasi block seat & harga tiket'],
    ['mod_cost_structure', 'Cost Structure Paket', 'Marketing', 'Active', 'fa-solid fa-calculator', 'Admin,Manager,Staff', 19, 'Perhitungan HPP, asumsi biaya, margin faedah, & harga jual paket Umrah'],
    ['mod_form_input_jamaah', 'Form Input Jamaah', 'Jamaah', 'Active', 'fa-solid fa-file-signature', 'Admin,Manager,Staff', 20, 'Formulir input data pendaftaran jamaah umrah baru'],
    ['mod_data_jamaah', 'Data Jamaah', 'Jamaah', 'Active', 'fa-solid fa-table-list', 'Admin,Manager,Staff', 21, 'Daftar rekapitulasi data jamaah terdaftar & pencarian'],
    ['mod_rooming_list', 'Rooming List & Penempatan', 'Jamaah', 'Active', 'fa-solid fa-bed', 'Admin,Manager,Staff', 22, 'Pengaturan alokasi penempatan kamar jamaah & cetak rooming list'],
    ['mod_pembayaran_jamaah', 'Pembayaran & Kwitansi', 'Jamaah', 'Active', 'fa-solid fa-file-invoice-dollar', 'Admin,Manager,Staff', 23, 'Pencatatan riwayat pembayaran, sisa tagihan & cetak kwitansi jamaah'],
    ['mod_upload_dok_jamaah', 'Upload Dokumen Jamaah', 'Jamaah', 'Active', 'fa-solid fa-folder-arrow-up', 'Admin,Manager,Staff', 24, 'Pengunggahan berkas fisik dokumen jamaah ke Google Drive per jenis dokumen'],
    ['mod_slip_gaji', 'Lihat Slip Gaji', 'Keuangan', 'Active', 'fa-solid fa-file-invoice-dollar', 'Admin,Manager,Staff', 25, 'Lihat dan pratinjau dokumen Slip Gaji karyawan dari Google Drive'],
    ['mod_upload_dok_haji', 'Upload Dokumen Haji', 'Jamaah', 'Active', 'fa-solid fa-folder-open', 'Admin,Manager,Staff', 27, 'Pengunggahan dokumen berkas fisik jamaah haji (BPJS, SPPH, Paspor, KTP, KK, dll) ke Google Drive'],
    ['mod_view_jamaah_haji', 'View Data Jamaah Haji', 'Jamaah', 'Active', 'fa-solid fa-kaaba', 'Admin,Manager,Staff', 28, 'Menampilkan seluruh data Jamaah Haji dari sheet DataJamaahHaji (Group Tampilan)'],
    ['mod_update_status_bipih', 'Update Status BIPIH', 'Jamaah', 'Active', 'fa-solid fa-file-invoice-dollar', 'Admin,Manager,Staff', 29, 'Form update pelunasan status BIPIH (C/F) & pencatatan riwayat transaksi ke sheet UpdateBIPIH'],
    ['mod_kelengkapan_umrah', 'Input Kelengkapan Data Umrah', 'Umrah', 'Active', 'fa-solid fa-passport', 'Admin,Manager,Staff', 30, 'Input kelengkapan dokumen Umrah: Visa, Asuransi Polis, dan BPJS Jamaah']
  ];

  const existingModules = getSheetData(CONFIG.SHEETS.MODULES) || [];
  const existingIds = existingModules.map(m => String(m.ModuleID || m.Moduleid || m['Module ID'] || m.id || '').trim().toLowerCase());

  let addedCount = 0;
  defaultModules.forEach(mod => {
    if (!existingIds.includes(String(mod[0]).trim().toLowerCase())) {
      moduleSheet.appendRow(mod);
      addedCount++;
    }
  });

  return { success: true, message: 'Sheet Modules berhasil dibuat/diperbarui! (' + addedCount + ' modul baru ditambahkan)' };
}

/**
 * Mencari Sheet secara fleksibel dengan toleransi spasi ekstra, penulisan kata terpisah,
 * kapitalisasi, garis bawah, maupun tanda hubung.
 */
function findSheetByNameFlexible(sheetName) {
  const ss = getDb();
  if (!sheetName) return null;
  
  // 1. Cek pencocokan eksak langsung
  let sheet = ss.getSheetByName(sheetName);
  if (sheet) return sheet;

  // 2. Normalisasi string (hilangkan spasi, underscore, strip, dan kecilkan huruf)
  const targetClean = String(sheetName).toLowerCase().replace(/[^a-z0-9]/g, '');
  const sheets = ss.getSheets();

  for (let i = 0; i < sheets.length; i++) {
    const nameClean = sheets[i].getName().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (nameClean === targetClean) {
      return sheets[i];
    }
  }

  // 3. Fallback pencocokan kata parsial (bio, karyawan, biodata, sdm, employee, pegawai)
  const targetLower = String(sheetName).toLowerCase();
  if (targetLower.includes('log') || targetLower.includes('activity') || targetLower.includes('audit')) {
    for (let i = 0; i < sheets.length; i++) {
      const nameLower = sheets[i].getName().toLowerCase();
      if (nameLower.includes('log') || nameLower.includes('activity') || nameLower.includes('audit')) {
        return sheets[i];
      }
    }
  }

  for (let i = 0; i < sheets.length; i++) {
    const nameLower = sheets[i].getName().toLowerCase();
    if ((targetLower.includes('bio') || targetLower.includes('karyawan')) &&
        (nameLower.includes('bio') || nameLower.includes('karyawan') || nameLower.includes('biodata') || nameLower.includes('sdm') || nameLower.includes('pegawai'))) {
      return sheets[i];
    }
    if ((targetLower.includes('jamaah') || targetLower.includes('jemaah')) &&
        (nameLower.includes('jamaah') || nameLower.includes('jemaah') || nameLower.includes('form responses') || nameLower.includes('respon'))) {
      if (targetLower.includes('haji') && !nameLower.includes('haji')) {
        continue;
      }
      return sheets[i];
    }
    if ((targetLower.includes('cost') || targetLower.includes('structure')) &&
        (nameLower.includes('cost') || nameLower.includes('structure'))) {
      return sheets[i];
    }
    if (targetLower.includes('paket') && !targetLower.includes('cost') && !targetLower.includes('structure')) {
      if (nameLower.includes('paket') && !nameLower.includes('cost') && !nameLower.includes('structure') && !nameLower.includes('jamaah') && !nameLower.includes('jemaah') && !nameLower.includes('hotel') && !nameLower.includes('flight')) {
        return sheets[i];
      }
    }
  }

  // 4. Scan isi header sheet jika mencari data karyawan atau paket
  for (let i = 0; i < sheets.length; i++) {
    const s = sheets[i];
    const nameLower = s.getName().toLowerCase();
    if (s.getLastRow() > 0) {
      const sampleText = s.getRange(1, 1, Math.min(2, s.getLastRow()), Math.min(20, Math.max(1, s.getLastColumn()))).getValues().flat().join(' ').toLowerCase();
      if ((targetLower.includes('bio') || targetLower.includes('karyawan')) &&
          sampleText.includes('nama') && (sampleText.includes('kelamin') || sampleText.includes('lahir') || sampleText.includes('status') || sampleText.includes('pendidikan'))) {
        return s;
      }
      if (targetLower.includes('paket') && !targetLower.includes('cost') && !nameLower.includes('cost') && !nameLower.includes('structure')) {
        if (sampleText.includes('id paket') || sampleText.includes('nama paket') || (sampleText.includes('harga') && sampleText.includes('quad'))) {
          return s;
        }
      }
    }
  }

  return null;
}

/**
 * Membaca semua data dari sheet sebagai Array of Objects
 */
function getSheetData(sheetName) {
  const sheet = findSheetByNameFlexible(sheetName);
  if (!sheet) return [];
  
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  
  const headers = data[0];
  const rows = data.slice(1);
  
  return rows.map((row, rowIndex) => {
    const obj = { _rowIndex: rowIndex + 2 };
    headers.forEach((header, colIndex) => {
      if (header) obj[header] = row[colIndex];
    });
    return obj;
  });
}

/**
 * Menambahkan baris data baru ke Sheet
 */
function insertRow(sheetName, dataObject) {
  const sheet = findSheetByNameFlexible(sheetName);
  if (!sheet) throw new Error('Sheet ' + sheetName + ' tidak ditemukan');
  
  let headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
  
  // Otomatis tambahkan kolom Maps_URL jika belum ada di header baris 1 ActivityLogs
  if (sheetName === CONFIG.SHEETS.ACTIVITY_LOGS && !headers.includes('Maps_URL')) {
    const locIdx = headers.indexOf('Location');
    if (locIdx !== -1) {
      sheet.insertColumnAfter(locIdx + 1);
      sheet.getRange(1, locIdx + 2).setValue('Maps_URL');
    } else {
      sheet.insertColumnAfter(headers.length);
      sheet.getRange(1, headers.length + 1).setValue('Maps_URL');
    }
    headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  }

  const rowToAppend = headers.map(header => {
    if (dataObject[header] !== undefined) return dataObject[header];
    const cleanHeader = String(header).toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const k in dataObject) {
      if (String(k).toLowerCase().replace(/[^a-z0-9]/g, '') === cleanHeader) {
        return dataObject[k];
      }
    }
    return '';
  });
  
  sheet.appendRow(rowToAppend);
  return { success: true, message: 'Data berhasil ditambahkan' };
}

/**
 * Mengubah data baris tertentu berdasarkan kriteria pencarian (Primary Key)
 */
function updateRowWhere(sheetName, keyName, keyValue, updateData) {
  const sheet = findSheetByNameFlexible(sheetName);
  if (!sheet) throw new Error('Sheet ' + sheetName + ' tidak ditemukan');
  
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { success: false, message: 'Data kosong' };
  
  const headers = data[0];
  let keyIndex = headers.indexOf(keyName);
  if (keyIndex === -1) {
    const cleanKey = String(keyName).toLowerCase().replace(/[^a-z0-9]/g, '');
    keyIndex = headers.findIndex(h => String(h).toLowerCase().replace(/[^a-z0-9]/g, '') === cleanKey);
  }
  if (keyIndex === -1) throw new Error('Kolom ' + keyName + ' tidak ditemukan');
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][keyIndex]) === String(keyValue)) {
      headers.forEach((header, colIndex) => {
        let val = updateData[header];
        if (val === undefined) {
          const cleanHeader = String(header).toLowerCase().replace(/[^a-z0-9]/g, '');
          for (const k in updateData) {
            if (String(k).toLowerCase().replace(/[^a-z0-9]/g, '') === cleanHeader) {
              val = updateData[k];
              break;
            }
          }
        }
        if (val !== undefined) {
          sheet.getRange(i + 1, colIndex + 1).setValue(val);
        }
      });
      return { success: true, message: 'Data berhasil diperbarui' };
    }
  }
  return { success: false, message: 'Data dengan ' + keyName + '=' + keyValue + ' tidak ditemukan' };
}

/**
 * Menghapus baris berdasarkan kriteria pencarian
 */
function deleteRowWhere(sheetName, keyName, keyValue) {
  const sheet = findSheetByNameFlexible(sheetName);
  if (!sheet) throw new Error('Sheet ' + sheetName + ' tidak ditemukan');
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  let keyIndex = headers.indexOf(keyName);
  if (keyIndex === -1) {
    const cleanKey = String(keyName).toLowerCase().replace(/[^a-z0-9]/g, '');
    keyIndex = headers.findIndex(h => String(h).toLowerCase().replace(/[^a-z0-9]/g, '') === cleanKey);
  }
  if (keyIndex === -1) return { success: false, message: 'Kolom ' + keyName + ' tidak ditemukan' };
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][keyIndex]) === String(keyValue)) {
      sheet.deleteRow(i + 1);
      return { success: true, message: 'Data berhasil dihapus' };
    }
  }
  return { success: false, message: 'Data tidak ditemukan' };
}
