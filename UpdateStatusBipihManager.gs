/**
 * ============================================================================
 * UPDATE STATUS BIPIH MANAGER (UpdateStatusBipihManager.gs)
 * ============================================================================
 * Backend Manager khusus untuk Modul Update Status BIPIH (mod_update_status_bipih).
 * Mengelola penyimpanan riwayat update status pelunasan BPIH, upload bukti bayar
 * & upload dokumen PK ke Google Drive folder khusus, serta sinkronisasi status ke Sheet ViewHajjData / DataJamaahHaji.
 */

const CONFIG_UPDATE_BIPIH = {
  SHEET_NAME: 'UpdateBIPIH',
  FOLDER_ID_SETOR: '1Ibsphh0bZ6X2Miig8Y_oWt2eCT8gpt8f',
  FOLDER_ID_PK: '1q86NJ-peCDPY2ZQmuTir783M4VfZXFhr',
  HEADERS: [
    'NoBPIH',
    'NamaJamaah',
    'TanggalPelunasan',
    'TahunLunasHijriah',
    'BuktiSetorLunas',
    'StatusPK',
    'TanggalPK',
    'StatusPK2',
    'TanggalPK2',
    'Bank',
    'NoJurnal',
    'BankTerimaPK',
    'UploadDokumenPK',
    'BuktiTransferTunda',
    'User',
    'Timestamp',
    'IDTransaksi',
    'HargaPaketHaji',
    'Kurs',
    'TipeKamar',
    'TglTerimaNilaiManfaat',
    'BankNilaiManfaat',
    'JumlahUsdNilaiManfaat',
    'KursNilaiManfaat',
    'NoJurnalNilaiManfaat',
    'KetNilaiManfaat'
  ]
};

/**
 * Memastikan Sheet UpdateBIPIH siap digunakan dengan header yang sesuai 
 * dan mendaftarkan modul ke Sheet Modules secara otomatis
 */
function setupUpdateStatusBipihSheet() {
  try {
    const db = getDb();
    if (!db) return null;

    // Registrasikan modul ke Sheet Modules jika belum ada
    registerUpdateStatusBipihModule_(db);

    let sheet = db.getSheetByName(CONFIG_UPDATE_BIPIH.SHEET_NAME);
    if (!sheet) {
      sheet = db.insertSheet(CONFIG_UPDATE_BIPIH.SHEET_NAME);
      sheet.appendRow(CONFIG_UPDATE_BIPIH.HEADERS);
      const headerRange = sheet.getRange(1, 1, 1, CONFIG_UPDATE_BIPIH.HEADERS.length);
      headerRange.setBackground('#1e293b');
      headerRange.setFontColor('#ffffff');
      headerRange.setFontWeight('bold');
      sheet.setFrozenRows(1);
    } else {
      ensureSheetHeaders(sheet, CONFIG_UPDATE_BIPIH.HEADERS);
    }
    return sheet;
  } catch (e) {
    Logger.log('Error setupUpdateStatusBipihSheet: ' + e.message);
    return null;
  }
}

/**
 * Mendaftarkan modul mod_update_status_bipih ke dalam Sheet Modules
 */
function registerUpdateStatusBipihModule_(db) {
  try {
    if (!db) return;
    const moduleSheet = db.getSheetByName('Modules') || db.getSheetByName('MODULES');
    if (!moduleSheet) return;

    const data = moduleSheet.getDataRange().getValues();
    if (data.length <= 1) return;

    const headers = data[0].map(h => String(h || '').trim().toLowerCase().replace(/[^a-z0-9]/g, ''));
    const idColIdx = headers.findIndex(h => h === 'moduleid' || h === 'id');
    if (idColIdx === -1) return;

    const exists = data.some((row, r) => r > 0 && String(row[idColIdx] || '').trim().toLowerCase() === 'mod_update_status_bipih');
    if (!exists) {
      moduleSheet.appendRow([
        'mod_update_status_bipih',
        'Update Status BIPIH',
        'Jamaah',
        'Active',
        'fa-solid fa-file-invoice-dollar',
        'Admin,Manager,Staff',
        29,
        'Form update pelunasan status BIPIH (C/F) & pencatatan riwayat transaksi ke sheet UpdateBIPIH'
      ]);
    }
  } catch (e) {
    Logger.log('Error registerUpdateStatusBipihModule_: ' + e.message);
  }
}

/**
 * Membaca data history Update BIPIH dan daftar Jamaah Haji untuk dropdown form
 */
