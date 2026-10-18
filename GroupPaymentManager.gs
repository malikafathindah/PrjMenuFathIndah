/**
 * ============================================================================
 * GROUP PAYMENT MANAGER (GroupPaymentManager.gs)
 * ============================================================================
 * Backend Manager untuk modul Pembayaran Terpadu (Kolektif Agen & Individual)
 */

function setupGroupPaymentModule() {
  try {
    const db = getDb();
    if (!db) return;
    
    // Ensure DataPembayaranGroup sheet exists (menyimpan transaksi pembayaran kolektif agen)
    let sheetPay = db.getSheetByName('DataPembayaranGroup');
    if (!sheetPay) {
      sheetPay = db.insertSheet('DataPembayaranGroup');
      const headersPay = [
        'ID Group Payment', 'Waktu Transaksi', 'Tanggal Bayar', 'Nama Agen', 'Jenis Paket Umrah', 
        'Total Nominal', 'Metode Pembayaran', 'Bank Asal', 'Bank Tujuan', 'No Referensi', 'Bukti Bayar', 
        'List ID Jamaah', 'Rincian Alokasi (JSON)', 'Diskon Kolektif', 'Catatan', 'User Input', 'Status'
      ];
      sheetPay.appendRow(headersPay);
      sheetPay.getRange(1, 1, 1, headersPay.length).setFontWeight('bold').setBackground('#1e293b').setFontColor('white');
      sheetPay.setFrozenRows(1);
    }
    
    // Pastikan sheet History Pembayaran untuk individual juga siap
    if (typeof setupPaymentSheet === 'function') {
      setupPaymentSheet();
    }
  } catch (e) {
    Logger.log('Error setupGroupPaymentModule: ' + e.message);
  }
}

/**
 * Mengambil daftar unik Agen beserta Paket Umrah dan anggota jamaahnya
 * Sumber: Sheet 'Data Jamaah' (Header: 'NamaAgen', 'Jenis Paket Umrah', 'Nama Lengkap')
 */
function getAgenListWithPaket() {
  try {
    setupGroupPaymentModule();
    const rows = typeof getSheetData === 'function' ? getSheetData('Data Jamaah') : [];
    if (!rows || rows.length === 0) return [];
    
    const agenMap = {};
    
    rows.forEach((r, idx) => {
      const getVal = (keys) => {
        for (let k of keys) {
          if (r[k] !== undefined && r[k] !== null && String(r[k]).trim() !== '') return String(r[k]).trim();
        }
        return '';
      };
      
      const namaAgen = getVal(['NamaAgen', 'Nama Agen', 'Agent']);
      if (!namaAgen) return; // Lewati jika tidak memiliki agen
      
      const paket = getVal(['Jenis Paket Umrah', 'Jenis Paket', 'Paket Umrah', 'Paket']) || 'Paket Reguler';
      const idJamaah = getVal(['ID Jamaah', 'ID', 'No Registrasi']) || ('JM-' + (idx + 1));
      const namaLengkap = getVal(['Nama Lengkap', 'Nama', 'Nama Jemaah', 'Nama Jamaah']) || 'Jamaah Tanpa Nama';
      const noKtp = getVal(['Nomor KTP', 'No KTP', 'NIK']);
      const noHp = getVal(['Nomor Seluler', 'No Seluler', 'No HP']);
      const totalHarga = Number(getVal(['Jumlah Harus Dibayar', 'TotalHarga', 'Total Harga', 'Harga Paket'])) || 0;
      
      if (!agenMap[namaAgen]) {
        agenMap[namaAgen] = {
          namaAgen: namaAgen,
          paketMap: {}
        };
      }
      
      if (!agenMap[namaAgen].paketMap[paket]) {
        agenMap[namaAgen].paketMap[paket] = [];
      }
      
      agenMap[namaAgen].paketMap[paket].push({
        idJamaah: idJamaah,
        namaJamaah: namaLengkap,
        noKtp: noKtp,
        noHp: noHp,
        jenisPaket: paket,
        totalHarga: totalHarga
      });
    });
    
    const result = Object.keys(agenMap).sort().map(namaAgen => {
      const pakets = Object.keys(agenMap[namaAgen].paketMap).sort().map(pkt => ({
        namaPaket: pkt,
        jamaahList: agenMap[namaAgen].paketMap[pkt]
      }));
      return {
        namaAgen: namaAgen,
        pakets: pakets
      };
    });
    
    return result;
  } catch (e) {
    Logger.log('Error getAgenListWithPaket: ' + e.message);
    return [];
  }
}

/**
 * Menyimpan Transaksi Pembayaran Kolektif (berdasarkan Nama Agen & Paket)
 * Mendistribusikan nominal ke masing-masing anggota jamaah yang dipilih (checked)
 */
