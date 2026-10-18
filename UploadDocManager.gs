/**
 * ============================================================================
 * UPLOAD DOCUMENT MANAGER (UploadDocManager.gs)
 * ============================================================================
 * Modul khusus mengelola unggahan dokumen Karyawan (mod_upload_dok)
 * - Menyimpan berkas fisik ke Google Drive Folder ID per Jenis Dokumen
 * - Mencatat metadata & URL link ke Sheet "UploadDok"
 * - Fitur pembacaan list dokumen terdaftar & penghapusan berkas
 */

var CONFIG_UPLOAD_DOC = {
  FOLDER_ID: '12hJY5VGcTlgdSBHRqOxSLYg_zwB4C0gF',
  SHEET_NAME: 'UploadDok',
  FOLDER_IDS: {
    /* 1. KTP */
    "KTP": "1bFKhZU6i04YF00mpxCZkbI8_va-pmsbt",
    "Kartu Tanda Penduduk (KTP)": "1bFKhZU6i04YF00mpxCZkbI8_va-pmsbt",
    "Kartu Tanda Penduduk": "1bFKhZU6i04YF00mpxCZkbI8_va-pmsbt",

    /* 2. KK */
    "KK": "1JaxYGzqSZyMFH13x4OoFmht-2uDI67w5",
    "Kartu Keluarga (KK)": "1JaxYGzqSZyMFH13x4OoFmht-2uDI67w5",
    "Kartu Keluarga": "1JaxYGzqSZyMFH13x4OoFmht-2uDI67w5",
    "KARTU KELUARGA": "1JaxYGzqSZyMFH13x4OoFmht-2uDI67w5",

    /* 3. NPWP */
    "NPWP": "112RfJNbaV1YNCgYw6mSWKoX3zgCvmyh7",

    /* 4. BPJS Kesehatan */
    "BPJS Kesehatan": "1_SbNTvYIm26nuydZjOugGanlOstLOZb6",

    /* 5. BPJS Ketenagakerjaan */
    "BPJS Ketenagakerjaan": "1sezUsjPWA4CSuC2iqwxWrzKQhTkp3BGq",

    /* 6. Ijazah */
    "Ijazah": "1w87HZEoVhXMU433mchYVE-N4KUX7ASWb",
    "Ijazah Terakhir": "1w87HZEoVhXMU433mchYVE-N4KUX7ASWb",

    /* 7. Transkrip Nilai */
    "Transkrip Nilai": "1E_mpoSBO3ya4oT-MAk5VxjqT2EuTT2ug",

    /* 8. Sertifikat */
    "Sertifikat": "170vl1ZpQNFYok3qwlx2ksVq0b82YrXHd",
    "Sertifikat Keahlian / Pelatihan": "170vl1ZpQNFYok3qwlx2ksVq0b82YrXHd",

    /* 9. Foto Formal */
    "Foto Formal": "1nacbtpXmwx_en7sYCYJikwPuaJlr1yRh",
    "Foto Formal Karyawan": "1nacbtpXmwx_en7sYCYJikwPuaJlr1yRh",
    "FOTO": "1nacbtpXmwx_en7sYCYJikwPuaJlr1yRh",

    /* 10. Kontrak Kerja */
    "Kontrak Kerja": "1qbq99TgCc6-V0w0V_c-ZPXM1uVSqeZvm",
    "Kontrak Kerja / SK": "1qbq99TgCc6-V0w0V_c-ZPXM1uVSqeZvm",

    /* 11. Dokumen Lainnya & Hotel */
    "Dokumen Lainnya": "12hJY5VGcTlgdSBHRqOxSLYg_zwB4C0gF",
    "Dokumen Lain": "12hJY5VGcTlgdSBHRqOxSLYg_zwB4C0gF",
    "HOTEL": "1ZuLBYHRPFYWJY9uemmpt8EZ0f-r9Alt3",
    "Brocure Hotel": "1ZuLBYHRPFYWJY9uemmpt8EZ0f-r9Alt3"
  }
};

/**
 * Robust folder resolver dengan fallback otomatis ke folder default atau root drive
 * @param {string} jenisDokumen Tipe/Jenis dokumen
 */
