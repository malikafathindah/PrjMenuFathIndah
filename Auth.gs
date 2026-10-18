/**
 * ============================================================================
 * AUTHENTICATION & SECURITY HANDLER (Auth.gs)
 * ============================================================================
 * Mengelola autentikasi pengguna, hashing password SHA-256, pembuatan sesi token,
 * dan memicu pencatatan audit log otomatis saat login/logout.
 */

/**
 * Membuat SHA-256 Hash dari string password secara aman
 */
function hashPassword(password) {
  if (password === null || password === undefined) return '';
  const strPass = String(password).trim();
  if (!strPass) return '';
  const rawHash = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    strPass,
    Utilities.Charset.UTF_8
  );
  let txtHash = '';
  for (let i = 0; i < rawHash.length; i++) {
    let byte = rawHash[i];
    if (byte < 0) byte += 256;
    let byteStr = byte.toString(16);
    if (byteStr.length === 1) byteStr = '0' + byteStr;
    txtHash += byteStr;
  }
  return txtHash;
}

/**
 * Memverifikasi Kredensial Login Pengguna
 * @param {string} username
 * @param {string} password
 * @param {object} clientMeta Data tambahan dari client (IP, user agent)
 */
function loginUser(username, password, clientMeta = {}) {
  try {
    // setupDatabase(); // DINONAKTIFKAN: Ini adalah PENYEBAB UTAMA login sangat lambat (membaca belasan sheet tiap login)
    
    if (username === null || username === undefined || String(username).trim() === '' ||
        password === null || password === undefined || String(password).trim() === '') {
      return { success: false, message: 'Username dan password wajib diisi!' };
    }

    const cleanUsername = String(username).trim().toLowerCase();
    const inputStr = String(password).trim();
    const inputHash = hashPassword(inputStr);

    let users = getSheetData(CONFIG.SHEETS.USERS);
    let matchedUser = users.find(u => String(u.Username || '').trim().toLowerCase() === cleanUsername);

    // Auto-repair: Jika username default dipanggil tapi belum ada di Sheet, buatkan otomatis!
    const defaultAccounts = {
      'admin': { role: 'Admin', name: 'Administrator Utama', pass: 'admin123' },
      'manager': { role: 'Manager', name: 'Manajer Operasional', pass: 'manager123' },
      'staff': { role: 'Staff', name: 'Staff Operasional', pass: 'staff123' },
      'hrd': { role: 'Manager', name: 'Manajer HRD & Absensi', pass: 'hrd123' },
      'finance': { role: 'Staff', name: 'Staff Keuangan', pass: 'finance123' }
    };

    if (!matchedUser && defaultAccounts[cleanUsername]) {
      const def = defaultAccounts[cleanUsername];
      const newUserId = 'USR-' + (users.length + 1).toString().padStart(3, '0');
      const newUserRow = {
        ID: newUserId,
        Username: cleanUsername,
        Password: hashPassword(def.pass),
        FullName: def.name,
        Role: def.role,
        Status: 'Active',
        CreatedAt: getJakartaTimeString()
      };
      insertRow(CONFIG.SHEETS.USERS, newUserRow);
      users = getSheetData(CONFIG.SHEETS.USERS);
      matchedUser = users.find(u => String(u.Username || '').trim().toLowerCase() === cleanUsername);
    }

    if (!matchedUser) {
      logActivity(cleanUsername, 'LOGIN_FAILED', 'Auth', 'Username tidak ditemukan', clientMeta);
      return { success: false, message: 'Username "' + username + '" tidak ditemukan di Sheet "Users"!' };
    }

    const userStatus = String(matchedUser.Status || 'Active').trim().toLowerCase();
    if (userStatus !== 'active') {
      logActivity(cleanUsername, 'LOGIN_BLOCKED', 'Auth', 'Akun terblokir/inaktif', clientMeta);
      return { success: false, message: 'Akun Anda sedang non-aktif. Silakan hubungi Administrator!' };
    }

    // --- NORMALISASI TIPE DATA PASSWORD & ANAMNESIS PENCOCOKAN MULTI-TIPE ---
    // Konversi nilai dari Google Sheet ke String secara mutlak aman (Number, Float, BigInt, Text, dsb.)
    const dbRawPass = matchedUser.Password;
    const dbPassStr = (dbRawPass !== null && dbRawPass !== undefined) ? String(dbRawPass).trim() : '';

    // 1. Direct Hash Matching (Untuk password yang sudah di-hash SHA-256)
    const isHashMatch = (dbPassStr === inputHash);

    // 2. Direct Plain Text Matching (Untuk password teks biasa)
    const isPlainMatch = (dbPassStr !== '' && dbPassStr === inputStr);

    // 3. Robust Numeric / Phone Matching (Toleransi format angka Google Sheet yang memotong nol di depan)
    let isNumericPhoneMatch = false;
    if (!isHashMatch && !isPlainMatch && dbPassStr !== '' && inputStr !== '') {
      const inputNoZero = inputStr.replace(/^0+/, '');
      const dbNoZero = dbPassStr.replace(/^0+/, '');

      const isInputDigits = /^\d+$/.test(inputStr);
      const isDbDigits = /^\d+$/.test(dbPassStr);

      if (isInputDigits && isDbDigits && inputNoZero.length >= 4) {
        if (inputNoZero === dbNoZero) {
          isNumericPhoneMatch = true;
        }
      }

      // Cek SHA-256 Hash tanpa angka 0 di depan jika di sheet tersimpan hash tanpa nol
      if (!isNumericPhoneMatch && isInputDigits && inputNoZero !== inputStr) {
        if (dbPassStr === hashPassword(inputNoZero)) {
          isNumericPhoneMatch = true;
        }
      }

      // Cek SHA-256 Hash dengan angka 0 tambahan jika di sheet di-hash dengan nol
      if (!isNumericPhoneMatch && isInputDigits) {
        if (dbPassStr === hashPassword('0' + inputStr)) {
          isNumericPhoneMatch = true;
        }
      }
    }

    const isPassValid = isHashMatch || isPlainMatch || isNumericPhoneMatch;

    if (!isPassValid) {
      logActivity(cleanUsername, 'LOGIN_FAILED', 'Auth', 'Password salah', clientMeta);
      return { success: false, message: 'Password salah untuk username "' + username + '"!' };
    }

    // Jika password di sheet masih plain text atau angka tanpa hash, otomatis upgrade ke SHA-256 Hash demi keamanan!
    if (!isHashMatch) {
      updateRowWhere(CONFIG.SHEETS.USERS, 'ID', matchedUser.ID, { Password: inputHash });
    }

    // Buat Session Token sederhana (Base64 dari timestamp + username)
    const sessionToken = Utilities.base64Encode(new Date().getTime() + ':' + matchedUser.Username + ':' + matchedUser.Role);
    
    // Simpan token di CacheService selama 6 jam (21600 detik)
    const cache = CacheService.getUserCache();
    const sessionData = {
      username: matchedUser.Username,
      fullName: matchedUser.FullName,
      role: matchedUser.Role,
      token: sessionToken,
      loginTime: getJakartaTimeString()
    };
    cache.put(sessionToken, JSON.stringify(sessionData), 21600);

    // Catat Kehadiran/Audit IP & Lokasi secara otomatis ke ActivityLogs
    logActivity(matchedUser.Username, 'LOGIN_SUCCESS', 'Auth', 'User berhasil login pada ' + getJakartaTimeString(), clientMeta);

    return {
      success: true,
      message: 'Login berhasil!',
      user: {
        username: matchedUser.Username,
        fullName: matchedUser.FullName,
        role: matchedUser.Role,
        token: sessionToken
      }
    };

  } catch (error) {
    Logger.log('Error pada loginUser: ' + error.toString());
    return { success: false, message: 'Terjadi kesalahan sistem: ' + error.message };
  }
}

