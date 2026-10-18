/**
 * ============================================================================
 * JAMAAH UPLOAD DOCUMENT MANAGER (JamaahUploadDocManager.gs)
 * ============================================================================
 * Modul khusus mengelola unggahan dokumen Jamaah (mod_upload_dok_jamaah)
 * - Menyimpan berkas fisik ke Google Drive Folder ID per Jenis Dokumen Jamaah
 * - Format penamaan file otomatis: "ID Jamaah - Nama Lengkap - Jenis Dokumen.ext"
 * - Mencatat metadata & URL link ke Sheet "UploadDokJamaah"
 * - Fitur pembacaan list dokumen terdaftar & penghapusan berkas
 */

var CONFIG_UPLOAD_DOC_JAMAAH = {
  FOLDER_ID: '12hJY5VGcTlgdSBHRqOxSLYg_zwB4C0gF',
  SHEET_NAME: 'UploadDokJamaah',
  FOLDER_IDS: {
    /* 1. Bukti Transfer */
    "Bukti Transfer": "1lHO7hPfyj6-512vovUNfvVcLbLQhTWIv",
    "Upload Bukti Transfer": "1lHO7hPfyj6-512vovUNfvVcLbLQhTWIv",
    "BUKTI TRANSFER": "1lHO7hPfyj6-512vovUNfvVcLbLQhTWIv",

    /* 2. Buku Nikah */
    "Buku Nikah": "1KRSuFnV7II24xi4xptIkThezWNR9zt3H",
    "Surat Nikah": "1KRSuFnV7II24xi4xptIkThezWNR9zt3H",
    "BUKU NIKAH": "1KRSuFnV7II24xi4xptIkThezWNR9zt3H",

    /* 3. Foto Jamaah */
    "Foto Jamaah": "1xOUJKQe1ZGBQCPHOConpaxM0tlo6oFux",
    "Foto": "1xOUJKQe1ZGBQCPHOConpaxM0tlo6oFux",
    "FOTO JAMAAH": "1xOUJKQe1ZGBQCPHOConpaxM0tlo6oFux",

    /* 4. Kartu Keluarga */
    "Kartu Keluarga": "1yiY0tzDaRjAelWLus0e9dQ7yIV18xubl",
    "KK": "1yiY0tzDaRjAelWLus0e9dQ7yIV18xubl",
    "KARTU KELUARGA": "1yiY0tzDaRjAelWLus0e9dQ7yIV18xubl",

    /* 5. KTP */
    "KTP": "1LDMJlEpvNBedNHhtRspYScimfxQc07b2",
    "Kartu Tanda Penduduk": "1LDMJlEpvNBedNHhtRspYScimfxQc07b2",
    "Upload KTP": "1LDMJlEpvNBedNHhtRspYScimfxQc07b2",

    /* 6. Paspor */
    "Paspor": "1bgmduv6UxbOwV-OyLxoSpN3XfcRb94D8",
    "Passport": "1bgmduv6UxbOwV-OyLxoSpN3XfcRb94D8",
    "Upload Pasport": "1bgmduv6UxbOwV-OyLxoSpN3XfcRb94D8",
    "PASPOR": "1bgmduv6UxbOwV-OyLxoSpN3XfcRb94D8"
  }
};

/**
 * Folder resolver khusus dokumen jamaah dengan fallback otomatis
 * @param {string} jenisDokumen Tipe/Jenis dokumen jamaah
 */