function getTargetUploadFolder_(jenisDokumen) {
  let folder = null;
  const docTypeKey = String(jenisDokumen || '').trim();

  /* 1. Coba cari dari FOLDER_IDS per jenis dokumen (exact match & uppercase) */
  if (docTypeKey && CONFIG_UPLOAD_DOC.FOLDER_IDS) {
    const specificFolderId = CONFIG_UPLOAD_DOC.FOLDER_IDS[docTypeKey] || 
                             CONFIG_UPLOAD_DOC.FOLDER_IDS[docTypeKey.toUpperCase()];
    if (specificFolderId) {
      try {
        folder = DriveApp.getFolderById(specificFolderId);
      } catch (eSpecific) {
        Logger.log('Peringatan: Gagal akses folder khusus (' + docTypeKey + '): ' + eSpecific.toString());
      }
    }
  }

  /* 2. Jika belum dapat, coba dari CONFIG_UPLOAD_DOC.FOLDER_ID default */
  if (!folder && CONFIG_UPLOAD_DOC.FOLDER_ID) {
    try {
      folder = DriveApp.getFolderById(CONFIG_UPLOAD_DOC.FOLDER_ID);
    } catch (eDefault) {
      Logger.log('Peringatan: Gagal akses default FOLDER_ID: ' + eDefault.toString());
    }
  }

  /* 3. Fallback Aman: Jika folder khusus maupun default tidak berizin / not found, buat/gunakan folder "UploadDok_App_Storage" di Root Drive */
  if (!folder) {
    try {
      const root = DriveApp.getRootFolder();
      const existingFolders = root.getFoldersByName('UploadDok_App_Storage');
      if (existingFolders.hasNext()) {
        folder = existingFolders.next();
      } else {
        folder = root.createFolder('UploadDok_App_Storage');
      }
    } catch (eRoot) {
      Logger.log('Error pembuat fallback folder root: ' + eRoot.toString());
      throw new Error('Tidak dapat mengakses Google Drive Folder target. Pastikan akun Google memiliki izin akses Drive.');
    }
  }

  return folder;
}

/**
 * Mengambil parameter sistem & identitas user uploader khusus untuk modul mod_upload_dok
 * @param {Object} uploaderUser Object user aktif
 */
function getUploadDocParameters(uploaderUser) {
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
        folderId: CONFIG_UPLOAD_DOC.FOLDER_ID,
        folderUrl: 'https://drive.google.com/drive/folders/' + CONFIG_UPLOAD_DOC.FOLDER_ID,
        sheetName: CONFIG_UPLOAD_DOC.SHEET_NAME,
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
        folderId: CONFIG_UPLOAD_DOC.FOLDER_ID,
        sheetName: CONFIG_UPLOAD_DOC.SHEET_NAME
      }
    };
  }
}

/**
 * Mengambil atau membuat Sheet "UploadDok"
 */
function getUploadDokSheet() {
  const db = getDb();
  let sheet = db.getSheetByName(CONFIG_UPLOAD_DOC.SHEET_NAME) || 
              db.getSheetByName('Upload Dokumen') || 
              db.getSheetByName('Upload_Dok');

  if (!sheet) {
    sheet = db.insertSheet(CONFIG_UPLOAD_DOC.SHEET_NAME);
  }

  seedDefaultUploadDokSheetIfEmpty(sheet);
  return sheet;
}

/**
 * Mengisi header default jika Sheet "UploadDok" masih kosong
 */
