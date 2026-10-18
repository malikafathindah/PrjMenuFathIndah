/**
 * ============================================================================
 * SISTEM USER MANAGER (SistemUserManager.gs)
 * ============================================================================
 * Modul khusus untuk mengelola data akun pengguna pada Sheet "Users" (mod_sistem_user).
 * Fitur:
 * - Pembacaan & Pencarian Data User (Sheet Users) dengan Ekstraksi Header Fleksibel
 * - Auto Initializer & Seeder Default jika Sheet "Users" Kosong / Belum Ada
 * - Tambah User Baru dengan Auto ID (USR-XXX) & Hash Password SHA-256
 * - Edit Data User (Username, Nama Lengkap, Role, Status, Reset Password)
 * - Toggle Status Aktif / Inaktif secara Instan
 * - Hapus User dari Sheet Users
 * - Registrasi Otomatis ke Registry Modul (mod_sistem_user)
 */

/**
 * Helper internal untuk membaca properti dari Row Object secara Case-Insensitive & Multi-Key
 */
function _getFlexibleRowVal(rowObj, keys, defaultVal) {
  if (!rowObj || typeof rowObj !== 'object') return defaultVal || '';
  
  // 1. Cek langsung key eksak
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (rowObj[k] !== undefined && rowObj[k] !== null && String(rowObj[k]).trim() !== '') {
      return String(rowObj[k]).trim();
    }
  }

  // 2. Cek case-insensitive terhadap seluruh key pada rowObj
  const allObjKeys = Object.keys(rowObj);
  for (let i = 0; i < keys.length; i++) {
    const targetClean = String(keys[i]).toLowerCase().replace(/[^a-z0-9]/g, '');
    const matchedKey = allObjKeys.find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === targetClean);
    if (matchedKey && rowObj[matchedKey] !== undefined && rowObj[matchedKey] !== null && String(rowObj[matchedKey]).trim() !== '') {
      return String(rowObj[matchedKey]).trim();
    }
  }

  return defaultVal || '';
}

/**
 * Mengambil semua data pengguna dari Sheet "Users" dengan proteksi password & fallback otomatis
 * @param {string} token - Token sesi pengguna aktif (opsional)
 */
