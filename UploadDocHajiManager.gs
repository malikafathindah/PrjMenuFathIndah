/**
 * ============================================================================
 * UPLOAD DOKUMEN HAJI MANAGER (UploadDocHajiManager.gs)
 * ============================================================================
 * Modul khusus mengelola unggahan berkas dokumen Jamaah Haji (mod_upload_dok_haji)
 * - Menyimpan berkas ke Google Drive Folder ID per Jenis Dokumen Haji:
 *   1. BPJS -> 14mojaJB6T5QK-awDRhG6Acg8cbdn8InH
 *   2. Bukti Angsuran -> 1hIVRG59fW52YgFikQ2RsPWFgiYrI7VfK
 *   3. Bukti Setor -> 1vgQGzQymq6nNbc3DsFmjctYswuVxKR8R
 *   4. Bukti Transfer -> 1fMNpTAXmOE_OE2alaLs6yuRkoHIM2DcN
 *   5. Kartu Keluarga -> 1BoXBiB1qz0E2KtBGLnLph3OzucI-5D4E
 *   6. KTP -> 1mzgLdPoMfwWjKahLOWoacdP95i8h40EP
 *   7. Paspor -> 1Z8lArt17TyZVeU8gAB-SAqzJdQCkeTNT
 *   8. SPPH -> 15hu9wtcXL9r6GVmEAgRgIp2s1sVlPoWy
 *
 * - Penamaan File Otomatis:
 *   a. BPJS: "BPJS - "+NoBPIH+" - "+Nama+Extension
 *   b. Bukti Angsuran: "Bukti Angsur - "+NoBPIH+" - "+Nama+Extension
 *   c. Bukti Setor: "Bukti Setor - "+NoBPIH+" - "+Nama+Extension
 *   d. Bukti Transfer: "Bukti Transfer - "+NoBPIH+" - "+Nama+Extension
 *   e. Kartu Keluarga: "KK - "+NoBPIH+" - "+Nama+Extension
 *   f. KTP: "KTP - "+NoBPIH+" - "+Nama+Extension
 *   g. Paspor: "Paspor - "+NoBPIH+" - "+Nama+Extension
 *   h. SPPH: "SPPH - "+NoBPIH+" - "+Nama+Extension
 *
 * - Menyimpan metadata ke Sheet Database Baru "UploadDokHaji"
 *   Headers: DocID | Timestamp | NoBPIH | Nama | Jenis Dokumen | Nama File | Link File
 *
 * - Menyimpan / menyinkronkan tautan Google Drive pada Sheet "DataJamaahHaji":
 *   Headers: BuktiSetor | SPPH | BPJS | BuktiTransfer | KartuKeluarga | KTP | Paspor | BuktiAngsuran
 */

var CONFIG_UPLOAD_DOC_HAJI = {
  SHEET_NAME: 'UploadDokHaji',
  SHEET_JAMAAH_HAJI: 'DataJamaahHaji',
  FOLDERS: {
    "BPJS": "14mojaJB6T5QK-awDRhG6Acg8cbdn8InH",
    "Bukti Angsuran": "1hIVRG59fW52YgFikQ2RsPWFgiYrI7VfK",
    "Bukti Setor": "1vgQGzQymq6nNbc3DsFmjctYswuVxKR8R",
    "Bukti Transfer": "1fMNpTAXmOE_OE2alaLs6yuRkoHIM2DcN",
    "Kartu Keluarga": "1BoXBiB1qz0E2KtBGLnLph3OzucI-5D4E",
    "KTP": "1mzgLdPoMfwWjKahLOWoacdP95i8h40EP",
    "Paspor": "1Z8lArt17TyZVeU8gAB-SAqzJdQCkeTNT",
    "SPPH": "15hu9wtcXL9r6GVmEAgRgIp2s1sVlPoWy",
    "Buku Nikah": "12PzkuSVW1ePgPbPCvsf58gVfXe7SAATf",
    "Foto": "1Nc7fTnoVsQF2x2qH4guw0wvRXvnAFXMk",
    "Visa": "",
    "Tasreh": "",
    "DocLain": ""
  },
  PREFIXES: {
    "BPJS": "BPJS - ",
    "Bukti Angsuran": "Bukti Angsur - ",
    "Bukti Setor": "Bukti Setor - ",
    "Bukti Transfer": "Bukti Transfer - ",
    "Kartu Keluarga": "KK - ",
    "KTP": "KTP - ",
    "Paspor": "Paspor - ",
    "SPPH": "SPPH - ",
    "Buku Nikah": "BukuNikah - ",
    "Foto": "Foto - ",
    "Visa": "Visa - ",
    "Tasreh": "Tasreh - ",
    "DocLain": "DocLain - "
  },
  DATA_JAMAAH_HEADERS: {
    "Bukti Setor": "BuktiSetor",
    "SPPH": "SPPH",
    "BPJS": "BPJS",
    "Bukti Transfer": "BuktiTransfer",
    "Kartu Keluarga": "KartuKeluarga",
    "KTP": "KTP",
    "Paspor": "Paspor",
    "Bukti Angsuran": "BuktiAngsuran",
    "Buku Nikah": "BukuNikah",
    "Foto": "Foto",
    "Visa": "Visa",
    "Tasreh": "Tasreh",
    "DocLain": "DocLain"
  }
};