function seedDefaultUploadDokSheetIfEmpty(sheet) {
  if (sheet.getLastRow() === 0) {
    const defaultHeaders = [
      'DocID',
      'Timestamp',
      'Nama Karyawan',
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
 * Mengunggah berkas Karyawan ke Google Drive & mencatat ke Sheet UploadDok
 * @param {Object} filePayload Payload berkas { fileName, mimeType, base64Data, namaKaryawan, jenisDokumen, uploader, keterangan }
 */
function uploadEmployeeDocument(filePayload) {
  try {
    if (!filePayload || !filePayload.base64Data || !filePayload.fileName) {
      return { success: false, message: 'Payload file atau data base64 tidak valid.' };
    }

    const namaKaryawan = String(filePayload.namaKaryawan || 'Karyawan Tanpa Nama').trim();
    const jenisDokumen = String(filePayload.jenisDokumen || 'Dokumen Lain').trim();
    const keterangan = String(filePayload.keterangan || '').trim();
    const uploader = String(filePayload.uploader || 'System').trim();

    /* Format Nama File Baru: "Jenis Dokumen - Nama Karyawan.ext" */
    const rawFileName = String(filePayload.fileName || 'dokumen').trim();
    let fileExt = '';
    const lastDotIdx = rawFileName.lastIndexOf('.');
    if (lastDotIdx !== -1) {
      fileExt = rawFileName.substring(lastDotIdx);
    }
    const formattedFileName = jenisDokumen + ' - ' + namaKaryawan + fileExt;

    /* 1. Dapatkan folder Google Drive target secara handal (dengan fallback) */
    const folder = getTargetUploadFolder_(jenisDokumen);

    /* 2. Decode file base64 & simpan file baru ke Drive */
    const rawBase64 = String(filePayload.base64Data || '');
    const cleanBase64 = rawBase64.includes(',') 
      ? rawBase64.split(',')[1] 
      : rawBase64;
    
    const bytes = Utilities.base64Decode(cleanBase64);
    const mimeType = filePayload.mimeType || 'application/octet-stream';
    const blob = Utilities.newBlob(bytes, mimeType, formattedFileName);

    const driveFile = folder.createFile(blob);
    
    /* Atur file agar dapat diakses via link jika diperbolehkan kebijakan domain */
    try {
      driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (eSharing) {
      Logger.log('Informasi: setSharing dilewati: ' + eSharing.toString());
    }

    const fileUrl = driveFile.getUrl();
    const fileId = driveFile.getId();
    const fileNameCreated = driveFile.getName();

    /* 3. Catat metadata ke Sheet "UploadDok" */
    const sheet = getUploadDokSheet();
    const lastRow = sheet.getLastRow();
    const docId = 'DOC-' + String(lastRow > 0 ? lastRow : 1).padStart(4, '0') + '-' + Math.floor(100 + Math.random() * 900);
    const timestampFormatted = typeof getJakartaTimeString === 'function' ? getJakartaTimeString() : new Date().toISOString();

    const newRow = [
      docId,
      timestampFormatted,
      namaKaryawan,
      jenisDokumen,
      fileNameCreated,
      fileUrl,
      fileId,
      uploader,
      keterangan
    ];

    sheet.appendRow(newRow);

    /* Invalidate Cache RAM */
    try {
      CacheService.getScriptCache().remove('UPLOAD_DOK_LIST_CACHE_V1');
    } catch (e) {}

    return {
      success: true,
      message: 'Dokumen "' + jenisDokumen + '" untuk ' + namaKaryawan + ' berhasil diunggah ke Google Drive!',
      data: {
        docId: docId,
        timestamp: timestampFormatted,
        namaKaryawan: namaKaryawan,
        jenisDokumen: jenisDokumen,
        fileName: fileNameCreated,
        fileUrl: fileUrl,
        fileId: fileId,
        uploader: uploader,
        keterangan: keterangan
      }
    };
  } catch (err) {
    Logger.log('Error uploadEmployeeDocument: ' + err.toString());
    return { success: false, message: 'Gagal mengunggah dokumen: ' + err.toString() };
  }
}

/**
 * Membaca seluruh data dokumen Karyawan dari Sheet "UploadDok"
 */
function getUploadDokList(forceRefresh) {
  try {
    const cache = CacheService.getScriptCache();
    if (!forceRefresh) {
      const cached = cache.get('UPLOAD_DOK_LIST_CACHE_V1');
      if (cached) {
        try {
          return { success: true, data: JSON.parse(cached), source: 'cache' };
        } catch (e) {}
      }
    }

    const sheet = getUploadDokSheet();
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
          val = getJakartaTimeString(val);
        } else if (val !== undefined && val !== null) {
          val = String(val).trim();
        } else {
          val = '';
        }
        obj[h] = val;
      });

      /* Normalisasi properti konsisten */
      obj.docId = obj['DocID'] || obj['ID'] || ('DOC-' + (idx + 1));
      obj.timestamp = obj['Timestamp'] || '';
      obj.namaKaryawan = obj['Nama Karyawan'] || obj['Nama'] || '-';
      obj.jenisDokumen = obj['Jenis Dokumen'] || obj['Tipe'] || 'Dokumen';
      obj.fileName = obj['Nama File'] || 'File';
      obj.fileUrl = obj['Link File'] || obj['Url'] || '#';
      obj.fileId = obj['File ID'] || '';
      obj.uploader = obj['Uploader'] || 'System';
      obj.keterangan = obj['Keterangan'] || '';

      result.push(obj);
    });

    /* Urutkan terbaru di atas (descending timestamp/id) */
    result.reverse();

    try {
      cache.put('UPLOAD_DOK_LIST_CACHE_V1', JSON.stringify(result), 300); /* 5 Menit Cache */
    } catch (e) {}

    return { success: true, data: result, source: 'sheet' };
  } catch (err) {
    Logger.log('Error getUploadDokList: ' + err.toString());
    return { success: false, message: 'Gagal mengambil daftar dokumen: ' + err.toString() };
  }
}

