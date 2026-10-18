/**
 * ============================================================================
 * KELENGKAPAN UMRAH DATA MANAGER (KelengkapanUmrahManager.gs)
 * ============================================================================
 * Mengelola penyimpanan, pembaruan, dan pembacaan data kelengkapan dokumen Umrah:
 * 1. Visa (No Visa, Tanggal Berlaku, Tanggal Akhir, Upload Dokumen Visa)
 * 2. Asuransi (No Polis, Tanggal Input Polis, Tanggal Awal Polis, Tanggal Akhir Polis, Upload Polis)
 * 3. Nomor BPJS & Upload Dokumen BPJS
 * Terintegrasi dengan Sheet "KelengkapanUmrah" dan relasi ke Sheet "Data Jamaah" serta Google Drive.
 */

const KELENGKAPAN_UMRAH_CONFIG = {
  SHEET_NAME: 'KelengkapanUmrah',
  DEFAULT_FOLDER_ID: '12hJY5VGcTlgdSBHRqOxSLYg_zwB4C0gF',
  FOLDERS: {
    VISA: '12hJY5VGcTlgdSBHRqOxSLYg_zwB4C0gF',
    ASURANSI: '12hJY5VGcTlgdSBHRqOxSLYg_zwB4C0gF',
    BPJS: '14mojaJB6T5QK-awDRhG6Acg8cbdn8InH'
  },
  HEADERS: [
    'ID Kelengkapan',
    'ID Jamaah',
    'Nama Jamaah',
    'Nama Paket',
    'Agent',
    'No Visa',
    'Tanggal Berlaku Visa',
    'Tanggal Akhir Visa',
    'Upload Visa',
    'No Polis',
    'Tanggal Input Polis',
    'Tanggal Awal Polis',
    'Tanggal Akhir Polis',
    'Upload Asuransi',
    'Nomor BPJS',
    'Upload BPJS',
    'Status Kelengkapan',
    'Tanggal Input',
    'CreatedAt',
    'UpdatedAt',
    'User Input'
  ]
};

/**
 * Menyiapkan sheet "KelengkapanUmrah" jika belum ada serta memastikan kelengkapan header
 */
function setupKelengkapanUmrahSheet() {
  try {
    const ss = getDb();
    let sheet = ss.getSheetByName(KELENGKAPAN_UMRAH_CONFIG.SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(KELENGKAPAN_UMRAH_CONFIG.SHEET_NAME);
      sheet.appendRow(KELENGKAPAN_UMRAH_CONFIG.HEADERS);
    } else {
      const lastCol = Math.max(sheet.getLastColumn(), 1);
      const existingHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h || '').trim());
      const missing = KELENGKAPAN_UMRAH_CONFIG.HEADERS.filter(h => !existingHeaders.includes(h));
      if (missing.length > 0) {
        sheet.getRange(1, lastCol + 1, 1, missing.length).setValues([missing]);
      }
    }
    return sheet;
  } catch (e) {
    Logger.log('Error setupKelengkapanUmrahSheet: ' + e.message);
    const ss = getDb();
    let sheet = ss.getSheetByName(KELENGKAPAN_UMRAH_CONFIG.SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(KELENGKAPAN_UMRAH_CONFIG.SHEET_NAME);
      sheet.appendRow(KELENGKAPAN_UMRAH_CONFIG.HEADERS);
    }
    return sheet;
  }
}

/**
 * Upload berkas fisik dokumen kelengkapan (Visa, Asuransi, BPJS) ke Google Drive
 */