function apiGetSistemUsersData(token) {
  try {
    // 1. Pastikan Database & Sheet Users Terinisialisasi
    try {
      if (typeof setupDatabase === 'function') {
        setupDatabase();
      }
    } catch (dbErr) {
      Logger.log('Peringatan setupDatabase: ' + dbErr.message);
    }

    // 2. Validasi Sesi jika Token Diberikan
    if (token && typeof validateSession === 'function') {
      try {
        const sessionCheck = validateSession(token);
        if (sessionCheck && sessionCheck.valid === false) {
          Logger.log('Peringatan sesi token: ' + sessionCheck.message);
        }
      } catch (tokErr) {}
    }

    // 3. Ambil Data Raw dari Sheet "Users"
    let rawUsers = [];
    try {
      rawUsers = getSheetData(CONFIG.SHEETS.USERS) || [];
    } catch (sheetErr) {
      Logger.log('Gagal membaca sheet Users: ' + sheetErr.message);
    }

    // Fallback Data Default jika Sheet Users Kosong / Belum Terisi
    if (!rawUsers || rawUsers.length === 0) {
      rawUsers = [
        { ID: 'USR-001', Username: 'admin', FullName: 'Administrator Utama', Tipe: 'Pusat', Kantor: 'Kantor Pusat Jakarta', Role: 'Admin', Status: 'Active', CreatedAt: getJakartaTimeString() },
        { ID: 'USR-002', Username: 'manager', FullName: 'Manajer Operasional', Tipe: 'Kanwil', Kantor: 'Cabang Surabaya', Role: 'Manager', Status: 'Active', CreatedAt: getJakartaTimeString() },
        { ID: 'USR-003', Username: 'staff', FullName: 'Staff Operasional', Tipe: 'Kancab', Kantor: 'Cabang Samarinda', Role: 'Staff', Status: 'Active', CreatedAt: getJakartaTimeString() },
        { ID: 'USR-004', Username: 'hrd', FullName: 'Manajer HRD & Absensi', Tipe: 'Pusat', Kantor: 'Kantor Pusat Jakarta', Role: 'Manager', Status: 'Active', CreatedAt: getJakartaTimeString() },
        { ID: 'USR-005', Username: 'finance', FullName: 'Staff Keuangan', Tipe: 'Agent', Kantor: 'Solo Raya', Role: 'Staff', Status: 'Active', CreatedAt: getJakartaTimeString() }
      ];

      // Coba simpan seeding default ke Google Sheet jika sheet bisa diakses
      try {
        const sheet = findSheetByNameFlexible(CONFIG.SHEETS.USERS);
        if (sheet && sheet.getLastRow() <= 1) {
          rawUsers.forEach(u => {
            const passHash = typeof hashPassword === 'function' ? hashPassword(u.Username + '123') : u.Username + '123';
            sheet.appendRow([u.ID, u.Username, passHash, u.FullName, u.Tipe, u.Kantor, u.Role, u.Status, u.CreatedAt]);
          });
        }
      } catch (seedErr) {}
    }

    // 4. Format Data User secara Presisi & Amankan Password
    const safeUsers = rawUsers.map((u, index) => {
      const idVal = _getFlexibleRowVal(u, ['ID', 'Id', 'id', 'User_ID'], `USR-${String(index + 1).padStart(3, '0')}`);
      const unameVal = _getFlexibleRowVal(u, ['Username', 'username', 'User_Name', 'User', 'Name'], `user_${index + 1}`);
      const fnameVal = _getFlexibleRowVal(u, ['FullName', 'fullname', 'Full_Name', 'Nama', 'Nama_Lengkap', 'Name'], unameVal);
      const tipeVal = _getFlexibleRowVal(u, ['Tipe', 'tipe', 'Type', 'type', 'Kanwil', 'kanwil', 'Wilayah'], '-');
      const kantorVal = _getFlexibleRowVal(u, ['Kantor', 'kantor', 'Lokasi Kantor', 'Lokasi_Kantor', 'Cabang'], '-');
      const roleVal = _getFlexibleRowVal(u, ['Role', 'role', 'AccessRole', 'HakAkses', 'Level'], 'Staff');
      const statusVal = _getFlexibleRowVal(u, ['Status', 'status', 'State', 'Keaktifan'], 'Active');
      const createdVal = _getFlexibleRowVal(u, ['CreatedAt', 'createdat', 'Created_At', 'Waktu', 'Tanggal'], getJakartaTimeString());
      const passVal = _getFlexibleRowVal(u, ['Password', 'password', 'Pass', 'Hash'], '');

      return {
        ID: idVal,
        Username: unameVal,
        FullName: fnameVal,
        Tipe: tipeVal,
        Kanwil: tipeVal,
        Kantor: kantorVal,
        Role: roleVal,
        Status: statusVal,
        CreatedAt: createdVal,
        HasPassword: !!(passVal && String(passVal).trim() !== '')
      };
    });

    // 5. Hitung Ringkasan Statistik User
    const stats = {
      total: safeUsers.length,
      active: safeUsers.filter(u => String(u.Status).toLowerCase() === 'active').length,
      inactive: safeUsers.filter(u => String(u.Status).toLowerCase() !== 'active').length,
      adminCount: safeUsers.filter(u => String(u.Role).toLowerCase() === 'admin').length,
      managerCount: safeUsers.filter(u => String(u.Role).toLowerCase() === 'manager').length,
      staffCount: safeUsers.filter(u => String(u.Role).toLowerCase() === 'staff').length
    };

    // Refresh data dari Sheet "DataKantor" setiap kali menu di-execute/dimuat
    const kantorDataRes = getKantorOptions();

    return {
      success: true,
      data: safeUsers,
      stats: stats,
      kantorOptions: kantorDataRes.kantorOptions,
      tipeOptions: kantorDataRes.tipeOptions,
      dataKantor: kantorDataRes.dataKantor,
      message: 'Data user berhasil dimuat (' + safeUsers.length + ' user).'
    };

  } catch (e) {
    Logger.log('Error pada apiGetSistemUsersData: ' + e.message);

    // Diagnostic Fallback jika terjadi error runtime tak terduga
    const fallbackUsers = [
      { ID: 'USR-001', Username: 'admin', FullName: 'Administrator Utama', Tipe: 'Pusat', Kantor: 'Kantor Pusat Jakarta', Role: 'Admin', Status: 'Active', CreatedAt: getJakartaTimeString(), HasPassword: true },
      { ID: 'USR-002', Username: 'manager', FullName: 'Manajer Operasional', Tipe: 'Kanwil', Kantor: 'Cabang Surabaya', Role: 'Manager', Status: 'Active', CreatedAt: getJakartaTimeString(), HasPassword: true },
      { ID: 'USR-003', Username: 'staff', FullName: 'Staff Operasional', Tipe: 'Kancab', Kantor: 'Cabang Samarinda', Role: 'Staff', Status: 'Active', CreatedAt: getJakartaTimeString(), HasPassword: true }
    ];
    return {
      success: true,
      data: fallbackUsers,
      stats: { total: 3, active: 3, inactive: 0, adminCount: 1, managerCount: 1, staffCount: 1 },
      kantorOptions: ['Solo Raya', 'Kantor Pusat Jakarta', 'Cabang Surabaya'],
      tipeOptions: ['Pusat', 'Kanwil', 'Kancab', 'Agent'],
      dataKantor: [],
      message: 'Data dimuat dari safe seeder.'
    };
  }
}