/**
 * Menghapus baris dokumen dari Sheet "UploadDok" & opsional menghapus berkas di Google Drive
 */
function deleteUploadDokRecord(docId) {
  try {
    const cleanDocId = String(docId || '').trim();
    if (!cleanDocId) return { success: false, message: 'DocID wajib diisi.' };

    const sheet = getUploadDokSheet();
    const data = sheet.getDataRange().getValues();
    if (!data || data.length < 2) return { success: false, message: 'Data dokumen kosong.' };

    const headers = data[0].map(h => String(h || '').trim());
    const docIdColIdx = headers.findIndex(h => /docid|id/i.test(h));
    const fileIdColIdx = headers.findIndex(h => /file\s*id/i.test(h));

    let foundRowIndex = -1;
    let targetFileId = '';

    for (let i = 1; i < data.length; i++) {
      const rowDocId = String(data[i][docIdColIdx !== -1 ? docIdColIdx : 0] || '').trim();
      if (rowDocId === cleanDocId) {
        foundRowIndex = i + 1; /* 1-indexed sheet row */
        if (fileIdColIdx !== -1) {
          targetFileId = String(data[i][fileIdColIdx] || '').trim();
        }
        break;
      }
    }

    if (foundRowIndex === -1) {
      return { success: false, message: 'Dokumen dengan ID ' + cleanDocId + ' tidak ditemukan.' };
    }

    /* Hapus dari Google Drive jika File ID ditemukan */
    if (targetFileId) {
      try {
        DriveApp.getFileById(targetFileId).setTrashed(true);
      } catch (eDrive) {
        Logger.log('Peringatan: Gagal mentrash berkas Drive ID ' + targetFileId + ': ' + eDrive.toString());
      }
    }

    /* Hapus baris dari sheet */
    sheet.deleteRow(foundRowIndex);

    /* Invalidate Cache RAM */
    try {
      CacheService.getScriptCache().remove('UPLOAD_DOK_LIST_CACHE_V1');
    } catch (e) {}

    return { success: true, message: 'Dokumen ID ' + cleanDocId + ' berhasil dihapus!' };
  } catch (err) {
    Logger.log('Error deleteUploadDokRecord: ' + err.toString());
    return { success: false, message: 'Gagal menghapus dokumen: ' + err.toString() };
  }
}

/**
 * Helper function untuk memicu dialog otorisasi izin DriveApp pada Google Apps Script Editor
 * Jalankan fungsi ini 1x di editor Apps Script jika muncul error 'Required permissions: https://www.googleapis.com/auth/drive'
 */
function authorizeDriveAccess() {
  try {
    const root = DriveApp.getRootFolder();
    Logger.log('Drive Authorization Status: OK - Root Folder: ' + root.getName());
    return { success: true, message: 'Otorisasi Google Drive berhasil!' };
  } catch (e) {
    Logger.log('Error Authorization: ' + e.toString());
    return { success: false, message: e.toString() };
  }
}