function getTargetJamaahUploadFolder_(jenisDokumen) {
  let folder = null;
  const docTypeKey = String(jenisDokumen || '').trim();

  /* 1. Cari dari FOLDER_IDS per jenis dokumen */
  if (docTypeKey && CONFIG_UPLOAD_DOC_JAMAAH.FOLDER_IDS) {
    const specificFolderId = CONFIG_UPLOAD_DOC_JAMAAH.FOLDER_IDS[docTypeKey] || 
                             CONFIG_UPLOAD_DOC_JAMAAH.FOLDER_IDS[docTypeKey.toUpperCase()];
    if (specificFolderId) {
      try {
        folder = DriveApp.getFolderById(specificFolderId);
      } catch (eSpecific) {
        Logger.log('Peringatan: Gagal akses folder khusus Jamaah (' + docTypeKey + '): ' + eSpecific.toString());
      }
    }
  }

  /* 2. Default FOLDER_ID */
  if (!folder && CONFIG_UPLOAD_DOC_JAMAAH.FOLDER_ID) {
    try {
      folder = DriveApp.getFolderById(CONFIG_UPLOAD_DOC_JAMAAH.FOLDER_ID);
    } catch (eDefault) {
      Logger.log('Peringatan: Gagal akses default FOLDER_ID: ' + eDefault.toString());
    }
  }

  /* 3. Fallback Root Drive */
  if (!folder) {
    try {
      const root = DriveApp.getRootFolder();
      const existingFolders = root.getFoldersByName('UploadDok_Jamaah_Storage');
      if (existingFolders.hasNext()) {
        folder = existingFolders.next();
      } else {
        folder = root.createFolder('UploadDok_Jamaah_Storage');
      }
    } catch (eRoot) {
      Logger.log('Error pembuat fallback folder root jamaah: ' + eRoot.toString());
      throw new Error('Tidak dapat mengakses Google Drive Folder target untuk Jamaah.');
    }
  }

  return folder;
}

/**
 * Mengambil parameter sistem & identitas user uploader khusus untuk modul mod_upload_dok_jamaah
 * @param {Object} uploaderUser Object user aktif
 */
function getUploadDocJamaahParameters(uploaderUser) {
  try {
    let activeEmail = '';
    try {
      if (typeof Session !== 'undefined') {
        activeEmail = Session.getActiveUser().getEmail() || Session.getEffectiveUser().getEmail() || '';
      }
    } catch (eEmail) {}

    if (!activeEmail && uploaderUser && uploaderUser.email) {
      activeEmail = uploaderUser.email;
    }
    if (!activeEmail) {
      activeEmail = 'user.active@gmail.com';
    }

    const timestamp = typeof getJakartaTimeString === 'function' ? getJakartaTimeString() : new Date().toISOString();

    return {
      success: true,
      parameters: {
        activeEmail: activeEmail,
        folderId: CONFIG_UPLOAD_DOC_JAMAAH.FOLDER_ID,
        folderUrl: 'https://drive.google.com/drive/folders/' + CONFIG_UPLOAD_DOC_JAMAAH.FOLDER_ID,
        sheetName: CONFIG_UPLOAD_DOC_JAMAAH.SHEET_NAME,
        supportedFormats: 'PDF, PNG, JPG, JPEG, DOC, DOCX, XLS, XLSX',
        maxSizeMb: 10,
        timestamp: timestamp
      }
    };
  } catch (e) {
    return {
      success: false,
      message: e.message,
      parameters: {
        activeEmail: 'user.active@gmail.com',
        folderId: CONFIG_UPLOAD_DOC_JAMAAH.FOLDER_ID,
        sheetName: CONFIG_UPLOAD_DOC_JAMAAH.SHEET_NAME
      }
    };
  }
}

/**
 * Mengambil atau membuat Sheet "UploadDokJamaah"
 */
function getUploadDokJamaahSheet() {
  const db = getDb();
  let sheet = db.getSheetByName(CONFIG_UPLOAD_DOC_JAMAAH.SHEET_NAME) || 
              db.getSheetByName('Upload Dokumen Jamaah') || 
              db.getSheetByName('Upload_Dok_Jamaah');

  if (!sheet) {
    sheet = db.insertSheet(CONFIG_UPLOAD_DOC_JAMAAH.SHEET_NAME);
  }

  seedDefaultUploadDokJamaahSheetIfEmpty(sheet);
  return sheet;
}

/**
 * Mengisi header default jika Sheet "UploadDokJamaah" masih kosong
 */
function seedDefaultUploadDokJamaahSheetIfEmpty(sheet) {
  if (sheet.getLastRow() === 0) {
    const defaultHeaders = [
      'DocID',
      'Timestamp',
      'ID Jamaah',
      'Nama Lengkap',
      'Jenis Dokumen',
      'Nama File',
      'Link File',
      'File ID',
      'Uploader',
      'Keterangan'
    ];

    sheet.appendRow(defaultHeaders);

    /* Format Header Baris 1 */
    const headerRange = sheet.getRange(1, 1, 1, defaultHeaders.length);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#0f172a');
    headerRange.setFontColor('#38bdf8');
    sheet.setFrozenRows(1);
  }
}


