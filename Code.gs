/**
 * ============================================================================
 * CORE ROUTER & SERVER ENTRY POINT (Code.gs)
 * ============================================================================
 * Menangani HTTP Get Request (doGet), merender antarmuka utama, serta bertindak
 * sebagai API Router terpusat untuk menghubungkan frontend dengan modul backend.
 */

/**
 * Entry point utama saat Web App dibuka di browser
 */
function doGet(e) {
  const template = HtmlService.createTemplateFromFile('Index');
  return template.evaluate()
    .setTitle('Fath Indah Portal - Aplikasi Internal')
    .setFaviconUrl('https://cdn-icons-png.flaticon.com/512/3135/3135715.png')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Helper untuk menyisipkan file HTML komponen/modul ke dalam file utama.
 * Toleran terhadap penamaan file di Apps Script Editor (dengan atau tanpa .html)
 * serta menangani file yang belum diunggah agar sistem tidak crash.
 */
function include(filename) {
  try {
    return HtmlService.createTemplateFromFile(filename).evaluate().getContent();
  } catch (e1) {
    try {
      return HtmlService.createHtmlOutputFromFile(filename).getContent();
    } catch (e1_sub) {
      try {
        return HtmlService.createTemplateFromFile(filename + '.html').evaluate().getContent();
      } catch (e2) {
        try {
          return HtmlService.createHtmlOutputFromFile(filename + '.html').getContent();
        } catch (e2_sub) {
          const cleanName = String(filename || '').replace(/\.html$/i, '');
          const aliases = [
            filename,
            filename + '.html',
            cleanName
          ];
          for (let i = 0; i < aliases.length; i++) {
            try {
              const content = HtmlService.createTemplateFromFile(aliases[i]).evaluate().getContent();
              if (content && content.trim() !== '') return content;
            } catch (errAlias) {
              try {
                const content = HtmlService.createHtmlOutputFromFile(aliases[i]).getContent();
                if (content && content.trim() !== '') return content;
              } catch (errAlias2) {}
            }
          }
          return '';
        }
      }
    }
  }
}

/**
 * API ROUTER TERPUSAT
 * Seluruh pemanggilan dari Frontend (google.script.run) melewati fungsi API aman di bawah ini.
 */

// 1. Auth & Session APIs
function apiLogin(username, password, clientMeta) {
  return loginUser(username, password, clientMeta);
}

function apiLogout(token, clientMeta) {
  return logoutUser(token, clientMeta);
}

function apiValidateSession(token) {
  return validateSession(token);
}

// 2. Navigation & Module Router API
function apiGetNavigationMenu(token) {
  const sessionCheck = validateSession(token);
  if (!sessionCheck.valid) {
    return { success: false, message: 'Sesi telah berakhir. Silakan login kembali.' };
  }
  const userRole = sessionCheck.session.role;
  const menuData = getActiveNavigationMenu(userRole);
  return { success: true, menu: menuData, user: sessionCheck.session };
}

// 3. User Management APIs (Admin Only)
function apiGetUsers(token) {
  const sessionCheck = validateSession(token);
  if (!sessionCheck.valid || sessionCheck.session.role !== 'Admin') {
    return { success: false, message: 'Akses ditolak. Membutuhkan hak akses Admin!' };
  }
  const users = getSheetData(CONFIG.SHEETS.USERS);
  // Sembunyikan password hash saat dikirim ke frontend
  const safeUsers = users.map(u => {
    const { Password, ...rest } = u;
    return rest;
  });
  return { success: true, data: safeUsers };
}

function apiSaveUser(userData, token) {
  const sessionCheck = validateSession(token);
  if (!sessionCheck.valid || sessionCheck.session.role !== 'Admin') {
    return { success: false, message: 'Akses ditolak!' };
  }

  if (!userData.Username || !userData.FullName || !userData.Role) {
    return { success: false, message: 'Form tidak lengkap!' };
  }

  const existingUsers = getSheetData(CONFIG.SHEETS.USERS);
  const cleanUsername = String(userData.Username).trim().toLowerCase();

  // Jika ID ada, maka UPDATE, jika tidak maka CREATE
  if (userData.ID) {
    const updateObj = {
      FullName: userData.FullName,
      Role: userData.Role,
      Status: userData.Status || 'Active'
    };
    if (userData.Password && userData.Password.trim() !== '') {
      updateObj.Password = hashPassword(userData.Password.trim());
    }
    updateRowWhere(CONFIG.SHEETS.USERS, 'ID', userData.ID, updateObj);
    logActivity(sessionCheck.session.username, 'UPDATE_USER', 'Users', 'Mengubah user ' + cleanUsername);
    return { success: true, message: 'Data user berhasil diperbarui' };
  } else {
    // Check duplicate
    const isExist = existingUsers.some(u => String(u.Username).toLowerCase() === cleanUsername);
    if (isExist) {
      return { success: false, message: 'Username sudah digunakan!' };
    }
    const newUserId = 'USR-' + (existingUsers.length + 1).toString().padStart(3, '0');
    const newUser = {
      ID: newUserId,
      Username: cleanUsername,
      Password: hashPassword(userData.Password || '123456'),
      FullName: userData.FullName,
      Role: userData.Role,
      Status: userData.Status || 'Active',
      CreatedAt: new Date().toISOString()
    };
    insertRow(CONFIG.SHEETS.USERS, newUser);
    logActivity(sessionCheck.session.username, 'CREATE_USER', 'Users', 'Membuat user baru ' + cleanUsername);
    return { success: true, message: 'User baru berhasil ditambahkan' };
  }
}

function apiDeleteUser(userId, token) {
  const sessionCheck = validateSession(token);
  if (!sessionCheck.valid || sessionCheck.session.role !== 'Admin') {
    return { success: false, message: 'Akses ditolak!' };
  }
  deleteRowWhere(CONFIG.SHEETS.USERS, 'ID', userId);
  logActivity(sessionCheck.session.username, 'DELETE_USER', 'Users', 'Menghapus user ID: ' + userId);
  return { success: true, message: 'User berhasil dihapus' };
}

// 4. Activity Logs API
function apiGetActivityLogs(token) {
  try {
    if (typeof setupDatabase === 'function') {
      setupDatabase();
    }
    
    let rawLogs = [];
    try {
      rawLogs = getSheetData(CONFIG.SHEETS.ACTIVITY_LOGS) || [];
    } catch (e) {}

    // Normalisasi properti fleksibel (menangani variasi nama kolom header)
    let logs = rawLogs.map((row, idx) => {
      const getVal = (possibleKeys, defaultVal = '') => {
        if (!row || typeof row !== 'object') return defaultVal;
        for (let k of possibleKeys) {
          if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
            return row[k];
          }
        }
        for (let key in row) {
          const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
          for (let pKey of possibleKeys) {
            if (cleanKey === pKey.toLowerCase().replace(/[^a-z0-9]/g, '')) {
              if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
                return row[key];
              }
            }
          }
        }
        return defaultVal;
      };

      let tsVal = getVal(['Timestamp', 'Waktu', 'Tanggal', 'Created_At', 'CreatedAt'], '');
      if (tsVal instanceof Date) {
        tsVal = typeof getJakartaTimeString === 'function' ? getJakartaTimeString(tsVal) : tsVal.toISOString();
      }

      return {
        LogID: String(getVal(['LogID', 'ID', 'log_id', 'No'], 'LOG-' + (idx + 1))),
        Timestamp: String(tsVal || new Date().toISOString()),
        Username: String(getVal(['Username', 'User', 'Pengguna', 'Nama'], 'admin')),
        IP_Address: String(getVal(['IP_Address', 'IPAddress', 'IP', 'Alamat_IP', 'Alamat IP'], '127.0.0.1')),
        Location: String(getVal(['Location', 'Lokasi', 'Kota', 'Geolokasi'], 'Jakarta, Indonesia')),
        Maps_URL: String(getVal(['Maps_URL', 'Maps', 'Google_Maps', 'MapsUrl', 'Google Maps'], '#')),
        Action: String(getVal(['Action', 'Aksi', 'Keterangan', 'Detail', 'Aktivitas'], 'SYSTEM_EVENT')),
        Module: String(getVal(['Module', 'Modul', 'Fitur'], 'System'))
      };
    });

    // Initial log seeder jika ActivityLogs masih kosong
    if (!logs || logs.length === 0) {
      const initTimestamp = typeof getJakartaTimeString === 'function' ? getJakartaTimeString() : new Date().toISOString();
      const defaultLog = {
        LogID: 'LOG-INIT-001',
        Timestamp: initTimestamp,
        Username: 'admin',
        IP_Address: '127.0.0.1 (System)',
        Location: 'Jakarta, Indonesia',
        Maps_URL: 'https://www.google.com/maps?q=-6.2088,106.8456',
        Action: 'SYSTEM_INITIALIZED (Sistem Aktif)',
        Module: 'System'
      };
      logs = [defaultLog];
      
      try {
        if (typeof insertRow === 'function') {
          insertRow(CONFIG.SHEETS.ACTIVITY_LOGS, defaultLog);
        }
      } catch (err) {}
    }

    // Sort paling terbaru di atas
    logs.sort((a, b) => new Date(b.Timestamp || 0) - new Date(a.Timestamp || 0));
    return { success: true, data: logs.slice(0, 150) };
  } catch (e) {
    Logger.log('Error pada apiGetActivityLogs: ' + e.message);
    const initTimestamp = typeof getJakartaTimeString === 'function' ? getJakartaTimeString() : new Date().toISOString();
    return {
      success: true,
      data: [
        {
          LogID: 'LOG-SYS-001',
          Timestamp: initTimestamp,
          Username: 'admin',
          IP_Address: '127.0.0.1 (System)',
          Location: 'Jakarta, Indonesia',
          Maps_URL: 'https://www.google.com/maps?q=-6.2088,106.8456',
          Action: 'SYSTEM_READY',
          Module: 'System'
        }
      ]
    };
  }
}