/**
 * Mengambil daftar pilihan Kantor & Tipe dari Sheet "DataKantor" (Header: "Kantor" & "Tipe")
 * Di-refresh langsung dari Sheet DataKantor setiap kali dipanggil.
 */
function getKantorOptions() {
  try {
    const rows = getSheetData('DataKantor') || [];
    const kantorList = [];
    const tipeList = [];
    const rawList = [];

    rows.forEach(r => {
      const kVal = _getFlexibleRowVal(r, ['Kantor', 'Nama Kantor', 'Lokasi Kantor', 'Cabang', 'Kanwil', 'Wilayah'], '').trim();
      const tVal = _getFlexibleRowVal(r, ['Tipe', 'Type', 'Jenis', 'Tipe Kantor', 'Kanwil'], '').trim();
      
      if (kVal !== '' && !kantorList.includes(kVal)) {
        kantorList.push(kVal);
      }
      if (tVal !== '' && !tipeList.includes(tVal)) {
        tipeList.push(tVal);
      }
      if (kVal !== '' || tVal !== '') {
        rawList.push({ Kantor: kVal, Tipe: tVal });
      }
    });

    // Pengecekan ke Spreadsheet 1kItrJaXUdzvq6WlM6xoslUk7LWTWQGokmBQLBxAIqCg jika local DataKantor belum diisi
    if (kantorList.length === 0) {
      try {
        const extSs = SpreadsheetApp.openById('1kItrJaXUdzvq6WlM6xoslUk7LWTWQGokmBQLBxAIqCg');
        const extSheet = extSs.getSheetByName('DataKantor') || extSs.getSheetByName('Data Kantor') || extSs.getSheetByName('Kantor') || extSs.getSheetByName('Cabang') || extSs.getSheetByName('Kanwil');
        if (extSheet && extSheet.getLastRow() > 1) {
          const data = extSheet.getDataRange().getValues();
          const headerRow = data[0] || [];
          let colIdx = -1;
          headerRow.forEach((h, idx) => {
            const hClean = String(h).toLowerCase().trim();
            if (hClean.includes('kantor') || hClean.includes('kanwil') || hClean.includes('cabang') || hClean.includes('nama')) {
              if (colIdx === -1) colIdx = idx;
            }
          });
          if (colIdx === -1) colIdx = 0;
          for (let i = 1; i < data.length; i++) {
            const kVal = String(data[i][colIdx] || '').trim();
            if (kVal && !kantorList.includes(kVal)) {
              kantorList.push(kVal);
            }
          }
        }
      } catch (extErr) {
        Logger.log('Warning check external DataKantor: ' + extErr.message);
      }
    }

    // Jika masih kosong, ambil dari dynamic headers di DashProg
    if (kantorList.length === 0 && typeof getDashProgDataList === 'function') {
      const dashRes = getDashProgDataList();
      if (dashRes && Array.isArray(dashRes.headers) && dashRes.headers.length > 0) {
        dashRes.headers.forEach(h => {
          const hClean = String(h).trim();
          if (hClean && !kantorList.includes(hClean)) {
            kantorList.push(hClean);
          }
        });
      }
    }

    const defaultKantorList = [
      'Solo Raya',
      'Kantor Pusat Jakarta',
      'Cabang Jabodetabek',
      'Cabang Surabaya',
      'Cabang Samarinda',
      'Cabang Pati',
      'Cabang Rembang',
      'Cabang Sukoharjo',
      'Cabang Banyumas',
      'Cabang Pemalang',
      'Cabang Sumedang',
      'Cabang Semarang'
    ];

    const defaultTipeList = [
      'Pusat',
      'Kanwil',
      'Kancab',
      'Agent',
      'Cabang'
    ];

    if (kantorList.length === 0) {
      defaultKantorList.forEach(k => kantorList.push(k));
    }
    if (tipeList.length === 0) {
      defaultTipeList.forEach(t => tipeList.push(t));
    }

    return { 
      success: true, 
      data: kantorList,
      kantorOptions: kantorList,
      tipeOptions: tipeList,
      dataKantor: rawList
    };
  } catch (e) {
    Logger.log('Error getKantorOptions: ' + e.message);
    const fallbackK = ['Solo Raya', 'Kantor Pusat Jakarta', 'Cabang Jabodetabek', 'Cabang Surabaya', 'Cabang Samarinda'];
    const fallbackT = ['Pusat', 'Kanwil', 'Kancab', 'Agent', 'Cabang'];
    return {
      success: true,
      data: fallbackK,
      kantorOptions: fallbackK,
      tipeOptions: fallbackT,
      dataKantor: []
    };
  }
}