/**
 * Memetakan tipe/jenis dokumen ke nama header resmi pada Sheet "Data Jamaah"
 * Header Target:
 * - KTP -> Upload KTP
 * - Paspor -> Upload Pasport
 * - Buku Nikah -> Buku Nikah
 * - Surat Nikah -> Surat Nikah
 * - Foto Jamaah -> Foto Jamaah
 * - Kartu Keluarga -> Kartu Keluarga
 * - Bukti Transfer -> Upload Bukti Transfer
 * @param {string} jenisDokumen Tipe/Jenis dokumen jamaah
 * @returns {string} Nama header resmi pada Sheet Data Jamaah
 */
function mapJenisDokumenToHeaderJamaah_(jenisDokumen) {
  const docTypeKey = String(jenisDokumen || '').trim().toLowerCase();
  
  if (docTypeKey === 'ktp' || docTypeKey === 'upload ktp' || docTypeKey === 'kartu tanda penduduk') {
    return 'Upload KTP';
  }
  if (docTypeKey === 'paspor' || docTypeKey === 'passport' || docTypeKey === 'upload pasport' || docTypeKey === 'upload paspor') {
    return 'Upload Pasport';
  }
  if (docTypeKey === 'buku nikah') {
    return 'Buku Nikah';
  }
  if (docTypeKey === 'surat nikah') {
    return 'Surat Nikah';
  }
  if (docTypeKey === 'foto jamaah' || docTypeKey === 'foto') {
    return 'Foto Jamaah';
  }
  if (docTypeKey === 'kartu keluarga' || docTypeKey === 'kk') {
    return 'Kartu Keluarga';
  }
  if (docTypeKey === 'bukti transfer' || docTypeKey === 'upload bukti transfer') {
    return 'Upload Bukti Transfer';
  }
  
  return jenisDokumen;
}

/**
 * Memeriksa apakah data dokumen tertentu sudah ada pada Sheet "Data Jamaah" untuk ID Jamaah tertentu
 * @param {string} idJamaah ID Jamaah (contoh: JM-2026-0001)
 * @param {string} jenisDokumen Jenis dokumen
 * @returns {Object} { exists: boolean, existingValue: string, headerName: string, rowIndex: number, colIndex: number }
 */
function checkJamaahDocExistsInSheet_(idJamaah, jenisDokumen) {
  try {
    const headerName = mapJenisDokumenToHeaderJamaah_(jenisDokumen);
    if (!headerName || !idJamaah) {
      return { exists: false, headerName: headerName || jenisDokumen, existingValue: '', rowIndex: -1, colIndex: -1 };
    }

    const db = getDb();
    if (!db) return { exists: false, headerName: headerName, existingValue: '', rowIndex: -1, colIndex: -1 };

    const sheet = db.getSheetByName('Data Jamaah');
    if (!sheet) return { exists: false, headerName: headerName, existingValue: '', rowIndex: -1, colIndex: -1 };

    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    if (lastRow <= 1 || lastCol === 0) {
      return { exists: false, headerName: headerName, existingValue: '', rowIndex: -1, colIndex: -1 };
    }

    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    
    let idColIdx = -1;
    let targetColIdx = -1;

    for (let c = 0; c < headers.length; c++) {
      const hName = String(headers[c] || '').trim();
      const hClean = hName.toLowerCase().replace(/[^a-z0-9]/g, '');
      const targetClean = headerName.toLowerCase().replace(/[^a-z0-9]/g, '');

      if (hClean === 'idjamaah' || hClean === 'id') {
        idColIdx = c + 1;
      }
      if (hClean === targetClean || hName === headerName) {
        targetColIdx = c + 1;
      }
    }

    if (idColIdx === -1) idColIdx = 1;
    if (targetColIdx === -1) {
      Logger.log('Header "' + headerName + '" tidak ditemukan pada Sheet Data Jamaah.');
      return { exists: false, headerName: headerName, existingValue: '', rowIndex: -1, colIndex: -1 };
    }

    const idValues = sheet.getRange(2, idColIdx, lastRow - 1, 1).getValues();
    let targetRowIdx = -1;

    for (let r = 0; r < idValues.length; r++) {
      if (String(idValues[r][0] || '').trim().toLowerCase() === String(idJamaah || '').trim().toLowerCase()) {
        targetRowIdx = r + 2;
        break;
      }
    }

    if (targetRowIdx === -1) {
      return { exists: false, headerName: headerName, existingValue: '', rowIndex: -1, colIndex: -1 };
    }

    const cellValue = String(sheet.getRange(targetRowIdx, targetColIdx).getValue() || '').trim();
    const exists = cellValue !== '';

    return {
      exists: exists,
      existingValue: cellValue,
      headerName: headerName,
      rowIndex: targetRowIdx,
      colIndex: targetColIdx
    };

  } catch (e) {
    Logger.log('Error checkJamaahDocExistsInSheet_: ' + e.toString());
    return { exists: false, headerName: jenisDokumen, existingValue: '', rowIndex: -1, colIndex: -1 };
  }
}