function uploadKelengkapanFileToDrive_(filePayload, prefix, idJamaah, namaJamaah, targetFolderId) {
  if (!filePayload || !filePayload.base64Data) return '';
  try {
    let folder;
    try {
      folder = DriveApp.getFolderById(targetFolderId || KELENGKAPAN_UMRAH_CONFIG.DEFAULT_FOLDER_ID);
    } catch (eF) {
      folder = DriveApp.getFolderById(KELENGKAPAN_UMRAH_CONFIG.DEFAULT_FOLDER_ID);
    }
    const fileNameOriginal = filePayload.fileName || 'dokumen.pdf';
    let ext = '.pdf';
    if (fileNameOriginal.includes('.')) {
      ext = '.' + fileNameOriginal.split('.').pop();
    } else if (filePayload.mimeType) {
      ext = filePayload.mimeType.includes('image') ? '.jpg' : '.pdf';
    }

    const cleanNama = String(namaJamaah || 'Jamaah').replace(/[^a-zA-Z0-9 ]/g, '_').trim();
    const cleanId = String(idJamaah || 'JM').replace(/[^a-zA-Z0-9]/g, '_').trim();
    const timestamp = new Date().getTime();
    const formattedFileName = `${prefix} - ${cleanId} - ${cleanNama}_${timestamp}${ext}`;

    const contentType = filePayload.mimeType || 'application/pdf';
    const decodedData = Utilities.base64Decode(filePayload.base64Data);
    const blob = Utilities.newBlob(decodedData, contentType, formattedFileName);

    const newFile = folder.createFile(blob);
    try {
      newFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (eSharing) {}
    return newFile.getUrl();
  } catch (err) {
    Logger.log('Error uploadKelengkapanFileToDrive_: ' + err.message);
    return '';
  }
}

/**
 * Mengambil seluruh data kelengkapan Umrah beserta relasi data paket dan jamaah
 */
function getKelengkapanUmrahData() {
  try {
    setupKelengkapanUmrahSheet();

    // 1. Ambil seluruh data jamaah dari JamaahManager
    const rawJamaahList = (typeof getJamaahList === 'function') ? getJamaahList() : [];
    
    // 2. Ambil data kelengkapan yang sudah tersimpan di sheet KelengkapanUmrah
    const rows = getSheetData(KELENGKAPAN_UMRAH_CONFIG.SHEET_NAME) || [];
    
    const kelengkapanMap = {};
    const kelengkapanRecords = rows.map((r, idx) => {
      const idJamaah = String(r['ID Jamaah'] || r.idjamaah || '').trim();
      const rec = {
        rowIndex: idx + 2,
        idKelengkapan: String(r['ID Kelengkapan'] || r.idkelengkapan || 'KUM-' + String(idx + 1).padStart(3, '0')).trim(),
        idJamaah: idJamaah,
        namaJamaah: String(r['Nama Jamaah'] || r.namajamaah || '').trim(),
        namaPaket: String(r['Nama Paket'] || r.namapaket || '').trim(),
        agent: String(r['Agent'] || r.agent || r.namaagen || r.referensi || '').trim(),
        noVisa: String(r['No Visa'] || r.novisa || '').trim(),
        tglBerlakuVisa: normalizeSheetDateValue(r['Tanggal Berlaku Visa'] || r.tglberlakuvisa),
        tglAkhirVisa: normalizeSheetDateValue(r['Tanggal Akhir Visa'] || r.tglakhirvisa),
        uploadVisa: String(r['Upload Visa'] || r['Link Visa'] || r.uploadvisa || '').trim(),
        noPolis: String(r['No Polis'] || r.nopolis || '').trim(),
        tglInputPolis: normalizeSheetDateValue(r['Tanggal Input Polis'] || r.tglinputpolis),
        tglAwalPolis: normalizeSheetDateValue(r['Tanggal Awal Polis'] || r.tglawalpolis),
        tglAkhirPolis: normalizeSheetDateValue(r['Tanggal Akhir Polis'] || r.tglakhirpolis),
        uploadAsuransi: String(r['Upload Asuransi'] || r['Link Asuransi'] || r.uploadasuransi || '').trim(),
        noBpjs: String(r['Nomor BPJS'] || r.nomorbpjs || r.nobpjs || '').trim(),
        uploadBpjs: String(r['Upload BPJS'] || r['Link BPJS'] || r.uploadbpjs || '').trim(),
        statusKelengkapan: String(r['Status Kelengkapan'] || r.statuskelengkapan || 'Belum Lengkap').trim(),
        tglInput: normalizeSheetDateValue(r['Tanggal Input'] || r.tglinput),
        createdAt: String(r['CreatedAt'] || r.createdat || '').trim(),
        updatedAt: String(r['UpdatedAt'] || r.updatedat || '').trim(),
        userInput: String(r['User Input'] || r.userinput || '').trim()
      };

      if (idJamaah) {
        kelengkapanMap[idJamaah.toLowerCase()] = rec;
      }
      return rec;
    });

    // 3. Ekstrak daftar unik Paket Umrah
    const paketSet = new Set();
    rawJamaahList.forEach(j => {
      const p = String(j.jenisPaket || j['Jenis Paket Umrah'] || '').trim();
      if (p) paketSet.add(p);
    });

    // Tambahkan juga jika ada data paket dari sheet Data Paket
    try {
      if (typeof getSheetData === 'function') {
        const paketRows = getSheetData(CONFIG.SHEETS.PAKET) || [];
        paketRows.forEach(pr => {
          const np = String(pr['Nama Paket'] || pr.namaPaket || pr.namapaket || '').trim();
          if (np) paketSet.add(np);
        });
      }
    } catch (ePaket) {}

    const paketList = Array.from(paketSet).sort();

    // 4. Perkaya data jamaah dengan status kelengkapan tersimpan
    const enrichedJamaahList = rawJamaahList.map(j => {
      const id = String(j.id || j['ID Jamaah'] || '').trim();
      const existing = kelengkapanMap[id.toLowerCase()] || null;
      const agentVal = String(j.namaAgen || j.referensi || j.agent || j['NamaAgen'] || j['Referensi'] || '-').trim();
      const paketVal = String(j.jenisPaket || j['Jenis Paket Umrah'] || '').trim();

      return {
        id: id,
        namaLengkap: String(j.namaLengkap || j['Nama Lengkap'] || '').trim(),
        jenisPaket: paketVal,
        agent: agentVal,
        noKtp: String(j.noKtp || j['Nomor KTP'] || '').trim(),
        noPassport: String(j.noPassport || j['Nomor Passport'] || '').trim(),
        noHp: String(j.noHp || j['Nomor Seluler'] || '').trim(),
        hasKelengkapan: !!existing,
        kelengkapan: existing || {
          noVisa: '',
          tglBerlakuVisa: '',
          tglAkhirVisa: '',
          uploadVisa: '',
          noPolis: '',
          tglInputPolis: '',
          tglAwalPolis: '',
          tglAkhirPolis: '',
          uploadAsuransi: '',
          noBpjs: '',
          uploadBpjs: '',
          statusKelengkapan: 'Belum Ada Data'
        }
      };
    });

    return {
      success: true,
      data: {
        jamaahList: enrichedJamaahList,
        paketList: paketList,
        records: kelengkapanRecords
      }
    };

  } catch (err) {
    Logger.log('Error getKelengkapanUmrahData: ' + err.message);
    return {
      success: false,
      message: 'Gagal memuat data kelengkapan Umrah: ' + err.message,
      data: { jamaahList: [], paketList: [], records: [] }
    };
  }
}

/**
 * Menyimpan atau memperbarui data kelengkapan Umrah seorang Jamaah beserta file unggahannya
 * @param {Object} payload Data kelengkapan
 * @param {Object} filePayloads { visa: { base64Data, fileName, mimeType }, asuransi: {...}, bpjs: {...} }
 * @param {string} userInput Nama user penanggung jawab
 */
function saveKelengkapanUmrah(payload, filePayloads = null, userInput = 'Admin') {
  try {
    if (!payload || !payload.idJamaah) {
      return { success: false, message: 'ID Jamaah wajib dipilih!' };
    }

    const sheet = setupKelengkapanUmrahSheet();
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h || '').trim());

    const idJamaahTarget = String(payload.idJamaah).trim();
    const nowStr = getJakartaTimeString();
    const todayDate = nowStr.split(' ')[0];

    // Upload dokumen jika disertakan
    if (filePayloads) {
      if (filePayloads.visa && filePayloads.visa.base64Data) {
        const urlVisa = uploadKelengkapanFileToDrive_(filePayloads.visa, 'Visa', idJamaahTarget, payload.namaJamaah, KELENGKAPAN_UMRAH_CONFIG.FOLDERS.VISA);
        if (urlVisa) payload.uploadVisa = urlVisa;
      }
      if (filePayloads.asuransi && filePayloads.asuransi.base64Data) {
        const urlAsuransi = uploadKelengkapanFileToDrive_(filePayloads.asuransi, 'Asuransi_Polis', idJamaahTarget, payload.namaJamaah, KELENGKAPAN_UMRAH_CONFIG.FOLDERS.ASURANSI);
        if (urlAsuransi) payload.uploadAsuransi = urlAsuransi;
      }
      if (filePayloads.bpjs && filePayloads.bpjs.base64Data) {
        const urlBpjs = uploadKelengkapanFileToDrive_(filePayloads.bpjs, 'BPJS', idJamaahTarget, payload.namaJamaah, KELENGKAPAN_UMRAH_CONFIG.FOLDERS.BPJS);
        if (urlBpjs) payload.uploadBpjs = urlBpjs;
      }
    }

    // Evaluasi Status Kelengkapan
    const hasVisa = Boolean(payload.noVisa && String(payload.noVisa).trim());
    const hasPolis = Boolean(payload.noPolis && String(payload.noPolis).trim());
    const hasBpjs = Boolean(payload.noBpjs && String(payload.noBpjs).trim());

    let statusKelengkapan = 'Belum Lengkap';
    if (hasVisa && hasPolis && hasBpjs) {
      statusKelengkapan = 'Lengkap';
    } else if (hasVisa || hasPolis || hasBpjs) {
      statusKelengkapan = 'Sebagian';
    }

    // Cari apakah ID Jamaah sudah pernah disimpan
    let existingRowIndex = -1;
    let existingIdKelengkapan = '';

    for (let i = 1; i < data.length; i++) {
      const rowIdJamaah = String(data[i][headers.indexOf('ID Jamaah')] || data[i][1] || '').trim();
      if (rowIdJamaah.toLowerCase() === idJamaahTarget.toLowerCase()) {
        existingRowIndex = i + 1;
        existingIdKelengkapan = String(data[i][headers.indexOf('ID Kelengkapan')] || data[i][0] || '').trim();
        break;
      }
    }

    if (!existingIdKelengkapan) {
      const nextNum = Math.max(data.length, 1);
      existingIdKelengkapan = 'KUM-' + String(nextNum).padStart(3, '0');
    }

    const rowMap = {
      'ID Kelengkapan': existingIdKelengkapan,
      'ID Jamaah': idJamaahTarget,
      'Nama Jamaah': String(payload.namaJamaah || '').trim(),
      'Nama Paket': String(payload.namaPaket || '').trim(),
      'Agent': String(payload.agent || '').trim(),
      'No Visa': String(payload.noVisa || '').trim(),
      'Tanggal Berlaku Visa': String(payload.tglBerlakuVisa || '').trim(),
      'Tanggal Akhir Visa': String(payload.tglAkhirVisa || '').trim(),
      'Upload Visa': String(payload.uploadVisa || '').trim(),
      'No Polis': String(payload.noPolis || '').trim(),
      'Tanggal Input Polis': String(payload.tglInputPolis || todayDate).trim(),
      'Tanggal Awal Polis': String(payload.tglAwalPolis || '').trim(),
      'Tanggal Akhir Polis': String(payload.tglAkhirPolis || '').trim(),
      'Upload Asuransi': String(payload.uploadAsuransi || '').trim(),
      'Nomor BPJS': formatTextNumberVal(payload.noBpjs || ''),
      'Upload BPJS': String(payload.uploadBpjs || '').trim(),
      'Status Kelengkapan': statusKelengkapan,
      'Tanggal Input': String(payload.tglInput || todayDate).trim(),
      'CreatedAt': existingRowIndex > 0 ? String(data[existingRowIndex - 1][headers.indexOf('CreatedAt')] || nowStr) : nowStr,
      'UpdatedAt': nowStr,
      'User Input': String(userInput || 'Admin').trim()
    };

    const rowValues = headers.map(col => rowMap.hasOwnProperty(col) ? rowMap[col] : '');

    if (existingRowIndex > 0) {
      // Update baris eksisting
      sheet.getRange(existingRowIndex, 1, 1, headers.length).setValues([rowValues]);
      return {
        success: true,
        message: 'Data & dokumen kelengkapan Jamaah ' + (payload.namaJamaah || idJamaahTarget) + ' berhasil diperbarui (' + statusKelengkapan + ')!',
        idKelengkapan: existingIdKelengkapan,
        statusKelengkapan: statusKelengkapan,
        uploadVisa: payload.uploadVisa || '',
        uploadAsuransi: payload.uploadAsuransi || '',
        uploadBpjs: payload.uploadBpjs || ''
      };
    } else {
      // Tambah baris baru
      sheet.appendRow(rowValues);
      return {
        success: true,
        message: 'Data & dokumen kelengkapan Jamaah ' + (payload.namaJamaah || idJamaahTarget) + ' berhasil disimpan (' + statusKelengkapan + ')!',
        idKelengkapan: existingIdKelengkapan,
        statusKelengkapan: statusKelengkapan,
        uploadVisa: payload.uploadVisa || '',
        uploadAsuransi: payload.uploadAsuransi || '',
        uploadBpjs: payload.uploadBpjs || ''
      };
    }

  } catch (err) {
    Logger.log('Error saveKelengkapanUmrah: ' + err.message);
    return { success: false, message: 'Gagal menyimpan kelengkapan Umrah: ' + err.message };
  }
}