function saveKolektifPayment(formData, currentUser = 'Admin') {
  try {
    const db = getDb();
    if (!db) return { success: false, message: 'Database tidak ditemukan.' };
    setupGroupPaymentModule();
    const sheet = db.getSheetByName('DataPembayaranGroup');
    
    const today = new Date();
    const dateStr = Utilities.formatDate(today, "Asia/Jakarta", "yyMMdd");
    const lastRow = sheet.getLastRow();
    let counter = 1;
    if (lastRow > 1) {
      const lastId = sheet.getRange(lastRow, 1).getValue();
      if (lastId && lastId.toString().includes('GRP-PAY-' + dateStr)) {
        const parts = lastId.toString().split('-');
        if (parts.length === 4) counter = parseInt(parts[3], 10) + 1;
      }
    }
    const newId = `GRP-PAY-${dateStr}-${String(counter).padStart(4, '0')}`;
    const nowStr = Utilities.formatDate(today, "Asia/Jakarta", "yyyy-MM-dd HH:mm:ss");
    const tglBayar = formData.tanggal || Utilities.formatDate(today, "Asia/Jakarta", "yyyy-MM-dd");

    // Tangani Bukti Transfer Kolektif
    let uploadedUrl = formData.buktiBayarUrl || '';
    const fileBase64 = formData.fileBase64 || '';
    const fileName = formData.fileName || '';
    if (fileBase64 && fileName) {
      try {
        let fileExt = fileName.includes('.') ? fileName.substring(fileName.lastIndexOf('.')) : '';
        const formattedFileName = newId + ' - ' + (formData.namaAgen || 'Kolektif') + fileExt;
        const folderIdTarget = '1lHO7hPfyj6-512vovUNfvVcLbLQhTWIv';
        let folder = null;
        try { folder = DriveApp.getFolderById(folderIdTarget); } catch (e) {
          if (typeof getTargetJamaahUploadFolder_ === 'function') folder = getTargetJamaahUploadFolder_('Bukti Transfer');
        }
        if (folder) {
          const cleanBase64 = fileBase64.includes(',') ? fileBase64.split(',')[1] : fileBase64;
          const bytes = Utilities.base64Decode(cleanBase64);
          const driveFile = folder.createFile(Utilities.newBlob(bytes, formData.fileMimeType || 'application/octet-stream', formattedFileName));
          try { driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
          uploadedUrl = driveFile.getUrl();
        }
      } catch (errUpload) {
        Logger.log('Gagal upload bukti transfer kolektif: ' + errUpload.message);
      }
    }

    const jamaahList = (formData.jamaahList || []).filter(j => j.selected !== false);
    if (jamaahList.length === 0) {
      return { success: false, message: 'Tidak ada jamaah yang dipilih untuk pembayaran kolektif!' };
    }

    const listIdStr = jamaahList.map(j => j.idJamaah).join(', ');
    const alokasiObj = {};
    jamaahList.forEach(j => { alokasiObj[j.idJamaah] = j.nominal; });

    const newRow = [
      newId, nowStr, tglBayar, formData.namaAgen || '', formData.jenisPaket || '',
      Number(formData.totalNominal) || 0, formData.metodePembayaran || 'Transfer Bank', formData.namaBankAsal || '',
      formData.namaBankTujuan || '', formData.noReferensi || '', uploadedUrl,
      listIdStr, JSON.stringify(alokasiObj), formData.diskonKolektif || 0,
      formData.catatan || '', currentUser, 'Verified'
    ];
    sheet.appendRow(newRow);

    // Pecah Transaksi Kolektif ke Rekam Jejak Individual (History Pembayaran)
    if (typeof saveJamaahPayment === 'function') {
      let failCount = 0;
      for (let i = 0; i < jamaahList.length; i++) {
        let j = jamaahList[i];
        let indivPaymentData = {
          idJamaah: j.idJamaah,
          namaJamaah: j.namaJamaah,
          noKtp: j.noKtp || '',
          jenisPaket: j.jenisPaket || formData.jenisPaket || '',
          jumlahPembayaran: Number(j.nominal) || 0,
          tipePembayaran: j.tipePembayaran || 'Angsuran Kolektif',
          metodePembayaran: formData.metodePembayaran || 'Transfer Bank',
          namaBank: formData.namaBankTujuan || '',
          noReferensi: formData.noReferensi || '',
          tglBayar: tglBayar,
          keterangan: `Pembayaran Kolektif via Agen: ${formData.namaAgen} | Paket: ${formData.jenisPaket || '-'} | Ref: ${newId} | Catatan: ${formData.catatan || '-'}`,
          uploadBuktiTransfer: uploadedUrl
        };
        let resIndiv = saveJamaahPayment(indivPaymentData, currentUser);
        if (resIndiv && !resIndiv.success) failCount++;
      }
      if (failCount > 0) {
        return { success: true, message: `Transaksi kolektif berhasil (ID: ${newId}), namun ${failCount} pencatatan individual mengalami kendala.` };
      }
    }

    return { 
      success: true, 
      message: `Pembayaran kolektif berhasil disimpan untuk ${jamaahList.length} jamaah (ID: ${newId}).`,
      idGroupPayment: newId 
    };
  } catch (e) {
    return { success: false, message: 'Error saveKolektifPayment: ' + e.message };
  }
}

// Wrapper APIs untuk kompatibilitas frontend & backend
function apiGetAgenListWithPaket() { 
  return getAgenListWithPaket(); 
}

function apiSaveKolektifPayment(token, data) { 
  return saveKolektifPayment(data); 
}

// Kompatibilitas fungsi legacy
function apiGetListKoordinator() { 
  return getAgenListWithPaket(); 
}

function apiSaveGroupPayment(token, data) { 
  return saveKolektifPayment(data); 
}