/**
 * Menyalin / memperbarui URL berkas ke Sheet "Data Jamaah" pada kolom header yang sesuai
 * @param {string} idJamaah ID Jamaah
 * @param {string} jenisDokumen Tipe / Jenis dokumen
 * @param {string} fileUrl URL link berkas Google Drive
 */
function syncJamaahDocToDataJamaahSheet_(idJamaah, jenisDokumen, fileUrl) {
  try {
    const docStatus = checkJamaahDocExistsInSheet_(idJamaah, jenisDokumen);
    if (docStatus.rowIndex !== -1 && docStatus.colIndex !== -1) {
      const db = getDb();
      const sheet = db.getSheetByName('Data Jamaah');
      if (sheet) {
        sheet.getRange(docStatus.rowIndex, docStatus.colIndex).setValue(fileUrl);
        
        try {
          const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
          const updatedColIdx = headers.findIndex(h => String(h || '').trim().toLowerCase() === 'updatedat') + 1;
          if (updatedColIdx > 0) {
            const nowStr = typeof getJakartaTimeString === 'function' ? getJakartaTimeString() : new Date().toISOString();
            sheet.getRange(docStatus.rowIndex, updatedColIdx).setValue(nowStr);
          }
        } catch (eTime) {}

        return { success: true, message: 'Berhasil memperbarui data pada Sheet Data Jamaah (Header: "' + docStatus.headerName + '").' };
      }
    }
    return { success: false, message: 'ID Jamaah ' + idJamaah + ' atau Header tidak ditemukan pada Sheet Data Jamaah.' };
  } catch (e) {
    Logger.log('Error syncJamaahDocToDataJamaahSheet_: ' + e.toString());
    return { success: false, message: e.message };
  }
}

/**
 * Mengunggah berkas Jamaah ke Google Drive, mencatat ke Sheet UploadDokJamaah, & menyalin ke Sheet Data Jamaah
 * @param {Object} filePayload Payload berkas { fileName, mimeType, base64Data, idJamaah, namaLengkap, jenisDokumen, uploader, keterangan, confirmOverwrite }
 */