/**
 * Memastikan Sheet UploadDokHaji dan header pada DataJamaahHaji terinisialisasi dengan benar
 */
function setupUploadDokHajiSheet() {
  const db = getDb();
  if (!db) return null;

  // 1. Inisialisasi Sheet UploadDokHaji
  const headersUpload = ['DocID', 'Timestamp', 'NoBPIH', 'Nama', 'Jenis Dokumen', 'Nama File', 'Link File'];
  let sheetUpload = db.getSheetByName(CONFIG_UPLOAD_DOC_HAJI.SHEET_NAME);
  
  if (!sheetUpload) {
    sheetUpload = db.insertSheet(CONFIG_UPLOAD_DOC_HAJI.SHEET_NAME);
  }
  
  if (sheetUpload.getLastRow() === 0) {
    sheetUpload.appendRow(headersUpload);
    const headerRange = sheetUpload.getRange(1, 1, 1, headersUpload.length);
    headerRange.setBackground('#0f172a');
    headerRange.setFontColor('#06b6d4');
    headerRange.setFontWeight('bold');
    sheetUpload.setFrozenRows(1);
  }

  // 2. Memastikan header link dokumen haji ada di Sheet DataJamaahHaji
  const sheetJamaahName = (CONFIG.SHEETS && CONFIG.SHEETS.DATA_JAMAAH_HAJI) || CONFIG_UPLOAD_DOC_HAJI.SHEET_JAMAAH_HAJI;
  let sheetJamaah = db.getSheetByName(sheetJamaahName);
  
  if (sheetJamaah) {
    const requiredHeaders = Object.values(CONFIG_UPLOAD_DOC_HAJI.DATA_JAMAAH_HEADERS);
    ensureSheetHeaders(sheetJamaah, requiredHeaders);
  }

  return sheetUpload;
}

/**
 * Mendapatkan folder Google Drive sesuai jenis dokumen haji
 */
function getTargetHajiUploadFolder_(jenisDokumen) {
  let folder = null;
  const docTypeKey = String(jenisDokumen || '').trim();
  const folderId = CONFIG_UPLOAD_DOC_HAJI.FOLDERS[docTypeKey];

  if (folderId) {
    try {
      folder = DriveApp.getFolderById(folderId);
    } catch (e) {
      Logger.log('Gagal membuka folder Drive untuk ' + docTypeKey + ' (ID: ' + folderId + '): ' + e.message);
    }
  }

  // Fallback jika folder ID tidak valid atau merupakan dokumen tambahan/custom
  if (!folder) {
    try {
      // Gunakan folder Drive default untuk dokumen tambahan
      folder = DriveApp.getFolderById('1YY2pJZ6yc_8y4LmOajDN1Bt9mgKtn_jg');
    } catch (eRoot) {
      try {
        const root = DriveApp.getRootFolder();
        const folderName = 'UploadDok_Haji_' + (docTypeKey ? docTypeKey.replace(/\s+/g, '_') : 'General');
        const existing = root.getFoldersByName(folderName);
        if (existing.hasNext()) {
          folder = existing.next();
        } else {
          folder = root.createFolder(folderName);
        }
      } catch (eCreate) {
        throw new Error('Tidak dapat mengakses atau membuat Google Drive folder target untuk Dokumen Haji.');
      }
    }
  }

  return folder;
}