function getUpdateStatusBipihData() {
  try {
    const db = getDb();
    if (!db) {
      return { success: false, message: 'Database Spreadsheet tidak dapat diakses', history: [], jamaahList: [] };
    }

    try { SpreadsheetApp.flush(); } catch(e) {}

    // 1. Ambil daftar Jamaah Haji khusus dari Sheet DataJamaahHaji (header NoBPIH dan Nama)
    let jamaahList = getJamaahListFromDataJamaahHajiSheet_(db);
    if ((!jamaahList || jamaahList.length === 0) && typeof getViewJamaahHajiData === 'function') {
      const jamaahRes = getViewJamaahHajiData();
      if (jamaahRes && jamaahRes.success && Array.isArray(jamaahRes.data)) {
        jamaahList = jamaahRes.data;
      }
    }

    // 2. Ambil data history dari Sheet UpdateBIPIH
    const sheet = setupUpdateStatusBipihSheet();
    if (!sheet || sheet.getLastRow() <= 1) {
      return {
        success: true,
        history: [],
        jamaahList: jamaahList,
        summary: { totalHistory: 0 }
      };
    }

    const lastRow = sheet.getLastRow();
    const maxCols = sheet.getMaxColumns();
    const lastCol = Math.min(Math.max(sheet.getLastColumn(), CONFIG_UPDATE_BIPIH.HEADERS.length), maxCols);
    const dataRange = sheet.getRange(1, 1, lastRow, lastCol).getDisplayValues();

    const rawHeaders = dataRange[0].map(h => String(h || '').trim());
    const rows = dataRange.slice(1);

    const history = rows
      .filter(row => row.some(cell => cell !== undefined && cell !== null && String(cell).trim() !== ''))
      .map((row, idx) => {
        const normKey = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const normRowObj = {};
        rawHeaders.forEach((h, colIdx) => {
          const k = normKey(h);
          if (k) normRowObj[k] = row[colIdx];
        });

        const getVal = (possibleKeys, defaultVal = '') => {
          for (let i = 0; i < possibleKeys.length; i++) {
            const pk = normKey(possibleKeys[i]);
            if (normRowObj[pk] !== undefined && normRowObj[pk] !== null && String(normRowObj[pk]).trim() !== '') {
              return String(normRowObj[pk]).trim();
            }
          }
          return defaultVal;
        };

        const idTrx = getVal(['idtransaksi', 'id_transaksi', 'nomortransaksi', 'id'], 'TRX-BP-' + (idx + 1));
        const noBpih = getVal(['nobpih', 'no_bpih', 'bpih'], '-');
        const nama = getVal(['namajamaah', 'nama_jamaah', 'nama'], '-');
        const tglLunas = getVal(['tanggalpelunasan', 'tglpelunasan', 'tgl_lunas'], '-');
        const thnHijriah = getVal(['tahunlunashijriah', 'tahun_lunas_hijriah', 'tahunhijriah'], '1447H');
        const buktiLunas = getVal(['buktisetorlunas', 'bukti_setor_lunas', 'buktisetor'], '');
        const statusPk = getVal(['statuspk', 'status_pk'], '-');
        const tglPk = getVal(['tanggalpk', 'tglpk'], '-');
        const statusPk2 = getVal(['statuspk2', 'status_pk2', 'status_pk_2'], '-');
        const tglPk2 = getVal(['tanggalpk2', 'tglpk2', 'tgl_pk_2'], '-');
        const bank = getVal(['bank', 'bankpk', 'bank_pk'], '-');
        const noJurnal = getVal(['nojurnal', 'no_jurnal'], '-');
        const bankTerimaPk = getVal(['bankterimapk', 'bank_terima_pk'], '-');
        const uploadDokPk = getVal(['uploaddokumenpk', 'upload_dokumen_pk', 'uploaddokumen'], '');
        const tglTunda = getVal(['tgltunda', 'tgl_tunda'], '-');
        const buktiTunda = getVal(['buktitransfertunda', 'bukti_transfer_tunda'], '');
        const hargaPaketHaji = getVal(['hargapakethaji', 'harga_paket_haji', 'hargapaket'], '');
        const kurs = getVal(['kurs', 'kursrupiah'], '');
        const tipeKamar = getVal(['tipekamar', 'tipe_kamar', 'kamar'], '');
        const tglTerimaNilaiManfaat = getVal(['tglterimanilaimanfaat', 'tgl_terima_nilai_manfaat'], '-');
        const bankNilaiManfaat = getVal(['banknilaimanfaat', 'bank_nilai_manfaat'], '-');
        const jumlahUsdNilaiManfaat = getVal(['jumlahusdnilaimanfaat', 'jumlah_usd_nilai_manfaat'], '');
        const kursNilaiManfaat = getVal(['kursnilaimanfaat', 'kurs_nilai_manfaat'], '');
        const noJurnalNilaiManfaat = getVal(['nojurnalnilaimanfaat', 'no_jurnal_nilai_manfaat'], '-');
        const ketNilaiManfaat = getVal(['ketnilaimanfaat', 'ket_nilai_manfaat', 'keterangan_nilai_manfaat'], '-');
        const user = getVal(['user', 'updatedby'], 'Admin');
        const timestamp = getVal(['timestamp', 'createdat'], '-');

        return {
          _rowIndex: idx + 2,
          idTransaksi: idTrx,
          noBpih: noBpih,
          namaJamaah: nama,
          tanggalPelunasan: tglLunas,
          tahunLunasHijriah: thnHijriah,
          buktiSetorLunas: buktiLunas,
          statusPk: statusPk,
          tanggalPk: tglPk,
          statusPk2: statusPk2,
          tanggalPk2: tglPk2,
          bank: bank,
          noJurnal: noJurnal,
          bankTerimaPk: bankTerimaPk,
          uploadDokumenPk: uploadDokPk,
          tglTunda: tglTunda,
          buktiTransferTunda: buktiTunda,
          hargaPaketHaji: hargaPaketHaji,
          kurs: kurs,
          tipeKamar: tipeKamar,
          tglTerimaNilaiManfaat: tglTerimaNilaiManfaat,
          bankNilaiManfaat: bankNilaiManfaat,
          jumlahUsdNilaiManfaat: jumlahUsdNilaiManfaat,
          kursNilaiManfaat: kursNilaiManfaat,
          noJurnalNilaiManfaat: noJurnalNilaiManfaat,
          ketNilaiManfaat: ketNilaiManfaat,
          user: user,
          timestamp: timestamp,
          rawObj: normRowObj
        };
      })
      .reverse(); // Urutan terbaru di atas

    return {
      success: true,
      history: history,
      jamaahList: jamaahList,
      summary: { totalHistory: history.length }
    };
  } catch (e) {
    Logger.log('Error getUpdateStatusBipihData: ' + e.message);
    return { success: false, message: e.message, history: [], jamaahList: [] };
  }
}