function uploadJamaahDocument(filePayload) {
  try {
    if (!filePayload || !filePayload.base64Data || !filePayload.fileName) {
      return { success: false, message: 'Payload file atau data base64 tidak valid.' };
    }

    const idJamaah = String(filePayload.idJamaah || 'JM-UNKNOWN').trim();
    const namaLengkap = String(filePayload.namaLengkap || 'Jamaah Tanpa Nama').trim();
    const jenisDokumen = String(filePayload.jenisDokumen || 'Dokumen Jamaah').trim();
    const keterangan = String(filePayload.keterangan || '').trim();
    const uploader = String(filePayload.uploader || 'System').trim();
    const confirmOverwrite = filePayload.confirmOverwrite === true;

    /* 1. Periksa apakah sudah ada datanya di Sheet "Data Jamaah" jika konfirmasi belum diberikan */
    const checkStatus = checkJamaahDocExistsInSheet_(idJamaah, jenisDokumen);
    if (checkStatus.exists && !confirmOverwrite) {
      return {
        success: true,
        requireConfirmation: true,
        headerName: checkStatus.headerName,
        existingValue: checkStatus.existingValue,
        idJamaah: idJamaah,
        namaLengkap: namaLengkap,
        jenisDokumen: jenisDokumen,
        message: 'Data dokumen "' + checkStatus.headerName + '" untuk Jamaah ' + namaLengkap + ' (' + idJamaah + ') sudah ada di Sheet Data Jamaah:\n\n' + checkStatus.existingValue + '\n\nApakah Anda ingin memperbarui (update) data tersebut?'
      };
    }

    /* Format Nama File Baru: "ID Jamaah - Nama Lengkap - Jenis Dokumen.ext" */
    const rawFileName = String(filePayload.fileName || 'dokumen').trim();
    let fileExt = '';
    const lastDotIdx = rawFileName.lastIndexOf('.');
    if (lastDotIdx !== -1) {
      fileExt = rawFileName.substring(lastDotIdx);
    }
    const formattedFileName = idJamaah + ' - ' + namaLengkap + ' - ' + jenisDokumen + fileExt;

    /* 2. Dapatkan folder Google Drive target */
    const folder = getTargetJamaahUploadFolder_(jenisDokumen);

    /* 3. Decode file base64 & simpan file baru ke Drive */
    const rawBase64 = String(filePayload.base64Data || '');
    const cleanBase64 = rawBase64.includes(',') 
      ? rawBase64.split(',')[1] 
      : rawBase64;
    
    const bytes = Utilities.base64Decode(cleanBase64);
    const mimeType = filePayload.mimeType || 'application/octet-stream';
    const blob = Utilities.newBlob(bytes, mimeType, formattedFileName);

    const driveFile = folder.createFile(blob);
    
    try {
      driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (eSharing) {
      Logger.log('Informasi setSharing jamaah dilewati: ' + eSharing.toString());
    }

    const fileUrl = driveFile.getUrl();
    const fileId = driveFile.getId();
    const fileNameCreated = driveFile.getName();

    /* 4. Catat metadata ke Sheet "UploadDokJamaah" */
    const sheet = getUploadDokJamaahSheet();
    const lastRow = sheet.getLastRow();
    const docId = 'DOCJ-' + String(lastRow > 0 ? lastRow : 1).padStart(4, '0') + '-' + Math.floor(100 + Math.random() * 900);
    const timestampFormatted = typeof getJakartaTimeString === 'function' ? getJakartaTimeString() : new Date().toISOString();

    const newRow = [
      docId,
      timestampFormatted,
      idJamaah,
      namaLengkap,
      jenisDokumen,
      fileNameCreated,
      fileUrl,
      fileId,
      uploader,
      keterangan
    ];

    sheet.appendRow(newRow);

    /* 5. Tulis / Perbarui pada Sheet "Data Jamaah" sesuai header jenis dokumen */
    const syncRes = syncJamaahDocToDataJamaahSheet_(idJamaah, jenisDokumen, fileUrl);

    return {
      success: true,
      message: 'Dokumen Jamaah "' + jenisDokumen + '" berhasil diunggah ke Sheet UploadDokJamaah dan ' + 
               (checkStatus.exists ? 'di-update' : 'ditulis') + ' pada Sheet Data Jamaah (Header: "' + checkStatus.headerName + '")!',
      docId: docId,
      fileName: fileNameCreated,
      fileUrl: fileUrl,
      fileId: fileId,
      folderId: folder.getId(),
      syncedDataJamaah: syncRes.success
    };

  } catch (e) {
    Logger.log('Error uploadJamaahDocument: ' + e.toString());
    return {
      success: false,
      message: 'Gagal mengunggah dokumen Jamaah: ' + e.message
    };
  }
}


/**
 * Mengambil seluruh daftar riwayat berkas dari Sheet "UploadDokJamaah"
 */
function getUploadDokJamaahList() {
  try {
    const sheet = getUploadDokJamaahSheet();
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      return { success: true, data: [] };
    }

    const data = sheet.getRange(2, 1, lastRow - 1, 10).getValues();
    const list = data.map((row, index) => {
      return {
        rowIndex: index + 2,
        docId: String(row[0] || ('DOCJ-' + (index + 1))),
        timestamp: String(row[1] || ''),
        idJamaah: String(row[2] || ''),
        namaLengkap: String(row[3] || ''),
        jenisDokumen: String(row[4] || ''),
        fileName: String(row[5] || ''),
        fileUrl: String(row[6] || ''),
        fileId: String(row[7] || ''),
        uploader: String(row[8] || 'System'),
        keterangan: String(row[9] || '')
      };
    }).reverse(); // Urutan terbaru di atas

    return {
      success: true,
      data: list
    };
  } catch (e) {
    Logger.log('Error getUploadDokJamaahList: ' + e.toString());
    return {
      success: false,
      message: e.message,
      data: []
    };
  }
}

/**
 * Menghapus berkas dokumen Jamaah dari Sheet UploadDokJamaah
 * @param {string} docId ID Dokumen yang akan dihapus
 */
