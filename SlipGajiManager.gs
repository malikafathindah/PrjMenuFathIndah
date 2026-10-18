/**
 * ============================================================================
 * SLIP GAJI MANAGER (SlipGajiManager.gs)
 * ============================================================================
 * Modul khusus mengelola dan mengambil dokumen Slip Gaji dari Google Drive
 * - Folder ID: 1x_JaEF8qE-bxAkRqs5xMXvQZeyDEaRYt
 * - Menyaring berkas berdasarkan Nama Lengkap (FullName) pengguna yang login
 * - Memberikan URL Preview PDF untuk ditayangkan langsung pada kartu pratinjau
 */

const SLIP_GAJI_FOLDER_ID = '1fXIwxUVijMdQ3urXKmqP1zDdI0e695Z-';

/**
 * Mengambil daftar dokumen Slip Gaji dari Google Drive sesuai dengan Nama Lengkap (FullName)
 * @param {string} userToken - Token sesi pengguna yang login
 * @param {boolean} forceRefresh - Paksa baca ulang dari Drive tanpa cache
 * @returns {Object} JSON result { success, data, message }
 */
function getSlipGajiListForUser(userToken, forceRefresh) {
  try {
    const sessionCheck = validateSession(userToken);
    if (!sessionCheck.valid) {
      return { success: false, message: 'Sesi telah berakhir, silakan login kembali.' };
    }

    const sessionUser = sessionCheck.session || {};
    const username = String(sessionUser.username || '').trim();
    const userRole = String(sessionUser.role || '').toLowerCase();
    let fullName = String(sessionUser.fullName || '').trim();

    // Pastikan FullName diambil secara tepat dari Sheet Users jika fullName kosong atau sama dengan username
    if (!fullName || fullName.toLowerCase() === username.toLowerCase()) {
      try {
        const users = getSheetData(CONFIG.SHEETS.USERS) || [];
        const uMatch = users.find(u => String(u.Username || '').trim().toLowerCase() === username.toLowerCase());
        if (uMatch && uMatch.FullName) {
          fullName = String(uMatch.FullName).trim();
        }
      } catch (e) {}
    }

    if (!fullName) fullName = username || 'User';

    const cacheKey = 'SLIP_GAJI_CACHE_' + username.toUpperCase();
    const cache = CacheService.getScriptCache();

    if (!forceRefresh) {
      const cachedData = cache.get(cacheKey);
      if (cachedData) {
        try {
          return { success: true, data: JSON.parse(cachedData), source: 'cache', user: fullName };
        } catch (e) {}
      }
    }

    let folder;
    try {
      folder = DriveApp.getFolderById(SLIP_GAJI_FOLDER_ID);
    } catch (e) {
      return { 
        success: false, 
        message: 'Folder Google Drive Slip Gaji (ID: ' + SLIP_GAJI_FOLDER_ID + ') tidak ditemukan atau akses ditolak.' 
      };
    }

    const files = folder.getFiles();
    const resultList = [];

    // Normalisasi FullName untuk pencarian (case-insensitive, hapus karakter khusus)
    const targetFullName = fullName.toLowerCase();
    const cleanFullName = targetFullName.replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
    const nameParts = cleanFullName.split(' ').filter(p => p.length >= 2);

    const isAdmin = (userRole === 'admin' || userRole === 'administrator utama');

    while (files.hasNext()) {
      const file = files.next();
      const fileName = file.getName();
      const fileNameLower = fileName.toLowerCase();
      const cleanFileName = fileNameLower.replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
      const fileId = file.getId();

      // Pencocokan berkas berdasarkan FullName pengguna
      let isMatch = false;

      if (isAdmin) {
        // Jika Admin, tampilkan seluruh berkas slip gaji di folder
        isMatch = true;
      } else {
        // Pencocokan 1: Substring langsung nama lengkap pada nama berkas
        if (fileNameLower.includes(targetFullName) || cleanFileName.includes(cleanFullName)) {
          isMatch = true;
        } 
        // Pencocokan 2: Jika terdiri dari beberapa kata, pastikan seluruh kata kunci utama FullName ada pada nama berkas
        else if (nameParts.length > 0) {
          isMatch = nameParts.every(part => cleanFileName.includes(part) || fileNameLower.includes(part));
        }
      }

      if (isMatch) {
        const fileUrl = file.getUrl();
        const embedUrl = 'https://drive.google.com/file/d/' + fileId + '/preview';
        const downloadUrl = 'https://drive.google.com/uc?export=download&id=' + fileId;
        const createdDate = file.getDateCreated();
        const updatedDate = file.getLastUpdated();

        resultList.push({
          id: fileId,
          fileName: fileName,
          mimeType: file.getMimeType(),
          created: createdDate ? Utilities.formatDate(createdDate, 'Asia/Jakarta', 'yyyy-MM-dd HH:mm') : '-',
          createdIso: createdDate ? createdDate.toISOString() : '',
          updated: updatedDate ? Utilities.formatDate(updatedDate, 'Asia/Jakarta', 'yyyy-MM-dd HH:mm') : '-',
          size: Math.round(file.getSize() / 1024) + ' KB',
          fileUrl: fileUrl,
          embedUrl: embedUrl,
          downloadUrl: downloadUrl,
          ownerName: fullName
        });
      }
    }

    // Sort descending berdasarkan tanggal buat / nama file
    resultList.sort((a, b) => (b.createdIso || b.fileName).localeCompare(a.createdIso || a.fileName));

    // Cache hasil selama 10 menit
    try {
      cache.put(cacheKey, JSON.stringify(resultList), 600);
    } catch (e) {}

    return {
      success: true,
      data: resultList,
      user: fullName,
      total: resultList.length
    };

  } catch (err) {
    return {
      success: false,
      message: 'Gagal membaca dokumen Slip Gaji dari Google Drive: ' + err.toString()
    };
  }
}