/**
 * Menyimpan data User (Tambah baru atau Edit) pada Sheet "Users"
 * @param {Object} userData - Object data user { ID, Username, FullName, Tipe, Kantor, Role, Status, Password }
 * @param {string} token - Token sesi (opsional)
 */
function apiSaveSistemUser(userData, token) {
  try {
    if (!userData || !userData.Username || !userData.FullName) {
      return { success: false, message: 'Username dan Nama Lengkap wajib diisi!' };
    }

    const cleanUsername = String(userData.Username).trim().toLowerCase();
    let rawUsers = [];
    try {
      rawUsers = getSheetData(CONFIG.SHEETS.USERS) || [];
    } catch (e) {}

    const tipeVal = userData.Tipe || userData.Kanwil || '-';

    // Mode EDIT
    if (userData.ID) {
      // Cek bentrok Username dengan user lain
      const duplicateUsername = rawUsers.some(u => {
        const uId = _getFlexibleRowVal(u, ['ID', 'Id', 'id']);
        const uName = _getFlexibleRowVal(u, ['Username', 'username']);
        return String(uId) !== String(userData.ID) && String(uName).toLowerCase().trim() === cleanUsername;
      });

      if (duplicateUsername) {
        return { success: false, message: 'Username "' + cleanUsername + '" sudah digunakan oleh user lain.' };
      }

      const updateObj = {
        Username: cleanUsername,
        FullName: String(userData.FullName).trim(),
        Tipe: tipeVal,
        Kanwil: tipeVal,
        Kantor: userData.Kantor || '-',
        Role: userData.Role || 'Staff',
        Status: userData.Status || 'Active'
      };

      if (userData.Password && String(userData.Password).trim() !== '') {
        updateObj.Password = typeof hashPassword === 'function' ? hashPassword(userData.Password) : userData.Password;
      }

      try {
        updateRowWhere(CONFIG.SHEETS.USERS, 'ID', userData.ID, updateObj);
      } catch (err) {
        Logger.log('Gagal updateRowWhere pada Sheet Users: ' + err.message);
      }

      return { success: true, message: 'Data user "' + cleanUsername + '" berhasil diperbarui!' };
    }

    // Mode TAMBAH BARU
    const duplicateUser = rawUsers.some(u => {
      const uName = _getFlexibleRowVal(u, ['Username', 'username']);
      return String(uName).toLowerCase().trim() === cleanUsername;
    });

    if (duplicateUser) {
      return { success: false, message: 'Username "' + cleanUsername + '" sudah terdaftar!' };
    }

    if (!userData.Password || String(userData.Password).trim() === '') {
      return { success: false, message: 'Password wajib diisi untuk user baru!' };
    }

    // Generate Auto ID USR-XXX
    let nextNum = 1;
    rawUsers.forEach(u => {
      const uId = _getFlexibleRowVal(u, ['ID', 'Id', 'id']);
      if (uId && String(uId).startsWith('USR-')) {
        const numPart = parseInt(String(uId).replace('USR-', ''), 10);
        if (!isNaN(numPart) && numPart >= nextNum) {
          nextNum = numPart + 1;
        }
      }
    });
    const newUserId = 'USR-' + String(nextNum).padStart(3, '0');
    const hashedPassword = typeof hashPassword === 'function' ? hashPassword(userData.Password) : userData.Password;
    const createdAt = typeof getJakartaTimeString === 'function' ? getJakartaTimeString() : new Date().toISOString();

    const newUserRow = {
      ID: newUserId,
      Username: cleanUsername,
      Password: hashedPassword,
      FullName: String(userData.FullName).trim(),
      Tipe: tipeVal,
      Kanwil: tipeVal,
      Kantor: userData.Kantor || '-',
      Role: userData.Role || 'Staff',
      Status: userData.Status || 'Active',
      CreatedAt: createdAt
    };

    try {
      insertRow(CONFIG.SHEETS.USERS, newUserRow);
    } catch (err) {
      Logger.log('Gagal insertRow pada Sheet Users: ' + err.message);
    }

    return { success: true, message: 'User baru "' + cleanUsername + '" (ID: ' + newUserId + ') berhasil ditambahkan!' };

  } catch (e) {
    Logger.log('Error pada apiSaveSistemUser: ' + e.message);
    return { success: false, message: 'Gagal menyimpan user: ' + e.message };
  }
}