function deleteUploadDokJamaah(docId) {
  try {
    if (!docId) return { success: false, message: 'DocID tidak valid.' };
    const sheet = getUploadDokJamaahSheet();
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return { success: false, message: 'Data masih kosong.' };

    const docIds = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    let targetRow = -1;

    for (let i = 0; i < docIds.length; i++) {
      if (String(docIds[i][0]).trim() === String(docId).trim()) {
        targetRow = i + 2;
        break;
      }
    }

    if (targetRow !== -1) {
      sheet.deleteRow(targetRow);
      return { success: true, message: 'Dokumen Jamaah (' + docId + ') berhasil dihapus.' };
    } else {
      return { success: false, message: 'Dokumen dengan ID ' + docId + ' tidak ditemukan.' };
    }
  } catch (e) {
    return { success: false, message: 'Gagal menghapus dokumen Jamaah: ' + e.message };
  }
}

/* ============================================================================ */
/* RPC / API WRAPPER FUNCTIONS UNTUK APPSSCRIPT RUN & WEB SERVER */
/* ============================================================================ */

function apiUploadJamaahDocument(payload, token) {
  return uploadJamaahDocument(payload);
}

function apiGetUploadDokJamaahList(token, forceRefresh) {
  return getUploadDokJamaahList();
}

function apiDeleteUploadDokJamaah(docId, token) {
  return deleteUploadDokJamaah(docId);
}

function apiCheckJamaahDocExists(idJamaah, jenisDokumen, token) {
  return checkJamaahDocExistsInSheet_(idJamaah, jenisDokumen);
}

/**
 * Mengambil rekap status kelengkapan dokumen Umrah seluruh jamaah (Untuk Dashboard Dokumen Umrah)
 * Berdasarkan Sheet "Data Jamaah" dan header target:
 * - Upload KTP
 * - Upload Pasport
 * - Buku Nikah
 * - Surat Nikah
 * - Foto Jamaah
 * - Kartu Keluarga
 * - Upload Bukti Transfer
 * Dan menyertakan Jenis Paket Umrah untuk keperluan filter dashboard.
 */