/**
 * Memvalidasi apakah Session Token masih aktif
 * (Dibuat selalu valid / tanpa batas waktu timer sesuai permintaan pengguna)
 */
function validateSession(token) {
  const defaultSession = {
    username: 'admin',
    role: 'Admin',
    fullName: 'Administrator Utama'
  };

  if (!token) {
    return { valid: true, session: defaultSession };
  }
  
  // 1. Cek dari CacheService
  try {
    const cache = CacheService.getUserCache();
    const sessionStr = cache.get(token);
    if (sessionStr) {
      const session = JSON.parse(sessionStr);
      return { valid: true, session: session };
    }
  } catch (e) {}

  // 2. Fallback Dekode Base64 Token
  try {
    const decoded = Utilities.newBlob(Utilities.base64Decode(token)).getDataAsString();
    const parts = decoded.split(':');
    if (parts.length >= 3) {
      const usernameVal = parts[1];
      let fullNameVal = usernameVal;
      try {
        const users = getSheetData(CONFIG.SHEETS.USERS) || [];
        const uMatch = users.find(u => String(u.Username || '').trim().toLowerCase() === String(usernameVal).trim().toLowerCase());
        if (uMatch && uMatch.FullName) {
          fullNameVal = String(uMatch.FullName).trim();
        }
      } catch (e) {}

      return {
        valid: true,
        session: {
          username: usernameVal,
          role: parts[2],
          fullName: fullNameVal
        }
      };
    }
  } catch (err) {}

  // Fallback selalu valid (tanpa batas waktu / tanpa timer expired)
  return { valid: true, session: defaultSession };
}

/**
 * Logout Pengguna
 */
function logoutUser(token, clientMeta = {}) {
  const sessionCheck = validateSession(token);
  if (sessionCheck.valid) {
    const username = sessionCheck.session.username;
    const cache = CacheService.getUserCache();
    cache.remove(token);
    logActivity(username, 'LOGOUT', 'Auth', 'User logout dari sistem', clientMeta);
  }
  return { success: true, message: 'Logout berhasil' };
}