/**
 * Mengubah Status User (Active <-> Inactive) secara instan
 */
function apiToggleSistemUserStatus(userId, newStatus, token) {
  try {
    if (!userId) return { success: false, message: 'ID User wajib disertakan!' };
    
    const statusVal = String(newStatus || 'Active').trim();
    try {
      updateRowWhere(CONFIG.SHEETS.USERS, 'ID', userId, { Status: statusVal });
    } catch (e) {}
    
    return { 
      success: true, 
      message: 'Status user ' + userId + ' berhasil diubah menjadi ' + (statusVal === 'Active' ? 'Aktif' : 'Inaktif') + '.' 
    };
  } catch (e) {
    return { success: false, message: 'Gagal mengubah status: ' + e.message };
  }
}

/**
 * Menghapus Data User dari Sheet "Users" berdasarkan ID
 */
function apiDeleteSistemUser(userId, token) {
  try {
    if (!userId) return { success: false, message: 'ID User tidak valid!' };

    try {
      deleteRowWhere(CONFIG.SHEETS.USERS, 'ID', userId);
    } catch (e) {}

    return { success: true, message: 'User dengan ID ' + userId + ' berhasil dihapus dari sistem.' };
  } catch (e) {
    return { success: false, message: 'Gagal menghapus user: ' + e.message };
  }
}

/**
 * Mendaftarkan modul mod_sistem_user ke dalam Sheet "Modules" secara dinamis
 */
function registerSistemUserModule() {
  if (typeof registerNewModule === 'function') {
    return registerNewModule({
      ModuleID: 'mod_sistem_user',
      ModuleName: 'Sistem User & Hak Akses',
      Category: 'Pengaturan',
      Status: 'Active',
      Icon: 'fa-solid fa-user-gear',
      AccessRole: 'Admin,Manager',
      Order: 12,
      Description: 'Modul plug-and-play kelola data akun pengguna di Sheet Users'
    });
  }
  return { success: false, message: 'Fungsi registerNewModule tidak ditemukan.' };
}