function getMonitoringDokumenUmrah() {
  try {
    const db = getDb();
    if (!db) return { success: false, message: 'Database tidak ditemukan', data: [] };

    const sheetJamaah = db.getSheetByName('Data Jamaah');
    if (!sheetJamaah) return { success: false, message: 'Sheet Data Jamaah tidak ditemukan', data: [] };

    const lastRow = sheetJamaah.getLastRow();
    const lastCol = sheetJamaah.getLastColumn();
    if (lastRow <= 1 || lastCol === 0) {
      return { 
        success: true, 
        data: [], 
        jenisDokumenList: [
          'Upload KTP', 'Upload Pasport', 'Buku Nikah', 'Surat Nikah', 'Foto Jamaah', 'Kartu Keluarga', 'Upload Bukti Transfer'
        ],
        jenisPaketList: [] 
      };
    }

    const data = sheetJamaah.getRange(1, 1, lastRow, lastCol).getValues();
    const rawHeaders = data[0];
    const headers = rawHeaders.map(h => String(h || '').trim());

    // Dokumen target yang diminta oleh user
    const targetDocHeaders = [
      'Upload KTP',
      'Upload Pasport',
      'Buku Nikah',
      'Surat Nikah',
      'Foto Jamaah',
      'Kartu Keluarga',
      'Upload Bukti Transfer'
    ];

    // Deteksi index kolom penting
    const idColIdx = headers.findIndex(h => {
      const c = h.toLowerCase().replace(/[^a-z0-9]/g, '');
      return c === 'idjamaah' || c === 'id';
    });
    const namaColIdx = headers.findIndex(h => {
      const c = h.toLowerCase().replace(/[^a-z0-9]/g, '');
      return c === 'namalengkap' || c === 'nama' || c === 'namajamaah';
    });
    const paketColIdx = headers.findIndex(h => {
      const c = h.toLowerCase().replace(/[^a-z0-9]/g, '');
      return c === 'jenispaketumrah' || c === 'jenispaket' || c === 'paket';
    });
    const noKtpColIdx = headers.findIndex(h => {
      const c = h.toLowerCase().replace(/[^a-z0-9]/g, '');
      return c === 'nomorktp' || c === 'noktp' || c === 'nik';
    });
    const noPasporColIdx = headers.findIndex(h => {
      const c = h.toLowerCase().replace(/[^a-z0-9]/g, '');
      return c === 'nomorpassport' || c === 'nomorpaspor' || c === 'nopaspor';
    });
    const cabangColIdx = headers.findIndex(h => {
      const c = h.toLowerCase().replace(/[^a-z0-9]/g, '');
      return c === 'kantorcabang' || c === 'cabang';
    });

    if (namaColIdx === -1) {
      return { success: false, message: 'Kolom Nama Lengkap / Nama Jamaah tidak ditemukan di Data Jamaah.', data: [] };
    }

    // Petakan index kolom untuk tiap dokumen target
    const docIndexes = {};
    targetDocHeaders.forEach(docName => {
      const cleanTarget = docName.toLowerCase().replace(/[^a-z0-9]/g, '');
      let foundIdx = headers.findIndex(h => h.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanTarget);
      
      // Fallback aliases jika nama kolom sedikit berbeda
      if (foundIdx === -1) {
        if (cleanTarget === 'uploadktp') {
          foundIdx = headers.findIndex(h => h.toLowerCase().replace(/[^a-z0-9]/g, '') === 'ktp');
        } else if (cleanTarget === 'uploadpasport') {
          foundIdx = headers.findIndex(h => {
            const hc = h.toLowerCase().replace(/[^a-z0-9]/g, '');
            return hc === 'paspor' || hc === 'passport' || hc === 'uploadpaspor';
          });
        } else if (cleanTarget === 'uploadbuktitransfer') {
          foundIdx = headers.findIndex(h => {
            const hc = h.toLowerCase().replace(/[^a-z0-9]/g, '');
            return hc === 'buktitransfer' || hc === 'buktitf';
          });
        } else if (cleanTarget === 'kartukeluarga') {
          foundIdx = headers.findIndex(h => h.toLowerCase().replace(/[^a-z0-9]/g, '') === 'kk');
        } else if (cleanTarget === 'fotojamaah') {
          foundIdx = headers.findIndex(h => h.toLowerCase().replace(/[^a-z0-9]/g, '') === 'foto');
        }
      }

      docIndexes[docName] = foundIdx;
    });

    const result = [];
    const uniquePaketSet = new Set();

    for (let r = 1; r < data.length; r++) {
      const row = data[r];
      const nama = String(row[namaColIdx] || '').trim();
      const idJamaah = idColIdx !== -1 ? String(row[idColIdx] || '').trim() : '';
      const jenisPaket = paketColIdx !== -1 ? String(row[paketColIdx] || '').trim() : '-';
      const noKtp = noKtpColIdx !== -1 ? String(row[noKtpColIdx] || '').trim() : '';
      const noPaspor = noPasporColIdx !== -1 ? String(row[noPasporColIdx] || '').trim() : '';
      const kantorCabang = cabangColIdx !== -1 ? String(row[cabangColIdx] || '').trim() : '';

      if (nama && nama !== '-' && nama.toLowerCase() !== 'nama' && nama.toLowerCase() !== 'nama lengkap') {
        if (jenisPaket && jenisPaket !== '-' && jenisPaket !== '') {
          uniquePaketSet.add(jenisPaket);
        }

        const links = {};
        let completeCount = 0;
        const totalDocs = targetDocHeaders.length;

        targetDocHeaders.forEach(docName => {
          const idx = docIndexes[docName];
          if (idx !== -1 && idx !== undefined) {
            const val = String(row[idx] || '').trim();
            links[docName] = val;
            if (val !== '' && val !== '-') {
              completeCount++;
            }
          } else {
            links[docName] = '';
          }
        });

        result.push({
          idJamaah: idJamaah || ('JM-' + r),
          nama: nama.replace(/\s+/g, ' '),
          jenisPaket: jenisPaket || '-',
          noKtp: noKtp || '-',
          noPaspor: noPaspor || '-',
          kantorCabang: kantorCabang || '-',
          links: links,
          completeCount: completeCount,
          totalDocs: totalDocs,
          percentage: totalDocs > 0 ? Math.round((completeCount / totalDocs) * 100) : 0
        });
      }
    }

    // Urutkan ascending berdasarkan nama jamaah
    result.sort((a, b) => a.nama.localeCompare(b.nama));

    const jenisPaketList = Array.from(uniquePaketSet).sort();

    return {
      success: true,
      data: result,
      jenisDokumenList: targetDocHeaders,
      jenisPaketList: jenisPaketList
    };

  } catch (e) {
    Logger.log('Error getMonitoringDokumenUmrah: ' + e.toString());
    return {
      success: false,
      message: 'Gagal mengambil data monitoring dokumen Umrah: ' + e.message,
      data: [],
      jenisDokumenList: [],
      jenisPaketList: []
    };
  }
}