/**
 * Mengambil daftar Jamaah Haji dari Sheet DataJamaahHaji untuk dropdown
 */
function getJamaahHajiDropdownOptions() {
  try {
    setupUploadDokHajiSheet();
    const sheetJamaah = (CONFIG.SHEETS && CONFIG.SHEETS.DATA_JAMAAH_HAJI) || CONFIG_UPLOAD_DOC_HAJI.SHEET_JAMAAH_HAJI;
    const rawJamaah = getSheetData(sheetJamaah) || [];

    const sheetAngsuran = (CONFIG.SHEETS && CONFIG.SHEETS.ENTRY_ANGSURAN_HAJI) || 'EntryAngsuranHaji';
    const rawAngsuran = getSheetData(sheetAngsuran) || [];

    const list = [];
    const seenMap = {};

    rawJamaah.forEach((row, idx) => {
      const nama = String(getRowValue(row, ['nama', 'namajamaah', 'namanasabah']) || '').trim();
      const noBpih = String(getRowValue(row, ['nobpih', 'no_bpih', 'bpih', 'no bpih', 'no. bpih']) || '-').trim();
      const idJamaah = String(getRowValue(row, ['idjamaah', 'id_jamaah', 'id']) || ('JH-' + (idx + 1).toString().padStart(4, '0'))).trim();

      if (nama && nama !== '-' && nama.toLowerCase() !== 'nama') {
        const key = nama.toLowerCase().replace(/\s+/g, ' ');
        if (!seenMap[key]) {
          seenMap[key] = true;
          list.push({
            idJamaah: idJamaah,
            nama: nama.replace(/\s+/g, ' '),
            noBpih: noBpih
          });
        }
      }
    });

    rawAngsuran.forEach((row, idx) => {
      const nama = String(getRowValue(row, ['namanasabah', 'nama_nasabah', 'nama', 'jamaah']) || '').trim();
      const noBpih = String(getRowValue(row, ['nobpih', 'no_bpih', 'bpih', 'no bpih', 'no. bpih']) || '-').trim();
      const idJamaah = String(getRowValue(row, ['idjamaah', 'id_jamaah', 'idnasabah']) || '-').trim();

      if (nama && nama !== '-' && nama.toLowerCase() !== 'nama nasabah') {
        const key = nama.toLowerCase().replace(/\s+/g, ' ');
        if (!seenMap[key]) {
          seenMap[key] = true;
          list.push({
            idJamaah: idJamaah,
            nama: nama.replace(/\s+/g, ' '),
            noBpih: noBpih
          });
        } else {
          // Update noBpih jika di master "-" tapi di transaksi ada nilainya
          const existing = list.find(item => item.nama.toLowerCase().replace(/\s+/g, ' ') === key);
          if (existing && (existing.noBpih === '-' || !existing.noBpih) && noBpih && noBpih !== '-') {
            existing.noBpih = noBpih;
          }
        }
      }
    });

    list.sort((a, b) => a.nama.localeCompare(b.nama));

    return {
      success: true,
      data: list
    };
  } catch (e) {
    Logger.log('Error getJamaahHajiDropdownOptions: ' + e.message);
    return { success: false, message: e.message, data: [] };
  }
}

/**
 * Memeriksa status keberadaan tautan dokumen pada Sheet DataJamaahHaji untuk Jamaah terpilih
 */