// 4b. Rekap Absensi API
function apiGetAttendanceSummary(token, forceRefresh) {
  try {
    return getAttendanceSummaryData(forceRefresh);
  } catch (e) {
    return {
      success: false,
      message: 'Gagal memuat Rekap Absensi: ' + e.message,
      headers: { row9: [], row10: [], row11: [], combined: [] },
      rows: []
    };
  }
}

// 4c. Log Data Absensi API (Sheet: Data Absensi)
function apiGetRawAttendanceLogs(token) {
  try {
    return getRawAttendanceLogsData();
  } catch (e) {
    return {
      success: false,
      message: 'Gagal memuat Data Absensi: ' + e.message,
      data: []
    };
  }
}

// 4d. Analytics Karyawan API (mod_emp_analytics)
function apiGetEmployeeBioSummary(token, forceRefresh) {
  try {
    return getEmployeeBioSummaryData(forceRefresh);
  } catch (e) {
    return {
      success: false,
      message: 'Gagal memuat Analytics Karyawan: ' + e.message
    };
  }
}


// 5. Modules Management APIs
function apiGetModules(token) {
  const sessionCheck = validateSession(token);
  if (!sessionCheck.valid) return { success: false, message: 'Sesi berakhir' };
  return { success: true, data: getAllModulesList() };
}

function apiSaveModule(moduleData, token) {
  const sessionCheck = validateSession(token);
  if (!sessionCheck.valid || sessionCheck.session.role !== 'Admin') {
    return { success: false, message: 'Akses ditolak!' };
  }
  const result = registerNewModule(moduleData);
  if (result.success) {
    logActivity(sessionCheck.session.username, 'SAVE_MODULE', 'Modules', 'Registrasi/Update modul ' + moduleData.ModuleName);
  }
  return result;
}

function apiToggleModuleStatus(moduleId, status, token) {
  const sessionCheck = validateSession(token);
  if (!sessionCheck.valid || sessionCheck.session.role !== 'Admin') {
    return { success: false, message: 'Akses ditolak!' };
  }
  toggleModuleStatus(moduleId, status);
  logActivity(sessionCheck.session.username, 'TOGGLE_MODULE', 'Modules', 'Mengubah status modul ' + moduleId + ' menjadi ' + status);
  return { success: true, message: 'Status modul berhasil diubah' };
}

/**
 * Helper fleksibel untuk mengambil nilai properti dari objek row 
 * dengan toleransi variasi penulisan nama header (kapital, spasi, singkatan)
 */
function getRowValue(row, possibleKeys) {
  if (!row || typeof row !== 'object') return '';
  const keys = Object.keys(row);
  if (keys.length === 0) return '';
  
  const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  // Match 1: Normalized string match (ignores spaces, underscores, symbols, case)
  for (let i = 0; i < possibleKeys.length; i++) {
    const targetNorm = norm(possibleKeys[i]);
    if (!targetNorm) continue;
    
    for (let j = 0; j < keys.length; j++) {
      const keyNorm = norm(keys[j]);
      if (keyNorm === targetNorm) {
        const val = row[keys[j]];
        if (val !== undefined && val !== null) return String(val).trim();
      }
    }
  }

  // Match 2: Substring inclusion match for normalized keys
  for (let i = 0; i < possibleKeys.length; i++) {
    const targetNorm = norm(possibleKeys[i]);
    if (targetNorm.length < 3) continue;
    
    for (let j = 0; j < keys.length; j++) {
      const keyNorm = norm(keys[j]);
      if (keyNorm && (keyNorm.includes(targetNorm) || targetNorm.includes(keyNorm))) {
        const val = row[keys[j]];
        if (val !== undefined && val !== null) return String(val).trim();
      }
    }
  }

  return '';
}

/**
 * Helper ekstraksi URL dari sel Spreadsheet (Mendukung Plain Text, Display Value, RichText Hyperlink, dan Formula)
 */