function apiGetMonitoringDokumenUmrah(token) {
  return getMonitoringDokumenUmrah();
}

/**
 * Mengambil berkas-berkas dokumen milik jamaah dari Google Drive
 * dan mengemasnya dalam format ZIP base64 langsung dari server Apps Script.
 * @param {string} idJamaah ID Jamaah target
 * @param {Object} docLinks Object pasangan nama dokumen dan URL Google Drive
 */
function downloadAllJamaahDocsAsZip(idJamaah, docLinks) {
  try {
    if (!idJamaah) {
      return { success: false, message: 'ID Jamaah tidak valid.' };
    }

    const links = docLinks || {};
    const docKeys = Object.keys(links);
    const validBlobs = [];
    let namaJamaahClean = 'Jamaah';

    // Cari metadata nama jamaah jika memungkinkan
    try {
      const db = getDb();
      if (db) {
        const sheet = db.getSheetByName('Data Jamaah');
        if (sheet) {
          const data = sheet.getDataRange().getValues();
          if (data.length > 1) {
            const headers = data[0].map(h => String(h || '').trim().toLowerCase().replace(/[^a-z0-9]/g, ''));
            const idCol = headers.findIndex(h => h === 'idjamaah' || h === 'id');
            const namaCol = headers.findIndex(h => h === 'namalengkap' || h === 'nama');
            if (idCol !== -1 && namaCol !== -1) {
              for (let r = 1; r < data.length; r++) {
                if (String(data[r][idCol] || '').trim().toLowerCase() === String(idJamaah).trim().toLowerCase()) {
                  namaJamaahClean = String(data[r][namaCol] || '').trim().replace(/[^a-zA-Z0-9_\-\s]/g, '');
                  break;
                }
              }
            }
          }
        }
      }
    } catch (eMeta) {}

    // Ekstrak ID Drive dan ambil file Blob
    docKeys.forEach(docName => {
      const url = String(links[docName] || '').trim();
      if (url && url !== '-' && url.startsWith('http')) {
        let fileId = '';
        const matchId = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
        if (matchId && matchId[1]) {
          fileId = matchId[1];
        }

        if (fileId) {
          try {
            const driveFile = DriveApp.getFileById(fileId);
            if (driveFile) {
              const originalName = driveFile.getName();
              let ext = '';
              const dotIdx = originalName.lastIndexOf('.');
              if (dotIdx !== -1) {
                ext = originalName.substring(dotIdx);
              }
              const cleanDocName = String(docName).replace(/[^a-zA-Z0-9_\-]/g, '_');
              const blob = driveFile.getBlob();
              blob.setName(cleanDocName + ext);
              validBlobs.push(blob);
            }
          } catch (eFile) {
            Logger.log('Gagal mengambil file Drive ID ' + fileId + ' untuk ' + docName + ': ' + eFile.toString());
          }
        }
      }
    });

    if (validBlobs.length === 0) {
      return {
        success: false,
        message: 'Tidak ada berkas fisik yang dapat ditemukan atau diakses dari Google Drive untuk Jamaah ini.'
      };
    }

    // Buat ZIP menggunakan Utilities.zip
    const zipName = idJamaah + '_' + (namaJamaahClean.replace(/\s+/g, '_')) + '_Dokumen.zip';
    const zipBlob = Utilities.zip(validBlobs, zipName);
    const base64Zip = Utilities.base64Encode(zipBlob.getBytes());

    return {
      success: true,
      message: 'Berhasil mengemas ' + validBlobs.length + ' dokumen ke dalam file ZIP.',
      fileName: zipName,
      fileCount: validBlobs.length,
      base64Data: base64Zip
    };

  } catch (e) {
    Logger.log('Error downloadAllJamaahDocsAsZip: ' + e.toString());
    return {
      success: false,
      message: 'Gagal membuat file ZIP dokumen: ' + e.message
    };
  }
}

function apiDownloadAllJamaahDocsAsZip(idJamaah, docLinks, token) {
  return downloadAllJamaahDocsAsZip(idJamaah, docLinks);
}