function checkJamaahHajiExistingDocLinks(nama, noBpih) {
  try {
    if (!nama) return { success: false, links: {} };
    
    const db = getDb();
    if (!db) return { success: false, links: {} };

    const sheetName = (CONFIG.SHEETS && CONFIG.SHEETS.DATA_JAMAAH_HAJI) || CONFIG_UPLOAD_DOC_HAJI.SHEET_JAMAAH_HAJI;
    const sheet = db.getSheetByName(sheetName);
    if (!sheet || sheet.getLastRow() <= 1) {
      return { success: true, links: {} };
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h || '').trim());
    
    const namaColIdx = headers.findIndex(h => {
      const hClean = h.toLowerCase().replace(/[^a-z0-9]/g, '');
      return hClean === 'nama' || hClean === 'namajamaah' || hClean === 'namanasabah';
    });

    const bpihColIdx = headers.findIndex(h => {
      const hClean = h.toLowerCase().replace(/[^a-z0-9]/g, '');
      return hClean === 'nobpih' || hClean === 'bpih' || hClean === 'nobpih';
    });

    if (namaColIdx === -1) return { success: false, links: {} };

    let targetRowIndex = -1;
    const cleanNamaTarget = String(nama).trim().toLowerCase();
    const cleanBpihTarget = String(noBpih || '').trim().toLowerCase();

    for (let r = 1; r < data.length; r++) {
      const rNama = String(data[r][namaColIdx] || '').trim().toLowerCase();
      const rBpih = bpihColIdx !== -1 ? String(data[r][bpihColIdx] || '').trim().toLowerCase() : '';

      if (rNama === cleanNamaTarget) {
        if (!cleanBpihTarget || cleanBpihTarget === '-' || rBpih === cleanBpihTarget || !rBpih) {
          targetRowIndex = r + 1; // 1-based index
          break;
        }
      }
    }

    const existingLinks = {};
    if (targetRowIndex !== -1) {
      const headerMap = CONFIG_UPLOAD_DOC_HAJI.DATA_JAMAAH_HEADERS;
      Object.keys(headerMap).forEach(jenisDoc => {
        const headerName = headerMap[jenisDoc];
        const colIdx = headers.findIndex(h => h.toLowerCase().replace(/[^a-z0-9]/g, '') === headerName.toLowerCase().replace(/[^a-z0-9]/g, ''));
        if (colIdx !== -1) {
          const val = String(data[targetRowIndex - 1][colIdx] || '').trim();
          existingLinks[jenisDoc] = val;
        } else {
          existingLinks[jenisDoc] = '';
        }
      });
    }

    return {
      success: true,
      foundRow: targetRowIndex !== -1,
      rowIndex: targetRowIndex,
      links: existingLinks
    };

  } catch (e) {
    Logger.log('Error checkJamaahHajiExistingDocLinks: ' + e.message);
    return { success: false, message: e.message, links: {} };
  }
}

/**
 * Menyinkronkan link file ke Sheet DataJamaahHaji & ViewHajjData pada kolom header yang sesuai
 */
function syncHajiDocToDataJamaahHajiSheet_(nama, noBpih, jenisDokumen, fileUrl) {
  try {
    const headerName = CONFIG_UPLOAD_DOC_HAJI.DATA_JAMAAH_HEADERS[jenisDokumen];
    if (!headerName || !nama) return { success: false };

    const db = getDb();
    if (!db) return { success: false };

    const targetSheetNames = [
      (CONFIG.SHEETS && CONFIG.SHEETS.DATA_JAMAAH_HAJI) || CONFIG_UPLOAD_DOC_HAJI.SHEET_JAMAAH_HAJI
      // Di-disable karena sheet ini sifatnya hanya view
      // (CONFIG.SHEETS && CONFIG.SHEETS.VIEW_HAJJ_DATA) || 'ViewHajjData'
    ];

    targetSheetNames.forEach(sheetName => {
      let sheet = db.getSheetByName(sheetName);
      if (!sheet) return;

      ensureSheetHeaders(sheet, Object.values(CONFIG_UPLOAD_DOC_HAJI.DATA_JAMAAH_HEADERS));

      const data = sheet.getDataRange().getValues();
      const headers = data[0].map(h => String(h || '').trim());

      const namaColIdx = headers.findIndex(h => {
        const hClean = h.toLowerCase().replace(/[^a-z0-9]/g, '');
        return hClean === 'nama' || hClean === 'namajamaah' || hClean === 'namanasabah';
      });

      const bpihColIdx = headers.findIndex(h => {
        const hClean = h.toLowerCase().replace(/[^a-z0-9]/g, '');
        return hClean === 'nobpih' || hClean === 'bpih';
      });

      const targetColIdx = headers.findIndex(h => h.toLowerCase().replace(/[^a-z0-9]/g, '') === headerName.toLowerCase().replace(/[^a-z0-9]/g, ''));

      if (namaColIdx === -1 || targetColIdx === -1) return;

      let targetRowIndex = -1;
      const cleanNamaTarget = String(nama).trim().toLowerCase();
      const cleanBpihTarget = String(noBpih || '').trim().toLowerCase();

      for (let r = 1; r < data.length; r++) {
        const rNama = String(data[r][namaColIdx] || '').trim().toLowerCase();
        const rBpih = bpihColIdx !== -1 ? String(data[r][bpihColIdx] || '').trim().toLowerCase() : '';

        if (rNama === cleanNamaTarget) {
          if (!cleanBpihTarget || cleanBpihTarget === '-' || rBpih === cleanBpihTarget || !rBpih) {
            targetRowIndex = r + 1;
            break;
          }
        }
      }

      if (targetRowIndex !== -1) {
        sheet.getRange(targetRowIndex, targetColIdx + 1).setValue(fileUrl);
        
        // Update Timestamp jika ada kolom UpdatedAt
        const updatedColIdx = headers.findIndex(h => h.toLowerCase().replace(/[^a-z0-9]/g, '') === 'updatedat');
        if (updatedColIdx !== -1) {
          const nowStr = typeof getJakartaTimeString === 'function' ? getJakartaTimeString() : new Date().toISOString();
          sheet.getRange(targetRowIndex, updatedColIdx + 1).setValue(nowStr);
        }
      }
    });

    return { success: true };
  } catch (e) {
    Logger.log('Error syncHajiDocToDataJamaahHajiSheet_: ' + e.message);
    return { success: false, message: e.message };
  }
}