/**
 * Menghapus data kelengkapan Umrah seorang Jamaah
 * @param {string} idJamaah 
 */
function deleteKelengkapanUmrah(idJamaah) {
  try {
    if (!idJamaah) return { success: false, message: 'ID Jamaah tidak valid!' };

    const sheet = setupKelengkapanUmrahSheet();
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h || '').trim());
    const idxIdJamaah = headers.indexOf('ID Jamaah');
    const idxIdKel = headers.indexOf('ID Kelengkapan');
    let deletedCount = 0;

    for (let i = data.length - 1; i >= 1; i--) {
      const rowIdJamaah = String(data[i][idxIdJamaah >= 0 ? idxIdJamaah : 1] || '').trim().toLowerCase();
      const rowIdKelengkapan = String(data[i][idxIdKel >= 0 ? idxIdKel : 0] || '').trim().toLowerCase();
      const target = String(idJamaah).trim().toLowerCase();

      if (rowIdJamaah === target || rowIdKelengkapan === target) {
        sheet.deleteRow(i + 1);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      return { success: true, message: 'Data kelengkapan Umrah berhasil dihapus!' };
    }
    return { success: false, message: 'Data kelengkapan tidak ditemukan!' };

  } catch (err) {
    Logger.log('Error deleteKelengkapanUmrah: ' + err.message);
    return { success: false, message: 'Gagal menghapus data kelengkapan: ' + err.message };
  }
}