/**
 * Menyimpan data record Update BIPIH baru & Upload file bukti ke Google Drive
 */
function saveUpdateStatusBipihRecord(payload, filePayloadBukti, filePayloadTunda, filePayloadPk, username) {
  try {
    if (!payload || !payload.noBpih || !payload.namaJamaah) {
      return { success: false, message: 'Nomor BPIH dan Nama Jamaah wajib diisi.' };
    }

    const sheet = setupUpdateStatusBipihSheet();
    if (!sheet) {
      return { success: false, message: 'Gagal menyiapkan Sheet UpdateBIPIH.' };
    }

    let buktiLunasUrl = payload.buktiSetorLunas || '';
    let buktiTundaUrl = payload.buktiTransferTunda || '';
    let uploadDokPkUrl = payload.uploadDokumenPk || '';

    // 1. Upload Bukti Setor Lunas ke Google Drive Folder 1Ibsphh0bZ6X2Miig8Y_oWt2eCT8gpt8f
    if (filePayloadBukti && filePayloadBukti.base64Data) {
      try {
        const folder = DriveApp.getFolderById(CONFIG_UPDATE_BIPIH.FOLDER_ID_SETOR);
        const fileNameOriginal = filePayloadBukti.fileName || 'file.pdf';
        let ext = '.pdf';
        if (fileNameOriginal.includes('.')) {
          ext = '.' + fileNameOriginal.split('.').pop();
        }

        // Format Nama File: "BPIHLunas - "+ TahunLunasHijriah +" - " +NoBPIH +" - "+Nama+extensi
        const thnHijriah = payload.tahunLunasHijriah || '1447H';
        const formattedFileName = `BPIHLunas - ${thnHijriah} - ${payload.noBpih} - ${payload.namaJamaah}${ext}`;

        const contentType = filePayloadBukti.mimeType || 'application/pdf';
        const decodedData = Utilities.base64Decode(filePayloadBukti.base64Data);
        const blob = Utilities.newBlob(decodedData, contentType, formattedFileName);

        const newFile = folder.createFile(blob);
        try { newFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch(eSharing) {}
        buktiLunasUrl = newFile.getUrl();
      } catch (eFile) {
        Logger.log('Error Upload Bukti Lunas: ' + eFile.message);
      }
    }

    // 2. Upload Dokumen PK ke Google Drive Folder 1q86NJ-peCDPY2ZQmuTir783M4VfZXFhr
    if (filePayloadPk && filePayloadPk.base64Data) {
      try {
        const folderPK = DriveApp.getFolderById(CONFIG_UPDATE_BIPIH.FOLDER_ID_PK);
        const fileNameOriginal = filePayloadPk.fileName || 'file.pdf';
        let ext = '.pdf';
        if (fileNameOriginal.includes('.')) {
          ext = '.' + fileNameOriginal.split('.').pop();
        }

        // Format Nama File: "PK - "+NoBPIH+"-"+Nama+"-"+ekstensi
        const formattedFileName = `PK - ${payload.noBpih} - ${payload.namaJamaah}${ext}`;
        const contentType = filePayloadPk.mimeType || 'application/pdf';
        const decodedData = Utilities.base64Decode(filePayloadPk.base64Data);
        const blob = Utilities.newBlob(decodedData, contentType, formattedFileName);

        const newFilePK = folderPK.createFile(blob);
        try { newFilePK.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch(eSharingPK) {}
        uploadDokPkUrl = newFilePK.getUrl();
      } catch (eFilePK) {
        Logger.log('Error Upload Dokumen PK: ' + eFilePK.message);
      }
    }

    // 3. Upload Bukti Transfer Tunda jika disertakan
    if (filePayloadTunda && filePayloadTunda.base64Data) {
      try {
        const folder = DriveApp.getFolderById(CONFIG_UPDATE_BIPIH.FOLDER_ID_SETOR);
        const fileNameOriginal = filePayloadTunda.fileName || 'file.pdf';
        let ext = '.pdf';
        if (fileNameOriginal.includes('.')) {
          ext = '.' + fileNameOriginal.split('.').pop();
        }

        const formattedFileName = `BuktiTunda - ${payload.noBpih} - ${payload.namaJamaah}${ext}`;
        const contentType = filePayloadTunda.mimeType || 'application/pdf';
        const decodedData = Utilities.base64Decode(filePayloadTunda.base64Data);
        const blob = Utilities.newBlob(decodedData, contentType, formattedFileName);

        const newFile = folder.createFile(blob);
        try { newFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch(eSharing2) {}
        buktiTundaUrl = newFile.getUrl();
      } catch (eFile2) {
        Logger.log('Error Upload Bukti Tunda: ' + eFile2.message);
      }
    }

    // 4. Cek apakah record dengan NoBPIH & TahunLunasHijriah sudah ada di Sheet UpdateBIPIH
    let existingRowIndex = -1;
    let existingIdTrx = '';
    if (sheet.getLastRow() > 1) {
      const data = sheet.getDataRange().getValues();
      const headers = data[0].map(h => String(h || '').trim());
      const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const bpihIdx = headers.findIndex(h => norm(h) === 'nobpih');
      const thnIdx = headers.findIndex(h => norm(h) === 'tahunlunashijriah');
      const idIdx = headers.findIndex(h => norm(h) === 'idtransaksi');

      const targetBpih = norm(payload.noBpih);
      const targetThn = norm(payload.tahunLunasHijriah);
      const targetId = payload.existingTrxId || payload.idTransaksi;

      for (let r = 1; r < data.length; r++) {
        const rowBpih = bpihIdx !== -1 ? norm(data[r][bpihIdx]) : '';
        const rowThn = thnIdx !== -1 ? norm(data[r][thnIdx]) : '';
        const rowId = idIdx !== -1 ? String(data[r][idIdx] || '').trim() : '';

        if (targetId && rowId === String(targetId).trim()) {
          existingRowIndex = r + 1;
          existingIdTrx = rowId;
          break;
        } else if (targetBpih && rowBpih === targetBpih && (!targetThn || rowThn === targetThn)) {
          existingRowIndex = r + 1;
          existingIdTrx = rowId;
          break;
        }
      }
    }

    const timeNow = typeof getJakartaTimeString === 'function' ? getJakartaTimeString() : new Date().toISOString();
    const userActive = username || 'Admin';

    if (existingRowIndex !== -1) {
      // UPDATE EXISTING ROW
      const idTrxToUse = existingIdTrx || payload.existingTrxId || ('TRX-BP-' + Date.now());
      const data = sheet.getDataRange().getValues();
      const headers = data[0].map(h => String(h || '').trim());
      const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

      const updateCol = (headerName, val) => {
        const cIdx = headers.findIndex(h => norm(h) === norm(headerName));
        if (cIdx !== -1 && val !== undefined) {
          sheet.getRange(existingRowIndex, cIdx + 1).setValue(val);
        }
      };

      updateCol('NoBPIH', payload.noBpih);
      updateCol('NamaJamaah', payload.namaJamaah);
      updateCol('TanggalPelunasan', payload.tanggalPelunasan);
      updateCol('TahunLunasHijriah', payload.tahunLunasHijriah);
      if (buktiLunasUrl) updateCol('BuktiSetorLunas', buktiLunasUrl);
      updateCol('StatusPK', payload.statusPk);
      updateCol('TanggalPK', payload.tanggalPk);
      updateCol('StatusPK2', payload.statusPk2);
      updateCol('TanggalPK2', payload.tanggalPk2);
      updateCol('Bank', payload.bank);
      updateCol('NoJurnal', payload.noJurnal);
      updateCol('BankTerimaPK', payload.bankTerimaPk);
      if (uploadDokPkUrl) updateCol('UploadDokumenPK', uploadDokPkUrl);
      updateCol('TglTunda', payload.tglTunda);
      if (buktiTundaUrl) updateCol('BuktiTransferTunda', buktiTundaUrl);
      updateCol('HargaPaketHaji', payload.hargaPaketHaji);
      updateCol('Kurs', payload.kurs);
      
      const tipeKamarFinal = payload.tipeKamarSelect === 'custom' ? payload.tipeKamarCustom : (payload.tipeKamarSelect || payload.tipeKamar);
      updateCol('TipeKamar', tipeKamarFinal);
      updateCol('TglTerimaNilaiManfaat', payload.tglTerimaNilaiManfaat);
      updateCol('BankNilaiManfaat', payload.bankNilaiManfaat);
      updateCol('JumlahUsdNilaiManfaat', payload.jumlahUsdNilaiManfaat);
      updateCol('KursNilaiManfaat', payload.kursNilaiManfaat);
      updateCol('NoJurnalNilaiManfaat', payload.noJurnalNilaiManfaat);
      updateCol('KetNilaiManfaat', payload.ketNilaiManfaat);
      
      updateCol('User', userActive);
      updateCol('Timestamp', timeNow);

      SpreadsheetApp.flush();
      syncStatusBipihLunasToJamaahSheet_(payload.namaJamaah, payload.noBpih, payload.tanggalPelunasan, buktiLunasUrl);

      return {
        success: true,
        message: 'Berhasil memperbarui record Status BIPIH Jamaah ' + payload.namaJamaah,
        idTransaksi: idTrxToUse,
        buktiSetorLunas: buktiLunasUrl,
        uploadDokumenPk: uploadDokPkUrl
      };
    } else {
      // APPEND NEW ROW
      const idTransaksi = 'TRX-BP-' + Date.now();
      const rowData = [
        payload.noBpih || '',
        payload.namaJamaah || '',
        payload.tanggalPelunasan || '',
        payload.tahunLunasHijriah || '1447H',
        buktiLunasUrl,
        payload.statusPk || '-',
        payload.tanggalPk || '',
        payload.statusPk2 || '-',
        payload.tanggalPk2 || '',
        payload.bank || '',
        payload.noJurnal || '',
        payload.bankTerimaPk || '',
        uploadDokPkUrl,
        payload.tglTunda || '',
        buktiTundaUrl,
        userActive,
        timeNow,
        idTransaksi,
        payload.hargaPaketHaji || '',
        payload.kurs || '',
        (payload.tipeKamarSelect === 'custom' ? payload.tipeKamarCustom : (payload.tipeKamarSelect || payload.tipeKamar)) || '',
        payload.tglTerimaNilaiManfaat || '',
        payload.bankNilaiManfaat || '',
        payload.jumlahUsdNilaiManfaat || '',
        payload.kursNilaiManfaat || '',
        payload.noJurnalNilaiManfaat || '',
        payload.ketNilaiManfaat || ''
      ];

      sheet.appendRow(rowData);
      SpreadsheetApp.flush();
      syncStatusBipihLunasToJamaahSheet_(payload.namaJamaah, payload.noBpih, payload.tanggalPelunasan, buktiLunasUrl);

      return {
        success: true,
        message: 'Berhasil menyimpan Update BIPIH Jamaah ' + payload.namaJamaah,
        idTransaksi: idTransaksi,
        buktiSetorLunas: buktiLunasUrl,
        uploadDokumenPk: uploadDokPkUrl
      };
    }
  } catch (e) {
    Logger.log('Error saveUpdateStatusBipihRecord: ' + e.message);
    return { success: false, message: 'Gagal menyimpan update BIPIH: ' + e.message };
  }
}

/**
 * Sinkronisasi status BPIH Lunas (StatusBPIH = 'F') ke Sheet ViewHajjData / DataJamaahHaji
 */
function syncStatusBipihLunasToJamaahSheet_(nama, noBpih, tglLunas, buktiUrl) {
  try {
    const db = getDb();
    if (!db) return;

    const sheetNames = [
      // Di-disable karena sheet ini sifatnya hanya view
      // (CONFIG.SHEETS && CONFIG.SHEETS.VIEW_HAJJ_DATA) || 'ViewHajjData',
      (CONFIG.SHEETS && CONFIG.SHEETS.DATA_JAMAAH_HAJI) || 'DataJamaahHaji'
    ];

    sheetNames.forEach(shName => {
      const sheet = db.getSheetByName(shName);
      if (!sheet || sheet.getLastRow() <= 1) return;

      const data = sheet.getDataRange().getValues();
      const headers = data[0].map(h => String(h || '').trim());
      const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

      const namaColIdx = headers.findIndex(h => ['nama', 'namajamaah', 'namanasabah'].includes(norm(h)));
      const bpihColIdx = headers.findIndex(h => ['nobpih', 'bpih'].includes(norm(h)));
      const statusColIdx = headers.findIndex(h => ['statusbpih', 'status_bpih', 'statushaji'].includes(norm(h)));
      const tglLunasColIdx = headers.findIndex(h => ['tgllunas', 'tgl_lunas', 'tanggalpelunasan'].includes(norm(h)));
      const buktiColIdx = headers.findIndex(h => ['bpihlunas', 'buktisetor', 'buktisetorlunas'].includes(norm(h)));

      if (namaColIdx === -1) return;

      const targetNama = String(nama).trim().toLowerCase();
      const targetBpih = String(noBpih || '').trim().toLowerCase();

      for (let r = 1; r < data.length; r++) {
        const rowNama = String(data[r][namaColIdx] || '').trim().toLowerCase();
        const rowBpih = bpihColIdx !== -1 ? String(data[r][bpihColIdx] || '').trim().toLowerCase() : '';

        if (rowNama === targetNama || (targetBpih && rowBpih === targetBpih)) {
          // Update StatusBPIH = 'F'
          if (statusColIdx !== -1) {
            sheet.getRange(r + 1, statusColIdx + 1).setValue('F');
          }
          // Update Tanggal Pelunasan
          if (tglLunasColIdx !== -1 && tglLunas) {
            sheet.getRange(r + 1, tglLunasColIdx + 1).setValue(tglLunas);
          }
          // Update Bukti Setor Lunas Link
          if (buktiColIdx !== -1 && buktiUrl) {
            sheet.getRange(r + 1, buktiColIdx + 1).setValue(buktiUrl);
          }
        }
      }
    });
  } catch (e) {
    Logger.log('Error syncStatusBipihLunasToJamaahSheet_: ' + e.message);
  }
}

/**
 * Mengedit/Memperbarui record di Sheet UpdateBIPIH berdasarkan IDTransaksi / RowIndex
 */
function updateUpdateStatusBipihRecord(idTransaksi, payload, username) {
  try {
    const sheet = setupUpdateStatusBipihSheet();
    if (!sheet || sheet.getLastRow() <= 1) {
      return { success: false, message: 'Sheet UpdateBIPIH kosong.' };
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h || '').trim());
    const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    const idColIdx = headers.findIndex(h => norm(h) === 'idtransaksi');
    if (idColIdx === -1) return { success: false, message: 'Kolom IDTransaksi tidak ditemukan.' };

    let targetRowIndex = -1;
    for (let r = 1; r < data.length; r++) {
      if (String(data[r][idColIdx] || '').trim() === String(idTransaksi).trim()) {
        targetRowIndex = r + 1;
        break;
      }
    }

    if (targetRowIndex === -1) {
      return { success: false, message: 'Record dengan ID Transaksi ' + idTransaksi + ' tidak ditemukan.' };
    }

    // Update cell values
    const updateCol = (headerName, val) => {
      const cIdx = headers.findIndex(h => norm(h) === norm(headerName));
      if (cIdx !== -1 && val !== undefined) {
        sheet.getRange(targetRowIndex, cIdx + 1).setValue(val);
      }
    };

    updateCol('NoBPIH', payload.noBpih);
    updateCol('NamaJamaah', payload.namaJamaah);
    updateCol('TanggalPelunasan', payload.tanggalPelunasan);
    updateCol('TahunLunasHijriah', payload.tahunLunasHijriah);
    if (payload.buktiSetorLunas) updateCol('BuktiSetorLunas', payload.buktiSetorLunas);
    updateCol('StatusPK', payload.statusPk);
    updateCol('TanggalPK', payload.tanggalPk);
    updateCol('StatusPK2', payload.statusPk2);
    updateCol('TanggalPK2', payload.tanggalPk2);
    updateCol('Bank', payload.bank);
    updateCol('NoJurnal', payload.noJurnal);
    updateCol('BankTerimaPK', payload.bankTerimaPk);
    if (payload.uploadDokumenPk) updateCol('UploadDokumenPK', payload.uploadDokumenPk);
    updateCol('TglTunda', payload.tglTunda);
    if (payload.buktiTransferTunda) updateCol('BuktiTransferTunda', payload.buktiTransferTunda);
    
    updateCol('HargaPaketHaji', payload.hargaPaketHaji);
    updateCol('Kurs', payload.kurs);
    const tipeKamarFinal = payload.tipeKamarSelect === 'custom' ? payload.tipeKamarCustom : (payload.tipeKamarSelect || payload.tipeKamar);
    updateCol('TipeKamar', tipeKamarFinal);

    updateCol('User', username || 'Admin');
    updateCol('Timestamp', typeof getJakartaTimeString === 'function' ? getJakartaTimeString() : new Date().toISOString());

    SpreadsheetApp.flush();
    return { success: true, message: 'Record Update BIPIH berhasil diperbarui.' };
  } catch (e) {
    Logger.log('Error updateUpdateStatusBipihRecord: ' + e.message);
    return { success: false, message: e.message };
  }
}

/**
 * Menghapus record dari Sheet UpdateBIPIH berdasarkan IDTransaksi
 */
function deleteUpdateStatusBipihRecord(idTransaksi) {
  try {
    const sheet = setupUpdateStatusBipihSheet();
    if (!sheet || sheet.getLastRow() <= 1) {
      return { success: false, message: 'Sheet UpdateBIPIH kosong.' };
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h || '').trim());
    const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    const idColIdx = headers.findIndex(h => norm(h) === 'idtransaksi');
    if (idColIdx === -1) return { success: false, message: 'Kolom IDTransaksi tidak ditemukan.' };

    let targetRowIndex = -1;
    for (let r = 1; r < data.length; r++) {
      if (String(data[r][idColIdx] || '').trim() === String(idTransaksi).trim()) {
        targetRowIndex = r + 1;
        break;
      }
    }

    if (targetRowIndex === -1) {
      return { success: false, message: 'Record dengan ID Transaksi ' + idTransaksi + ' tidak ditemukan.' };
    }

    sheet.deleteRow(targetRowIndex);
    SpreadsheetApp.flush();
    return { success: true, message: 'Record Update BIPIH berhasil dihapus.' };
  } catch (e) {
    Logger.log('Error deleteUpdateStatusBipihRecord: ' + e.message);
    return { success: false, message: e.message };
  }
}

/**
 * Membaca data NoBPIH dan Nama secara spesifik dari Sheet DataJamaahHaji (atau variasinya)
 */
function getJamaahListFromDataJamaahHajiSheet_(db) {
  try {
    if (!db) return [];
    
    const candidateNames = [
      'Sheet DataJamaahHaji',
      'Sheet Data Jamaah Haji',
      'SheetDataJamaahHaji',
      'DataJamaahHaji',
      'Data Jamaah Haji',
      'DATA JAMAAH HAJI',
      'DATAJAMAAHHAJI',
      'ViewHajjData',
      'JamaahHaji',
      'Jamaah Haji',
      'Pendaftaran Haji',
      'Data Jamaah',
      'Jamaah'
    ];

    const normKey = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const sheets = db.getSheets();
    let targetSheet = null;

    // 1. Cari sheet persis dari kandidat
    for (let i = 0; i < candidateNames.length; i++) {
      const targetNorm = normKey(candidateNames[i]);
      for (let j = 0; j < sheets.length; j++) {
        if (normKey(sheets[j].getName()) === targetNorm) {
          targetSheet = sheets[j];
          break;
        }
      }
      if (targetSheet) break;
    }

    // 2. Scan sheet yang mengandung kata 'jamaah', 'haji', atau 'bpih'
    if (!targetSheet) {
      for (let i = 0; i < sheets.length; i++) {
        const n = sheets[i].getName().toLowerCase();
        if (n.includes('jamaah') || n.includes('haji') || n.includes('bpih')) {
          targetSheet = sheets[i];
          break;
        }
      }
    }

    // 3. Deep Fallback: Scan baris header di setiap sheet untuk menemukan kolom 'nama' dan 'bpih'/'porsi'
    if (!targetSheet) {
      for (let i = 0; i < sheets.length; i++) {
        const s = sheets[i];
        if (s.getLastRow() > 0 && s.getLastColumn() > 0) {
          const sampleRows = s.getRange(1, 1, Math.min(s.getLastRow(), 5), Math.min(s.getLastColumn(), s.getMaxColumns())).getDisplayValues();
          const hasNamaAndBpih = sampleRows.some(r => {
            const str = r.join(' ').toLowerCase();
            return str.includes('nama') && (str.includes('bpih') || str.includes('porsi') || str.includes('spph'));
          });
          if (hasNamaAndBpih) {
            targetSheet = s;
            break;
          }
        }
      }
    }

    if (!targetSheet) return [];

    const maxGridRows = targetSheet.getMaxRows();
    const maxGridCols = targetSheet.getMaxColumns();
    if (maxGridRows <= 0 || maxGridCols <= 0) return [];

    const maxScanRows = Math.min(Math.max(targetSheet.getLastRow(), 500), maxGridRows);
    const maxScanCols = Math.min(Math.max(targetSheet.getLastColumn(), 60), maxGridCols);
    const rawDisplayRange = targetSheet.getRange(1, 1, maxScanRows, maxScanCols).getDisplayValues();

    if (!rawDisplayRange || rawDisplayRange.length <= 1) return [];

    // Deteksi baris header (jika baris 1 adalah judul laporan/kosong)
    let headerRowIdx = 0;
    for (let r = 0; r < Math.min(5, rawDisplayRange.length); r++) {
      const lineStr = rawDisplayRange[r].join(' ').toLowerCase();
      if (lineStr.includes('nama') || lineStr.includes('bpih') || lineStr.includes('porsi')) {
        headerRowIdx = r;
        break;
      }
    }

    const rawHeaders = rawDisplayRange[headerRowIdx].map(h => String(h || '').trim());
    const rows = rawDisplayRange.slice(headerRowIdx + 1);

    const validRows = rows.filter(row => {
      const rowStr = row.join(' ').trim();
      if (!rowStr) return false;
      if (rowStr.includes('#REF!') || rowStr.includes('#N/A') || rowStr.includes('#VALUE!') || rowStr.includes('#ERROR!')) return false;
      return row.some(cell => cell !== undefined && cell !== null && String(cell).trim() !== '');
    });

    return validRows.map((row, idx) => {
      const normRowObj = {};
      rawHeaders.forEach((h, colIdx) => {
        const k = normKey(h);
        if (k && (normRowObj[k] === undefined || normRowObj[k] === '')) {
          normRowObj[k] = row[colIdx];
        }
      });

      const getVal = (possibleKeys, defaultVal = '') => {
        for (let i = 0; i < possibleKeys.length; i++) {
          const pk = normKey(possibleKeys[i]);
          if (normRowObj[pk] !== undefined && normRowObj[pk] !== null && String(normRowObj[pk]).trim() !== '') {
            return String(normRowObj[pk]).trim();
          }
        }
        return defaultVal;
      };

      let namaVal = getVal(['nama', 'namajamaah', 'namanasabah', 'namalengkap', 'jamaah', 'nama_jamaah', 'namajamaahhaji']);
      let bpihVal = getVal(['nobpih', 'no_bpih', 'bpih', 'nobpihhaji', 'noporsi', 'porsi', 'nospph', 'spph', 'idjamaah', 'id_jamaah']);
      let hpVal = getVal(['nohp', 'no_hp', 'hp', 'telepon', 'phone', 'wa'], '-');
      let jenisVal = getVal(['jenishaji', 'jenis_haji', 'jenis', 'paket', 'kategori'], 'Setoran Awal');

      // Fallback nama jika header tidak cocok: cari teks non-angka pertama
      if (!namaVal) {
        const nonNullCell = row.find(c => c !== undefined && c !== null && String(c).trim() !== '' && isNaN(String(c).trim()) && !String(c).startsWith('#'));
        namaVal = nonNullCell ? String(nonNullCell).trim() : ('Jamaah ' + (idx + 1));
      }

      if (!bpihVal) bpihVal = '-';

      return {
        _rowIndex: idx + headerRowIdx + 2,
        nama: namaVal,
        noBpih: bpihVal,
        noHp: hpVal,
        jenisHaji: jenisVal
      };
    }).filter(item => item.nama && item.nama.trim() !== '' && item.nama !== '-');

  } catch (e) {
    Logger.log('Error getJamaahListFromDataJamaahHajiSheet_: ' + e.message);
    return [];
  }
}