/**
 * Format nama file otomatis sesuai aturan penamaan Dokumen Haji
 */
function generateHajiFileName_(jenisDokumen, noBpih, nama, fileExtension) {
  const cleanNoBpih = String(noBpih || '-').trim();
  const cleanNama = String(nama || 'Jamaah').trim();
  const prefix = CONFIG_UPLOAD_DOC_HAJI.PREFIXES[jenisDokumen] || (jenisDokumen + ' - ');
  const ext = fileExtension ? (fileExtension.startsWith('.') ? fileExtension : '.' + fileExtension) : '';

  return prefix + cleanNoBpih + ' - ' + cleanNama + ext;
}

/**
 * Mengunggah multiple dokumen haji sekaligus
 * @param {Object} batchPayload Object berisi { nama, noBpih, files: [ { jenisDokumen, fileName, mimeType, base64Data } ] }
 */
function uploadMultipleDokumenHaji(batchPayload) {
  try {
    setupUploadDokHajiSheet();

    if (!batchPayload || !batchPayload.nama || !Array.isArray(batchPayload.files) || batchPayload.files.length === 0) {
      return { success: false, message: 'Nama Jamaah dan minimal 1 file dokumen wajib diisi!' };
    }

    const nama = String(batchPayload.nama).trim();
    const noBpih = String(batchPayload.noBpih || '-').trim();
    const sheetUpload = getDb().getSheetByName(CONFIG_UPLOAD_DOC_HAJI.SHEET_NAME);
    
    if (!sheetUpload) {
      return { success: false, message: 'Sheet UploadDokHaji tidak dapat dibuka.' };
    }

    let successCount = 0;
    const uploadedResults = [];

    batchPayload.files.forEach((fileItem, idx) => {
      if (!fileItem || !fileItem.base64Data || !fileItem.jenisDokumen) return;

      const jenisDokumen = String(fileItem.jenisDokumen).trim();
      const rawFileName = String(fileItem.fileName || 'file').trim();

      let ext = '';
      const lastDot = rawFileName.lastIndexOf('.');
      if (lastDot !== -1) {
        ext = rawFileName.substring(lastDot);
      }

      // 1. Format Nama File
      const formattedName = generateHajiFileName_(jenisDokumen, noBpih, nama, ext);

      // 2. Ambil Folder Drive
      const folder = getTargetHajiUploadFolder_(jenisDokumen);

      // 3. Decode & simpan file ke Drive
      const rawBase64 = String(fileItem.base64Data || '');
      const cleanBase64 = rawBase64.includes(',') ? rawBase64.split(',')[1] : rawBase64;
      const bytes = Utilities.base64Decode(cleanBase64);
      const mimeType = fileItem.mimeType || 'application/octet-stream';
      const blob = Utilities.newBlob(bytes, mimeType, formattedName);

      const driveFile = folder.createFile(blob);

      try {
        driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      } catch (eShare) {}

      const fileUrl = driveFile.getUrl();
      const fileId = driveFile.getId();
      const createdFileName = driveFile.getName();

      // 4. Buat DocID & Simpan ke Sheet UploadDokHaji
      const timestampFormatted = typeof getJakartaTimeString === 'function' ? getJakartaTimeString() : new Date().toISOString();
      const lastRow = sheetUpload.getLastRow();
      const docId = 'DOCH-' + String(lastRow > 0 ? lastRow : 1).padStart(4, '0') + '-' + Math.floor(100 + Math.random() * 900);

      const newRow = [
        docId,
        timestampFormatted,
        noBpih,
        nama,
        jenisDokumen,
        createdFileName,
        fileUrl
      ];

      sheetUpload.appendRow(newRow);

      // 5. Sync Link ke Sheet DataJamaahHaji
      syncHajiDocToDataJamaahHajiSheet_(nama, noBpih, jenisDokumen, fileUrl);

      successCount++;
      uploadedResults.push({
        docId: docId,
        jenisDokumen: jenisDokumen,
        fileName: createdFileName,
        fileUrl: fileUrl
      });
    });

    return {
      success: true,
      message: successCount + ' berkas dokumen haji untuk ' + nama + ' berhasil diunggah!',
      uploadedCount: successCount,
      results: uploadedResults
    };

  } catch (e) {
    Logger.log('Error uploadMultipleDokumenHaji: ' + e.message);
    return { success: false, message: 'Gagal mengunggah dokumen haji: ' + e.message };
  }
}