function getCellUrlValue(sheet, cellAddress) {
  try {
    const range = sheet.getRange(cellAddress);
    
    // 1. Cek RichTextValue jika sel diberi hyperlink teks
    const richText = range.getRichTextValue();
    if (richText) {
      const linkUrl = richText.getLinkUrl();
      if (linkUrl) return String(linkUrl).trim();
      
      const runs = richText.getRuns();
      if (runs && runs.length > 0) {
        for (let i = 0; i < runs.length; i++) {
          const runUrl = runs[i].getLinkUrl();
          if (runUrl) return String(runUrl).trim();
        }
      }
    }
    
    // 2. Cek Formula (=HYPERLINK(...) atau =IMAGE(...))
    const formula = range.getFormula();
    if (formula) {
      const urlMatch = formula.match(/["'](https?:\/\/[^"']+)["']/i) || formula.match(/(https?:\/\/[^\s"',)]+)/i);
      if (urlMatch && urlMatch[1]) {
        return String(urlMatch[1]).trim();
      }
    }
    
    // 3. Cek DisplayValue (Teks terformat di sel)
    const displayVal = range.getDisplayValue();
    if (displayVal && String(displayVal).trim() !== '') {
      const valStr = String(displayVal).trim();
      const urlMatch = valStr.match(/(https?:\/\/[^\s"']+)/i);
      if (urlMatch && urlMatch[1]) return urlMatch[1].trim();
      return valStr;
    }

    // 4. Fallback Value biasa
    const val = range.getValue();
    if (val && String(val).trim() !== '') {
      const valStr = String(val).trim();
      const urlMatch = valStr.match(/(https?:\/\/[^\s"']+)/i);
      if (urlMatch && urlMatch[1]) return urlMatch[1].trim();
      return valStr;
    }

    return '';
  } catch (e) {
    Logger.log('Error getCellUrlValue (' + cellAddress + '): ' + e.toString());
    return '';
  }
}

/**
 * Memproses URL gambar / Google Drive File ID menjadi Data URI Base64 atau Thumbnail URL aman
 */
function processImageUrl(url) {
  if (!url) return { rawUrl: '', displayUrl: '', embedUrl: '' };
  
  let cleanUrl = String(url).trim().replace(/^["']|["']$/g, '');
  if (!cleanUrl) return { rawUrl: '', displayUrl: '', embedUrl: '' };

  let fileId = null;
  if (cleanUrl.includes('drive.google.com') || cleanUrl.includes('docs.google.com')) {
    const match = cleanUrl.match(/\/d\/([a-zA-Z0-9_-]{20,})|id=([a-zA-Z0-9_-]{20,})/);
    if (match) {
      fileId = match[1] || match[2];
    }
  } else if (/^[a-zA-Z0-9_-]{25,50}$/.test(cleanUrl)) {
    fileId = cleanUrl;
  }

  if (fileId) {
    const embedUrl = 'https://drive.google.com/file/d/' + fileId + '/preview';
    const thumbnailUrl = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w1600';
    
    // Coba konversi via DriveApp ke Base64 Data URI jika file ada di Drive
    try {
      const file = DriveApp.getFileById(fileId);
      if (file) {
        const blob = file.getBlob();
        const bytes = blob.getBytes();
        // Hanya jika ukuran file di bawah 5MB agar aman dalam transfer JSON
        if (bytes && bytes.length > 0 && bytes.length < 5 * 1024 * 1024) {
          let contentType = blob.getContentType() || 'image/png';
          if (!contentType.startsWith('image/')) {
            contentType = 'image/png';
          }
          const base64 = Utilities.base64Encode(bytes);
          const dataUri = 'data:' + contentType + ';base64,' + base64;
          return {
            rawUrl: cleanUrl,
            displayUrl: dataUri,
            embedUrl: embedUrl,
            fileId: fileId
          };
        }
      }
    } catch (e) {
      Logger.log('DriveApp conversion failed/restricted for ID ' + fileId + ': ' + e.toString());
    }

    // Fallback jika DriveApp tidak mengembalikan base64
    return {
      rawUrl: cleanUrl,
      displayUrl: thumbnailUrl,
      embedUrl: embedUrl,
      fileId: fileId
    };
  }

  // Non-Drive Direct Image URL / Base64
  return {
    rawUrl: cleanUrl,
    displayUrl: cleanUrl,
    embedUrl: cleanUrl,
    fileId: null
  };
}

/**
 * Helper khusus membaca Link Kiri (J1) dan Link Kanan (J2) dari Sheet "RekapDashboard"
 */
function getRekapDashboardLinks() {
  try {
    let sheet = findSheetByNameFlexible('RekapDashboard');
    if (!sheet) {
      // Direct fallback lookup pada spreadsheet utama
      const ss = typeof getDb === 'function' ? getDb() : SpreadsheetApp.getActiveSpreadsheet();
      if (ss) {
        sheet = ss.getSheetByName('RekapDashboard') || ss.getSheetByName('Rekap Dashboard') || ss.getSheetByName('REKAPDASHBOARD');
      }
    }
    
    if (!sheet) {
      return { 
        linkJ1: '', displayJ1: '', embedJ1: '',
        linkJ2: '', displayJ2: '', embedJ2: '' 
      };
    }
    
    return extractLinksFromRekapSheet(sheet);
  } catch (e) {
    Logger.log('Error getRekapDashboardLinks: ' + e.toString());
    return { 
      linkJ1: '', displayJ1: '', embedJ1: '',
      linkJ2: '', displayJ2: '', embedJ2: '' 
    };
  }
}

/**
 * Membaca J1 & J2 dengan fallback pemindaian Kolom J jika J1/J2 belum terisi di sel utama
 */
function extractLinksFromRekapSheet(sheet) {
  let valJ1 = getCellUrlValue(sheet, 'J1');
  let valJ2 = getCellUrlValue(sheet, 'J2');

  // Scanning Fallback jika sel J1 atau J2 kosong
  if (!valJ1 || !valJ2) {
    try {
      const maxRows = Math.min(sheet.getLastRow(), 15);
      if (maxRows > 0) {
        const foundUrls = [];
        for (let r = 1; r <= maxRows; r++) {
          const cellVal = getCellUrlValue(sheet, 'J' + r);
          if (cellVal && cellVal.length > 5) {
            foundUrls.push(cellVal);
          }
        }
        if (!valJ1 && foundUrls.length > 0) valJ1 = foundUrls[0];
        if (!valJ2 && foundUrls.length > 1) valJ2 = foundUrls[1];
      }
    } catch (err) {
      Logger.log('Error scanning column J: ' + err.toString());
    }
  }

  const procJ1 = processImageUrl(valJ1);
  const procJ2 = processImageUrl(valJ2);

  return {
    linkJ1: procJ1.rawUrl,
    displayJ1: procJ1.displayUrl,
    embedJ1: procJ1.embedUrl,
    linkJ2: procJ2.rawUrl,
    displayJ2: procJ2.displayUrl,
    embedJ2: procJ2.embedUrl
  };
}

/**
 * Helper khusus membaca Running Text / Pengumuman dari Sheet "RekapDashboard"
 * Membaca sel M1/M2 (Kolom M / Column 13) dan sekitarnya
 */
function getRekapDashboardRunningText() {
  let runningText = '';
  try {
    let sheet = findSheetByNameFlexible('RekapDashboard');
    if (!sheet) {
      // Direct fallback lookup pada spreadsheet utama
      const ss = typeof getDb === 'function' ? getDb() : SpreadsheetApp.getActiveSpreadsheet();
      if (ss) {
        sheet = ss.getSheetByName('RekapDashboard') || ss.getSheetByName('Rekap Dashboard') || ss.getSheetByName('REKAPDASHBOARD');
      }
    }

    if (sheet) {
      // 0. Otomatis inisialisasi / tulis sel M1 & M2 di Sheet RekapDashboard jika sel masih kosong
      try {
        const m1Val = String(sheet.getRange(1, 13).getValue() || '').trim();
        const m2Val = String(sheet.getRange(2, 13).getValue() || '').trim();
        if (!m1Val && !m2Val) {
          sheet.getRange(1, 13).setValue('RUNNING TEXT');
          sheet.getRange(2, 13).setValue('Selamat Datang di System Portal Fath Indah. Informasi dan data statistik SDM/Karyawan terintegrasi secara real-time dari Sheet RekapDashboard.');
          SpreadsheetApp.flush();
        }
      } catch (errInit) {
        Logger.log('Error write M1/M2: ' + errInit.toString());
      }

      // Pembacaan langsung sel M2, M1, M3, N1, N2
      const valM2 = String(sheet.getRange('M2').getDisplayValue() || '').trim();
      const valM1 = String(sheet.getRange('M1').getDisplayValue() || '').trim();
      const valM3 = String(sheet.getRange('M3').getDisplayValue() || '').trim();
      const valN1 = String(sheet.getRange('N1').getDisplayValue() || '').trim();
      const valN2 = String(sheet.getRange('N2').getDisplayValue() || '').trim();

      const isHeaderLabel = (str) => {
        if (!str) return false;
        const l = str.toLowerCase().replace(/[^a-z0-9]/g, '');
        return l === 'runningtext' || l === 'pengumuman' || l === 'info' || l === 'header' || l === 'title' || l === 'judul';
      };

      // Kasus 1: Sel M2 berisi teks pengumuman
      if (valM2 && !isHeaderLabel(valM2)) {
        if (valM1 && !isHeaderLabel(valM1) && valM1.toLowerCase() !== valM2.toLowerCase()) {
          return valM1 + ' — ' + valM2;
        }
        return valM2;
      }

      // Kasus 2: Sel M1 berisi teks pengumuman
      if (valM1 && !isHeaderLabel(valM1)) {
        return valM1;
      }

      // Kasus 3: Sel N1 atau N2 berisi teks
      if (valN1 && !isHeaderLabel(valN1)) return valN1;
      if (valN2 && !isHeaderLabel(valN2)) return valN2;

      // Kasus 4: Sel M3 berisi teks
      if (valM3 && !isHeaderLabel(valM3)) return valM3;

      // Fallback jika sel terisi nilai (walaupun persis kata header)
      if (valM2) return valM2;
      if (valM1) return valM1;
    }
  } catch (e) {
    Logger.log('Error getRekapDashboardRunningText: ' + e.toString());
  }

  return 'Selamat Datang di System Portal Fath Indah. Informasi dan data statistik SDM/Karyawan terintegrasi secara real-time dari Sheet RekapDashboard.';
}

/**
 * API khusus untuk memperbarui Running Text di Sheet RekapDashboard sel M1 & M2
 */
function apiSaveRunningText(text, token) {
  try {
    let sheet = findSheetByNameFlexible('RekapDashboard');
    if (!sheet) {
      const ss = typeof getDb === 'function' ? getDb() : SpreadsheetApp.getActiveSpreadsheet();
      if (ss) {
        sheet = ss.getSheetByName('RekapDashboard') || ss.getSheetByName('Rekap Dashboard') || ss.getSheetByName('REKAPDASHBOARD');
      }
    }
    if (!sheet) return { success: false, message: 'Sheet RekapDashboard tidak ditemukan!' };

    sheet.getRange(1, 13).setValue('RUNNING TEXT');
    sheet.getRange(2, 13).setValue(String(text || '').trim());
    SpreadsheetApp.flush();

    return { success: true, message: 'Running text berhasil diperbarui di Sheet RekapDashboard (M1/M2)' };
  } catch (e) {
    return { success: false, message: 'Gagal memperbarui running text: ' + e.message };
  }
}

// 6. Dashboard Stats API
function apiGetDashboardStats(token) {
  let users = [];
  let logs = [];
  let modules = [];
  let employees = [];

  const dashboardLinks = getRekapDashboardLinks();
  const runningText = getRekapDashboardRunningText();

  try { users = getSheetData(CONFIG.SHEETS.USERS) || []; } catch (e) {}
  try { logs = getSheetData(CONFIG.SHEETS.ACTIVITY_LOGS) || []; } catch (e) {}
  try { modules = getSheetData(CONFIG.SHEETS.MODULES) || []; } catch (e) {}
  try {
    employees = getLiveBioKaryawanData();
    if (!employees || employees.length === 0) {
      employees = getSheetData('Bio Karyawan') || [];
    }
  } catch (e) {
    employees = [];
  }

  const activeUsers = users.filter(u => String(u.Status || '').toLowerCase() === 'active').length;
  const activeModules = modules.filter(m => String(m.Status || '').toLowerCase() === 'active').length;
  
  const todayStr = new Date().toDateString();
  const todayLogs = logs.filter(l => {
    if (!l.Timestamp) return false;
    const logDate = new Date(l.Timestamp).toDateString();
    return logDate === todayStr;
  }).length;

  // 1. Status Karyawan (Cari pada Sheet RekapDashboard di Kolom 1 yang sesuai dengan Judul "STATUS KARYAWAN", lalu ambil data Aktif & Resign/Keluar)
  let activeEmployees = 0;
  let exitedEmployees = 0;
  let totalEmployeesRekap = 0;
  let foundInRekap = false;

  try {
    const sheetRekap = findSheetByNameFlexible('RekapDashboard');
    if (sheetRekap && sheetRekap.getLastRow() >= 1) {
      const rawData = sheetRekap.getDataRange().getValues();

      for (let r = 0; r < rawData.length; r++) {
        const row = rawData[r];
        if (!row || row.length === 0) continue;

        // Ambil isi Kolom 1 (Index 0)
        const col1Val = String(row[0] || '').trim();
        const col1Lower = col1Val.toLowerCase();

        // Match 1: Kolom 1 berisi Judul "STATUS KARYAWAN" atau "STATUS"
        if (col1Lower.includes('status karyawan') || col1Lower === 'status' || col1Lower.includes('status_karyawan')) {
          // Opsi 1.1: Baris sama (Kolom 2 = Aktif, Kolom 3 = Resign/Keluar, Kolom 4 = Total)
          const rowActive = parseInt(String(row[1] || '').trim(), 10);
          const rowExited = parseInt(String(row[2] || '').trim(), 10);
          const rowTotal  = parseInt(String(row[3] || '').trim(), 10);

          if (!isNaN(rowActive)) { activeEmployees = rowActive; foundInRekap = true; }
          if (!isNaN(rowExited)) { exitedEmployees = rowExited; foundInRekap = true; }
          if (!isNaN(rowTotal))  { totalEmployeesRekap = rowTotal; }

          // Opsi 1.2: Baris-baris di bawah Judul "STATUS KARYAWAN" di mana Kolom 1 berisi "Aktif" / "Resign"
          for (let subR = r + 1; subR < Math.min(r + 8, rawData.length); subR++) {
            const subRow = rawData[subR];
            if (!subRow || subRow.length === 0) continue;
            const subCol1 = String(subRow[0] || '').trim().toLowerCase();

            // Ambil angka dari Kolom 2 atau sel pertama bermuatan angka
            let numInSubRow = 0;
            for (let c = 1; c < subRow.length; c++) {
              const parsedVal = parseInt(String(subRow[c] || '').trim(), 10);
              if (!isNaN(parsedVal)) { numInSubRow = parsedVal; break; }
            }

            if (subCol1.includes('aktif') && !subCol1.includes('tidak') && !subCol1.includes('non')) {
              activeEmployees = numInSubRow;
              foundInRekap = true;
            } else if (subCol1.includes('resign') || subCol1.includes('keluar') || subCol1.includes('tidak aktif') || subCol1.includes('non aktif')) {
              exitedEmployees = numInSubRow;
              foundInRekap = true;
            } else if (subCol1.includes('total')) {
              totalEmployeesRekap = numInSubRow;
              foundInRekap = true;
            }
          }
        }

        // Match 2: Kolom 1 sendiri secara langsung menyebutkan "Aktif" atau "Resign" / "Keluar"
        if (col1Lower.includes('aktif') && !col1Lower.includes('tidak') && !col1Lower.includes('non') && !col1Lower.includes('status')) {
          for (let c = 1; c < row.length; c++) {
            const num = parseInt(String(row[c] || '').trim(), 10);
            if (!isNaN(num)) { activeEmployees = num; foundInRekap = true; break; }
          }
        } else if (col1Lower.includes('resign') || col1Lower.includes('keluar')) {
          for (let c = 1; c < row.length; c++) {
            const num = parseInt(String(row[c] || '').trim(), 10);
            if (!isNaN(num)) { exitedEmployees = num; foundInRekap = true; break; }
          }
        }
      }
    }
  } catch (e) {
    foundInRekap = false;
  }

  // Fallback ke Sheet Bio Karyawan jika RekapDashboard belum ada atau tidak berikan nilai
  if (!foundInRekap) {
    employees.forEach(e => {
      const rawStatus = getRowValue(e, ['status', 'status karyawan', 'status_karyawan', 'statuskaryawan']);
      if (rawStatus !== '') {
        exitedEmployees++; // Terisi => Resign
      } else {
        activeEmployees++; // Kosong => Aktif
      }
    });
  }

  // 2. Gender Breakdown (Aturan: Dari Header 'Jenis Kelamin')
  let maleCount = 0;
  let femaleCount = 0;
  employees.forEach(e => {
    const g = getRowValue(e, ['jenis kelamin', 'jeniskelamin', 'jenis_kelamin', 'gender', 'jk', 'kelamin']).toLowerCase();
    if (g.includes('laki') || g.includes('pria') || g === 'l') {
      maleCount++;
    } else if (g.includes('perempuan') || g.includes('wanita') || g === 'p') {
      femaleCount++;
    }
  });

  // 3. Demografi Usia (Aturan: Selisih tahun antara Header 'Tanggal Lahir' dan tahun saat ini)
  const currentYear = new Date().getFullYear();
  const ageGroups = {
    under25: 0,  // < 25 th
    age25_34: 0, // 25-34 th
    age35_44: 0, // 35-44 th
    age45_54: 0, // 45-54 th
    above55: 0   // >= 55 th
  };

  let totalAge = 0;
  let ageCount = 0;

  employees.forEach(e => {
    const birthVal = getRowValue(e, ['tanggal lahir', 'tgl lahir', 'tanggallahir', 'tgl_lahir', 'birthdate', 'birth_date', '_col47']);
    if (birthVal) {
      const birthDate = new Date(birthVal);
      if (!isNaN(birthDate.getTime())) {
        const age = currentYear - birthDate.getFullYear(); // Selisih tahun saja
        if (age >= 0 && age < 100) {
          totalAge += age;
          ageCount++;
          if (age < 25) ageGroups.under25++;
          else if (age <= 34) ageGroups.age25_34++;
          else if (age <= 44) ageGroups.age35_44++;
          else if (age <= 54) ageGroups.age45_54++;
          else ageGroups.above55++;
        }
      }
    }
  });

  const avgAge = ageCount > 0 ? Math.round(totalAge / ageCount) : 0;

  // 4. Pendidikan Terakhir (Aturan: Dari Header 'Pendidikan Terakhir')
  const eduMap = {};
  employees.forEach(e => {
    const edu = getRowValue(e, ['pendidikan terakhir', 'pendidikan_terakhir', 'pendidikan', 'ijazah', 'pend']);
    if (edu) {
      eduMap[edu] = (eduMap[edu] || 0) + 1;
    }
  });

  // 5. Golongan Darah (Aturan: Dari Header 'Golongan Darah')
  const bloodMap = { 'A': 0, 'B': 0, 'AB': 0, 'O': 0, 'Lainnya': 0 };
  employees.forEach(e => {
    const b = getRowValue(e, ['golongan darah', 'gol. darah', 'gol darah', 'golongan_darah', 'goldarah']).toUpperCase();
    if (['A', 'B', 'AB', 'O'].includes(b)) {
      bloodMap[b]++;
    } else if (b) {
      bloodMap['Lainnya']++;
    }
  });

  // Distribusi Lokasi Domisili (Provinsi / Kota)
  const locMap = {};
  employees.forEach(e => {
    const loc = getRowValue(e, ['provinsi', 'kabupaten/kota', 'kabupaten', 'kota', 'lokasi', 'domisili']);
    if (loc) {
      locMap[loc] = (locMap[loc] || 0) + 1;
    }
  });

  // Hitung tren aktivitas 7 hari terakhir
  const logTrends = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toDateString();
    const formattedLabel = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    const count = logs.filter(l => l.Timestamp && new Date(l.Timestamp).toDateString() === dateStr).length;
    logTrends.push({ date: formattedLabel, count: count });
  }

  // Distribusi Role User
  const roleDist = {
    Admin: users.filter(u => String(u.Role).toLowerCase() === 'admin').length,
    Manager: users.filter(u => String(u.Role).toLowerCase() === 'manager').length,
    Staff: users.filter(u => String(u.Role).toLowerCase() === 'staff').length
  };

  const sortedLogs = logs.slice().sort((a,b) => new Date(b.Timestamp || 0) - new Date(a.Timestamp || 0)).slice(0, 7);

  return {
    success: true,
    stats: {
      totalUsers: users.length,
      activeUsers: activeUsers,
      totalModules: modules.length,
      activeModules: activeModules,
      todayActivities: todayLogs,
      totalLogs: logs.length,
      totalEmployees: totalEmployeesRekap || (activeEmployees + exitedEmployees) || employees.length,
      totalBioRecord: employees.length,
      activeEmployees: activeEmployees,
      exitedEmployees: exitedEmployees,
      maleEmployees: maleCount,
      femaleEmployees: femaleCount,
      avgAge: avgAge,
      linkJ1: dashboardLinks.linkJ1,
      displayJ1: dashboardLinks.displayJ1,
      embedJ1: dashboardLinks.embedJ1,
      linkJ2: dashboardLinks.linkJ2,
      displayJ2: dashboardLinks.displayJ2,
      embedJ2: dashboardLinks.embedJ2,
      runningText: runningText
    },
    linkJ1: dashboardLinks.linkJ1,
    displayJ1: dashboardLinks.displayJ1,
    embedJ1: dashboardLinks.embedJ1,
    linkJ2: dashboardLinks.linkJ2,
    displayJ2: dashboardLinks.displayJ2,
    embedJ2: dashboardLinks.embedJ2,
    runningText: runningText,
    genderDist: { male: maleCount, female: femaleCount },
    ageDist: ageGroups,
    educationDist: eduMap,
    locationDist: locMap,
    bloodTypeDist: bloodMap,
    roleDist: roleDist,
    logTrends: logTrends,
    recentLogs: sortedLogs
  };
}

// 7. Sample Plug-and-Play Module APIs (Inventaris & Keuangan)
function apiGetInventorySampleData(token) {
  const sessionCheck = validateSession(token);
  if (!sessionCheck.valid) return { success: false, message: 'Sesi berakhir' };
  
  // Contoh data inventaris
  const sampleInventory = [
    { code: 'BRG-001', name: 'Laptop Dell Latitude 5420', category: 'Elektronik', qty: 24, unit: 'Unit', location: 'Gudang A', status: 'Tersedia' },
    { code: 'BRG-002', name: 'Monitor LG 27 Inch 4K', category: 'Elektronik', qty: 15, unit: 'Unit', location: 'Gudang A', status: 'Tersedia' },
    { code: 'BRG-003', name: 'Kursi Kerja Ergonomis Mesh', category: 'Meubel', qty: 45, unit: 'Pcs', location: 'Gudang B', status: 'Tersedia' },
    { code: 'BRG-004', name: 'Meja Kerja Office 120x60', category: 'Meubel', qty: 30, unit: 'Pcs', location: 'Gudang B', status: 'Tersedia' },
    { code: 'BRG-005', name: 'Printer HP LaserJet Pro M404', category: 'Elektronik', qty: 5, unit: 'Unit', location: 'Gudang A', status: 'Hampir Habis' }
  ];
  return { success: true, data: sampleInventory };
}

function apiGetFinanceSampleData(token) {
  const sessionCheck = validateSession(token);
  if (!sessionCheck.valid) return { success: false, message: 'Sesi berakhir' };
  
  // Contoh data keuangan
  const sampleFinance = [
    { transId: 'TRX-901', date: '2026-08-20', type: 'Pemasukan', category: 'Penjualan Layanan', amount: 155000000, description: 'Pembayaran Project Client A', status: 'Lunas' },
    { transId: 'TRX-902', date: '2026-08-21', type: 'Pengeluaran', category: 'Operasional Kantor', amount: 12500000, description: 'Pembayaran Tagihan Listrik & Internet', status: 'Lunas' },
    { transId: 'TRX-903', date: '2026-08-22', type: 'Pengeluaran', category: 'Gaji Karyawan', amount: 85000000, description: 'Payroll Periode Agustus 2026', status: 'Lunas' },
    { transId: 'TRX-904', date: '2026-08-23', type: 'Pemasukan', category: 'Penjualan Lisensi', amount: 45000000, description: 'Perpanjangan Lisensi Software', status: 'Lunas' }
  ];
  return { success: true, data: sampleFinance };
}

// 8. Modul Entry Bio Karyawan APIs (mod_bio_karyawan)
function apiGetBioKaryawanSchema(token) {
  const sessionCheck = validateSession(token);
  if (!sessionCheck.valid) return { success: false, message: 'Sesi berakhir' };
  return getBioKaryawanHeadersData();
}

function apiSaveBioKaryawan(formData, token) {
  const sessionCheck = validateSession(token);
  if (!sessionCheck.valid) return { success: false, message: 'Sesi berakhir' };
  const res = saveBioKaryawanRecordData(formData);
  if (res.success) {
    logActivity(sessionCheck.session.username, 'CREATE_BIO_KARYAWAN', 'Bio Karyawan', 'Menambahkan Bio Karyawan: ' + (formData['Nama Lengkap'] || formData['NIK'] || ''));
  }
  return res;
}

function apiLookupKodepos(kodepos, token) {
  const sessionCheck = validateSession(token);
  if (!sessionCheck.valid) return { success: false, message: 'Sesi berakhir' };
  return lookupKodeposData(kodepos);
}

function apiGetBioKaryawanList(token, forceRefresh) {
  const sessionCheck = validateSession(token);
  if (!sessionCheck.valid) return { success: false, message: 'Sesi berakhir' };
  return getBioKaryawanList(forceRefresh);
}

function apiGetKodePosList(token, forceRefresh) {
  const sessionCheck = validateSession(token);
  if (!sessionCheck.valid) return { success: false, message: 'Sesi berakhir' };
  return getKodePosSheetData(forceRefresh);
}

// 8.5. Modul Lihat Slip Gaji APIs (mod_slip_gaji)
function apiGetSlipGajiList(token, forceRefresh) {
  const sessionCheck = validateSession(token);
  if (!sessionCheck.valid) return { success: false, message: 'Sesi berakhir' };
  return getSlipGajiListForUser(token, forceRefresh);
}

// 9. Modul Upload Dokumen Karyawan APIs (mod_upload_dok)
function apiUploadEmployeeDocument(filePayload, token) {
  let uploaderName = 'User Karyawan';
  try {
    const sessionCheck = validateSession(token);
    if (sessionCheck && sessionCheck.valid && sessionCheck.session) {
      uploaderName = sessionCheck.session.username || sessionCheck.session.nama || 'User Karyawan';
    } else {
      if (typeof Session !== 'undefined') {
        const email = Session.getActiveUser().getEmail() || Session.getEffectiveUser().getEmail();
        if (email) uploaderName = email.split('@')[0];
      }
    }
  } catch (eSes) {}
  
  if (!filePayload || typeof filePayload !== 'object') {
    return { success: false, message: 'Payload file tidak valid.' };
  }
  
  filePayload.uploader = uploaderName;
  const res = uploadEmployeeDocument(filePayload);
  if (res.success) {
    try {
      logActivity(
        uploaderName, 
        'UPLOAD_DOCUMENT', 
        'Upload Dokumen', 
        'Mengunggah berkas ' + (filePayload.jenisDokumen || 'Dokumen') + ' untuk ' + (filePayload.namaKaryawan || 'Karyawan')
      );
    } catch (eLog) {}
  }
  return res;
}

function apiGetUploadDokList(token, forceRefresh) {
  const sessionCheck = validateSession(token);
  if (!sessionCheck.valid) return { success: false, message: 'Sesi berakhir' };
  return getUploadDokList(forceRefresh);
}

function apiGetUploadDocParameters(token) {
  const sessionCheck = validateSession(token);
  const uploaderUser = sessionCheck && sessionCheck.valid ? sessionCheck.session : null;
  return getUploadDocParameters(uploaderUser);
}

function apiDeleteUploadDok(docId, token) {
  const sessionCheck = validateSession(token);
  if (!sessionCheck.valid) return { success: false, message: 'Sesi berakhir' };
  const res = deleteUploadDokRecord(docId);
  if (res.success) {
    logActivity(sessionCheck.session.username, 'DELETE_DOCUMENT', 'Upload Dokumen', 'Menghapus dokumen ID: ' + docId);
  }
  return res;
}

function apiGetEmployeeDetail(token, empIdentifier) {
  const sessionCheck = validateSession(token);
  if (!sessionCheck.valid) return { success: false, message: 'Sesi berakhir' };
  return getEmployeeDetailData(empIdentifier);
}

// 10. Modul Input Data Hotel APIs (mod_input_hotel)
function apiGetHotels(token) {
  const sessionCheck = validateSession(token);
  if (!sessionCheck.valid) return { success: false, message: 'Sesi telah berakhir' };
  const data = getHotelList();
  return { success: true, data: data };
}

function apiSaveHotel(hotelData, filePayloadBrochure, token) {
  const sessionCheck = validateSession(token);
  if (!sessionCheck.valid) return { success: false, message: 'Sesi telah berakhir' };

  if (!hotelData.userInput && sessionCheck.session) {
    hotelData.userInput = sessionCheck.session.fullName || sessionCheck.session.username || 'Admin';
  }

  const res = saveHotelRecordBatch(hotelData, filePayloadBrochure);
  if (res.success) {
    logActivity(
      sessionCheck.session.username,
      'SAVE_HOTEL',
      'Input Data Hotel',
      'Menyimpan/update data hotel ' + (hotelData.namahotel || '') + ' (' + (res.idhotel || '') + ')'
    );
  }
  return res;
}

function apiDeleteHotel(idHotel, token) {
  const sessionCheck = validateSession(token);
  if (!sessionCheck.valid) return { success: false, message: 'Sesi telah berakhir' };
  const res = deleteHotelRecord(idHotel);
  if (res.success) {
    logActivity(
      sessionCheck.session.username,
      'DELETE_HOTEL',
      'Input Data Hotel',
      'Menghapus data hotel ID ' + idHotel
    );
  }
  return res;
}

function apiUploadHotelDoc(fileBase64, fileName, mimeType, token) {
  const sessionCheck = validateSession(token);
  if (!sessionCheck.valid) return { success: false, message: 'Sesi telah berakhir' };
  return uploadHotelDocument(fileBase64, fileName, mimeType);
}

function apiGetDriveBrochures(token) {
  const sessionCheck = validateSession(token);
  if (!sessionCheck.valid) return { success: false, message: 'Sesi telah berakhir' };
  return getDriveBrochureFiles();
}

// 11. Modul Input Data Penerbangan APIs (mod_input_flight)
function apiGetFlightList(token) {
  const sessionCheck = validateSession(token);
  if (!sessionCheck.valid) return { success: false, message: 'Sesi telah berakhir' };
  return getFlightList();
}

function apiSaveFlightData(flightData, token) {
  const sessionCheck = validateSession(token);
  if (!sessionCheck.valid) return { success: false, message: 'Sesi telah berakhir' };

  if (!flightData.userInput && sessionCheck.session) {
    flightData.userInput = sessionCheck.session.fullName || sessionCheck.session.username || 'Admin';
  }

  const res = saveFlightData(flightData);
  if (res.success) {
    logActivity(
      sessionCheck.session.username,
      'SAVE_FLIGHT',
      'Input Data Penerbangan',
      'Menyimpan/update data penerbangan PNR ' + (flightData.pnrCode || '') + ' (' + (res.id || '') + ')'
    );
  }
  return res;
}

function apiDeleteFlightData(idflight, token) {
  const sessionCheck = validateSession(token);
  if (!sessionCheck.valid) return { success: false, message: 'Sesi telah berakhir' };
  const res = deleteFlightData(idflight);
  if (res.success) {
    logActivity(
      sessionCheck.session.username,
      'DELETE_FLIGHT',
      'Input Data Penerbangan',
      'Menghapus data penerbangan ID ' + idflight
    );
  }
  return res;
}

// 12. Modul Input Data Jamaah & Pembayaran APIs (mod_input_jamaah)
function apiSaveJamaahPayment(paymentData, token) {
  const sessionCheck = validateSession(token);
  if (!sessionCheck.valid) return { success: false, message: 'Sesi telah berakhir' };

  const userActive = (sessionCheck.session && (sessionCheck.session.fullName || sessionCheck.session.username)) || 'Admin';
  return saveJamaahPayment(paymentData, userActive);
}

function apiGetPaymentHistory(jamaahId, token) {
  const sessionCheck = validateSession(token);
  if (!sessionCheck.valid) return { success: false, message: 'Sesi telah berakhir' };
  return getPaymentHistory(jamaahId);
}

function apiDeleteJamaahPayment(kwitansiId, token) {
  const sessionCheck = validateSession(token);
  if (!sessionCheck.valid) return { success: false, message: 'Sesi telah berakhir' };

  const userActive = (sessionCheck.session && (sessionCheck.session.fullName || sessionCheck.session.username)) || 'Admin';
  return deleteJamaahPayment(kwitansiId, userActive);
}

// 13. Modul Cuti Karyawan & Cuti Bersama APIs (mod_cuti_karyawan & mod_cuti_bersama)
function apiGetCutiList(token, forceRefresh) {
  const sessionCheck = validateSession(token);
  if (!sessionCheck.valid) return { success: false, message: 'Sesi telah berakhir' };
  return getCutiListData(forceRefresh);
}

function apiSaveCutiRequest(formData, token) {
  const sessionCheck = validateSession(token);
  if (!sessionCheck.valid) return { success: false, message: 'Sesi telah berakhir' };

  const userActive = (sessionCheck.session && (sessionCheck.session.fullName || sessionCheck.session.username)) || 'User';
  const res = saveCutiRequestData(formData, userActive);
  if (res.success) {
    logActivity(
      sessionCheck.session.username,
      'SAVE_CUTI',
      'Cuti Karyawan',
      'Pengajuan cuti ' + (formData.tipeCuti || 'Cuti') + ' untuk ' + (formData.namaKaryawan || 'Karyawan')
    );
  }
  return res;
}

function apiUpdateCutiStatus(cutiId, status, catatan, token, linkDokumen) {
  const sessionCheck = validateSession(token);
  if (!sessionCheck.valid || (sessionCheck.session.role !== 'Admin' && sessionCheck.session.role !== 'Manager')) {
    return { success: false, message: 'Akses ditolak. Membutuhkan hak akses Admin atau Manager!' };
  }

  const approver = sessionCheck.session.fullName || sessionCheck.session.username || 'Admin';
  const res = updateCutiStatusData(cutiId, status, catatan, approver, linkDokumen);
  if (res.success) {
    logActivity(
      sessionCheck.session.username,
      'APPROVAL_CUTI',
      'Cuti Karyawan',
      'Mengubah status cuti ' + cutiId + ' menjadi ' + status
    );
  }
  return res;
}

function apiDeleteCutiRequest(cutiId, token) {
  const sessionCheck = validateSession(token);
  if (!sessionCheck.valid || sessionCheck.session.role !== 'Admin') {
    return { success: false, message: 'Akses ditolak. Membutuhkan hak akses Admin!' };
  }

  const res = deleteCutiRequestData(cutiId);
  if (res.success) {
    logActivity(sessionCheck.session.username, 'DELETE_CUTI', 'Cuti Karyawan', 'Menghapus pengajuan cuti ID: ' + cutiId);
  }
  return res;
}

function apiGetCutiBersamaList(token, year) {
  const sessionCheck = validateSession(token);
  if (!sessionCheck.valid) return { success: false, message: 'Sesi telah berakhir' };
  return getCutiBersamaListData(year);
}

function apiSaveCutiBersama(formData, token) {
  const sessionCheck = validateSession(token);
  if (!sessionCheck.valid || (sessionCheck.session.role !== 'Admin' && sessionCheck.session.role !== 'Manager')) {
    return { success: false, message: 'Akses ditolak. Membutuhkan hak akses Admin atau Manager!' };
  }

  const res = saveCutiBersamaData(formData);
  if (res.success) {
    logActivity(
      sessionCheck.session.username,
      'SAVE_CUTI_BERSAMA',
      'Cuti Bersama',
      'Menyimpan Cuti Bersama: ' + (formData.namaHariLibur || '') + ' (' + (formData.tahun || '') + ')'
    );
  }
  return res;
}

function apiDeleteCutiBersama(id, token) {
  const sessionCheck = validateSession(token);
  if (!sessionCheck.valid || sessionCheck.session.role !== 'Admin') {
    return { success: false, message: 'Akses ditolak. Membutuhkan hak akses Admin!' };
  }

  const res = deleteCutiBersamaData(id);
  if (res.success) {
    logActivity(sessionCheck.session.username, 'DELETE_CUTI_BERSAMA', 'Cuti Bersama', 'Menghapus Cuti Bersama ID: ' + id);
  }
  return res;
}

function apiGetCutiSummary(token, year) {
  const sessionCheck = validateSession(token);
  if (!sessionCheck.valid) return { success: false, message: 'Sesi telah berakhir' };
  return getCutiSummaryData(year);
}

// 18. API Data Paket
function apiGetPaketList(token) {
  try {
    const data = getPaketDataList();
    return { success: true, data: data || [] };
  } catch (e) {
    Logger.log('Error apiGetPaketList: ' + e.message);
    return { success: false, message: 'Gagal mengambil data paket: ' + e.message };
  }
}

function apiGetDashProgList(token) {
  try {
    const res = getDashProgDataList();
    if (res && typeof res === 'object' && res.success !== undefined) {
      return res;
    }
    return { success: true, headers: [], data: Array.isArray(res) ? res : [] };
  } catch (e) {
    Logger.log('Error apiGetDashProgList: ' + e.message);
    return { success: false, headers: [], data: [], message: 'Gagal mengambil data DashProg: ' + e.message };
  }
}

function apiSavePaket(formData, token) {
  try {
    const sessionCheck = validateSession(token);
    if (!sessionCheck.valid) {
      return { success: false, message: 'Sesi telah berakhir. Silakan login kembali.' };
    }

    const res = savePaketData(formData);
    if (res.success && sessionCheck.session) {
      try {
        logActivity(
          sessionCheck.session.username || 'user',
          'SAVE_PAKET',
          'Data Paket',
          'Menyimpan Data Paket: ' + (formData.namaPaket || '') + ' (' + (res.idPaket || '') + ')'
        );
      } catch (logErr) {}
    }
    return res;
  } catch (e) {
    Logger.log('Error apiSavePaket: ' + e.message);
    return { success: false, message: 'Gagal menyimpan paket: ' + e.message };
  }
}

function apiDeletePaket(idPaket, token) {
  try {
    const sessionCheck = validateSession(token);
    if (!sessionCheck.valid) {
      return { success: false, message: 'Sesi telah berakhir. Silakan login kembali.' };
    }

    const res = deletePaketData(idPaket);
    if (res.success && sessionCheck.session) {
      try {
        logActivity(sessionCheck.session.username || 'user', 'DELETE_PAKET', 'Data Paket', 'Menghapus Data Paket ID: ' + idPaket);
      } catch (logErr) {}
    }
    return res;
  } catch (e) {
    Logger.log('Error apiDeletePaket: ' + e.message);
    return { success: false, message: 'Gagal menghapus paket: ' + e.message };
  }
}

function apiGetKanwilList(token) {
  try {
    const list = getKanwilListFromSheet();
    return { success: true, data: list };
  } catch (e) {
    Logger.log('Error apiGetKanwilList: ' + e.message);
    return { success: false, data: [], message: e.message };
  }
}

function apiSaveRequestSeat(formData, token) {
  try {
    const sessionCheck = validateSession(token);
    const user = sessionCheck.valid ? sessionCheck.session : null;
    const res = saveRequestSeatData(formData, user);
    return res;
  } catch (e) {
    Logger.log('Error apiSaveRequestSeat: ' + e.message);
    return { success: false, message: 'Gagal mengajukan request seat: ' + e.message };
  }
}

function apiGetRequestSeatList(idPaket, token) {
  try {
    const res = getRequestSeatList(idPaket);
    return res;
  } catch (e) {
    Logger.log('Error apiGetRequestSeatList: ' + e.message);
    return { success: false, data: [], message: e.message };
  }
}

function apiDeleteRequestSeat(idRequest, token) {
  try {
    const sessionCheck = validateSession(token);
    const user = sessionCheck.valid ? sessionCheck.session : null;
    const res = deleteRequestSeatData(idRequest, user);
    return res;
  } catch (e) {
    Logger.log('Error apiDeleteRequestSeat: ' + e.message);
    return { success: false, message: 'Gagal menghapus request seat: ' + e.message };
  }
}

// 24. Modul Entry Angsuran Haji APIs (mod_entry_angsuran_haji)
function apiGetAngsuranHajiList(token) {
  const sessionCheck = validateSession(token);
  if (!sessionCheck.valid) return { success: false, message: 'Sesi telah berakhir' };
  return getAngsuranHajiListData();
}

function apiGetJamaahHajiList(token) {
  const sessionCheck = validateSession(token);
  if (!sessionCheck.valid) return { success: false, message: 'Sesi telah berakhir' };
  return getJamaahHajiListData();
}

function apiSaveAngsuranHaji(formData, token) {
  const sessionCheck = validateSession(token);
  if (!sessionCheck.valid) return { success: false, message: 'Sesi telah berakhir' };
  return saveAngsuranHajiData(formData, sessionCheck.session);
}

function apiSaveBatchAngsuranHaji(batchItems, token) {
  const sessionCheck = validateSession(token);
  if (!sessionCheck.valid) return { success: false, message: 'Sesi telah berakhir' };
  return saveBatchAngsuranHajiData(batchItems, sessionCheck.session);
}

function apiDeleteAngsuranHaji(id, token) {
  const sessionCheck = validateSession(token);
  if (!sessionCheck.valid) return { success: false, message: 'Sesi melepaskan otorisasi' };
  return deleteAngsuranHajiData(id, sessionCheck.session);
}

function apiUploadAngsuranDocFile(filePayload, token) {
  const sessionCheck = validateSession(token);
  if (!sessionCheck.valid) return { success: false, message: 'Sesi telah berakhir' };
  return uploadAngsuranDocFile(filePayload, sessionCheck.session);
}

// 25. Modul View Jamaah Haji API (mod_view_jamaah_haji)
function apiGetViewJamaahHajiData(token) {
  try {
    const sessionCheck = validateSession(token);
    if (!sessionCheck || !sessionCheck.valid) {
      Logger.log('apiGetViewJamaahHajiData note: session check bypass/guest mode');
    }
  } catch (e) {}
  return getViewJamaahHajiData();
}

// 26. Modul Update Status BIPIH API (mod_update_status_bipih)
function apiGetUpdateStatusBipihData(token) {
  try {
    const sessionCheck = validateSession(token);
    if (!sessionCheck || !sessionCheck.valid) {
      Logger.log('apiGetUpdateStatusBipihData note: guest mode');
    }
  } catch (e) {}
  return getUpdateStatusBipihData();
}

function apiSaveUpdateStatusBipih(token, payload, filePayloadBukti, filePayloadTunda, filePayloadPk) {
  let activeUser = 'Admin';
  try {
    const sessionCheck = validateSession(token);
    if (sessionCheck && sessionCheck.valid && sessionCheck.user) {
      activeUser = sessionCheck.user.fullName || sessionCheck.user.username || 'Admin';
    }
  } catch (e) {}
  return saveUpdateStatusBipihRecord(payload, filePayloadBukti, filePayloadTunda, filePayloadPk, activeUser);
}

function apiUpdateStatusBipihRecord(token, idTransaksi, payload) {
  let activeUser = 'Admin';
  try {
    const sessionCheck = validateSession(token);
    if (sessionCheck && sessionCheck.valid && sessionCheck.user) {
      activeUser = sessionCheck.user.fullName || sessionCheck.user.username || 'Admin';
    }
  } catch (e) {}
  return updateUpdateStatusBipihRecord(idTransaksi, payload, activeUser);
}

function apiDeleteStatusBipihRecord(token, idTransaksi) {
  try {
    const sessionCheck = validateSession(token);
    if (!sessionCheck || !sessionCheck.valid) {
      Logger.log('apiDeleteStatusBipihRecord note: guest mode');
    }
  } catch (e) {}
  return deleteUpdateStatusBipihRecord(idTransaksi);
}

// ==========================================
// MOD_VIEW_HOTEL_BROCHURE API
// ==========================================

function apiGetHotelBrochureOptions(token) {
  const sessionCheck = validateSession(token);
  if (!sessionCheck.valid) return { success: false, message: 'Sesi telah berakhir' };
  return getHotelBrochureFilterOptions();
}

function apiSearchHotelBrochureData(filterPayload, token) {
  const sessionCheck = validateSession(token);
  if (!sessionCheck.valid) return { success: false, message: 'Sesi telah berakhir' };
  return searchHotelBrochureData(filterPayload);
}


// ==========================================
// MOD_ESTIMASI_KEBERANGKATAN API
// ==========================================

function apiGetEstimasiList(token) {
  const sessionCheck = validateSession(token);
  if (!sessionCheck.valid) return { success: false, message: 'Sesi telah berakhir' };
  return getEstimasiKeberangkatanList();
}

function apiSaveEstimasi(token, rowIndex, estimasiValue) {
  const sessionCheck = validateSession(token);
  if (!sessionCheck.valid) return { success: false, message: 'Sesi telah berakhir' };
  const user = sessionCheck.session ? (sessionCheck.session.fullName || sessionCheck.session.username) : 'Admin';
  return saveEstimasiBerangkat(rowIndex, estimasiValue, user);
}

function apiGetHistoryEstimasiList(token, noPorsi) {
  const sessionCheck = validateSession(token);
  if (!sessionCheck.valid) return { success: false, message: 'Sesi telah berakhir', data: [] };
  return { success: true, data: getHistoryEstimasiKeberangkatanList(noPorsi) };
}

// ==========================================
// MOD_PEMBAYARAN_GROUP & TERPADU API
// ==========================================
function apiGetAgenListWithPaket(token) {
  return getAgenListWithPaket();
}

function apiSaveKolektifPayment(token, data) {
  let userActive = 'Admin';
  try {
    const sessionCheck = validateSession(token);
    if (sessionCheck && sessionCheck.valid && sessionCheck.session) {
      userActive = sessionCheck.session.fullName || sessionCheck.session.username || 'Admin';
    }
  } catch (e) {}
  return saveKolektifPayment(data, userActive);
}

// ==========================================
// MOD_KELENGKAPAN_UMRAH API (mod_kelengkapan_umrah)
// ==========================================
function apiGetKelengkapanUmrahData(token) {
  const sessionCheck = validateSession(token);
  if (!sessionCheck.valid) return { success: false, message: 'Sesi telah berakhir' };
  return getKelengkapanUmrahData();
}

function apiSaveKelengkapanUmrah(payload, filePayloads, token) {
  const sessionCheck = validateSession(token);
  if (!sessionCheck.valid) return { success: false, message: 'Sesi telah berakhir' };
  const user = sessionCheck.session ? (sessionCheck.session.fullName || sessionCheck.session.username) : 'Admin';
  const res = saveKelengkapanUmrah(payload, filePayloads, user);
  if (res && res.success) {
    logActivity(
      sessionCheck.session.username,
      'SAVE_KELENGKAPAN_UMRAH',
      'Kelengkapan Data Umrah',
      'Menyimpan kelengkapan data & dokumen Umrah untuk ' + (payload.namaJamaah || '') + ' (' + (payload.idJamaah || '') + ')'
    );
  }
  return res;
}

function apiDeleteKelengkapanUmrah(idJamaah, token) {
  const sessionCheck = validateSession(token);
  if (!sessionCheck.valid) return { success: false, message: 'Sesi telah berakhir' };
  const res = deleteKelengkapanUmrah(idJamaah);
  if (res && res.success) {
    logActivity(
      sessionCheck.session.username,
      'DELETE_KELENGKAPAN_UMRAH',
      'Kelengkapan Data Umrah',
      'Menghapus kelengkapan data Umrah Jamaah ID ' + idJamaah
    );
  }
  return res;
}