/**
 * Mengambil daftar data dokumen haji yang telah diupload dari Sheet UploadDokHaji
 */
function getUploadDokHajiList() {
  try {
    setupUploadDokHajiSheet();
    const sheetUpload = getDb().getSheetByName(CONFIG_UPLOAD_DOC_HAJI.SHEET_NAME);
    if (!sheetUpload) return { success: true, data: [] };

    const lastRow = sheetUpload.getLastRow();
    if (lastRow <= 1) return { success: true, data: [] };

    const data = sheetUpload.getRange(2, 1, lastRow - 1, 7).getValues();
    const list = data.map((row, index) => {
      return {
        rowIndex: index + 2,
        docId: String(row[0] || ('DOCH-' + (index + 1))),
        timestamp: String(row[1] || ''),
        noBpih: String(row[2] || '-'),
        nama: String(row[3] || '-'),
        jenisDokumen: String(row[4] || '-'),
        fileName: String(row[5] || '-'),
        fileUrl: String(row[6] || '')
      };
    }).reverse(); // Urutan terbaru di atas

    return {
      success: true,
      data: list
    };
  } catch (e) {
    Logger.log('Error getUploadDokHajiList: ' + e.message);
    return { success: false, message: e.message, data: [] };
  }
}

/**
 * Menghapus data dokumen haji berdasarkan DocID
 */
function deleteUploadDokHaji(docId) {
  try {
    if (!docId) return { success: false, message: 'DocID tidak valid.' };
    const sheetUpload = getDb().getSheetByName(CONFIG_UPLOAD_DOC_HAJI.SHEET_NAME);
    if (!sheetUpload) return { success: false, message: 'Sheet tidak ditemukan.' };

    const lastRow = sheetUpload.getLastRow();
    if (lastRow <= 1) return { success: false, message: 'Data kosong.' };

    const docIds = sheetUpload.getRange(2, 1, lastRow - 1, 1).getValues();
    let targetRow = -1;

    for (let i = 0; i < docIds.length; i++) {
      if (String(docIds[i][0]).trim() === String(docId).trim()) {
        targetRow = i + 2;
        break;
      }
    }

    if (targetRow !== -1) {
      sheetUpload.deleteRow(targetRow);
      return { success: true, message: 'Dokumen Haji (' + docId + ') berhasil dihapus dari database.' };
    } else {
      return { success: false, message: 'Dokumen dengan ID ' + docId + ' tidak ditemukan.' };
    }
  } catch (e) {
    return { success: false, message: 'Gagal menghapus dokumen haji: ' + e.message };
  }
}

/* ============================================================================ */
/* RPC / API WRAPPER FUNCTIONS UNTUK APPSSCRIPT RUN & WEB SERVER                */
/* ============================================================================ */

function apiGetJamaahHajiDropdown(token) {
  return getJamaahHajiDropdownOptions();
}

function apiCheckJamaahHajiDocLinks(nama, noBpih, token) {
  return checkJamaahHajiExistingDocLinks(nama, noBpih);
}

function apiUploadMultipleDokumenHaji(payload, token) {
  return uploadMultipleDokumenHaji(payload);
}

function apiGetUploadDokHajiList(token, forceRefresh) {
  return getUploadDokHajiList();
}

/**
 * Mengambil rekap status kelengkapan dokumen haji seluruh jamaah (Untuk Dashboard Monitor)
 */
function getMonitoringDokumenHaji() {
  try {
    setupUploadDokHajiSheet();
    const sheetJamaahName = (CONFIG.SHEETS && CONFIG.SHEETS.DATA_JAMAAH_HAJI) || CONFIG_UPLOAD_DOC_HAJI.SHEET_JAMAAH_HAJI;
    const db = getDb();
    if (!db) return { success: false, message: 'Database tidak ditemukan', data: [] };
    
    const sheetJamaah = db.getSheetByName(sheetJamaahName);
    if (!sheetJamaah) return { success: false, message: 'Sheet DataJamaahHaji tidak ditemukan', data: [] };
    
    const data = sheetJamaah.getDataRange().getValues();
    if (data.length <= 1) return { success: true, data: [] };
    
    const headers = data[0].map(h => String(h || '').trim());
    
    const namaColIdx = headers.findIndex(h => {
      const hClean = h.toLowerCase().replace(/[^a-z0-9]/g, '');
      return hClean === 'nama' || hClean === 'namajamaah' || hClean === 'namanasabah';
    });
    const bpihColIdx = headers.findIndex(h => h.toLowerCase().replace(/[^a-z0-9]/g, '') === 'nobpih' || h.toLowerCase().replace(/[^a-z0-9]/g, '') === 'bpih');
    
    if (namaColIdx === -1) return { success: false, message: 'Kolom Nama Jamaah tidak ditemukan', data: [] };
    
    const headerMap = CONFIG_UPLOAD_DOC_HAJI.DATA_JAMAAH_HEADERS;
    const colIndexes = {};
    Object.keys(headerMap).forEach(jenisDoc => {
      const headerName = headerMap[jenisDoc];
      colIndexes[jenisDoc] = headers.findIndex(h => h.toLowerCase().replace(/[^a-z0-9]/g, '') === headerName.toLowerCase().replace(/[^a-z0-9]/g, ''));
    });
    
    const result = [];
    for (let r = 1; r < data.length; r++) {
      const nama = String(data[r][namaColIdx] || '').trim();
      const noBpih = bpihColIdx !== -1 ? String(data[r][bpihColIdx] || '').trim() : '-';
      
      if (nama && nama !== '-' && nama.toLowerCase() !== 'nama') {
        const links = {};
        let completeCount = 0;
        let totalDocs = Object.keys(headerMap).length;
        
        Object.keys(headerMap).forEach(jenisDoc => {
          const idx = colIndexes[jenisDoc];
          if (idx !== -1) {
            const val = String(data[r][idx] || '').trim();
            links[jenisDoc] = val;
            if (val !== '') completeCount++;
          } else {
            links[jenisDoc] = '';
          }
        });
        
        result.push({
          nama: nama.replace(/\s+/g, ' '),
          noBpih: noBpih,
          links: links,
          completeCount: completeCount,
          totalDocs: totalDocs,
          percentage: totalDocs > 0 ? Math.round((completeCount / totalDocs) * 100) : 0
        });
      }
    }
    
    // Sort by name
    result.sort((a, b) => a.nama.localeCompare(b.nama));
    
    return { success: true, data: result, jenisDokumenList: Object.keys(headerMap) };
    
  } catch (e) {
    Logger.log('Error getMonitoringDokumenHaji: ' + e.message);
    return { success: false, message: e.message, data: [] };
  }
}

function apiDeleteUploadDokHaji(docId, token) {
  return deleteUploadDokHaji(docId);
}

function apiGetMonitoringDokumenHaji(token) {
  return getMonitoringDokumenHaji();
}
