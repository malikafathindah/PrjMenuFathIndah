/**
 * EstimasiKeberangkatanManager.gs
 * Backend logic untuk Modul Estimasi Keberangkatan Haji
 */

function getEstimasiKeberangkatanList() {
  const db = getDb();
  const sheet = db.getSheetByName('DataJamaahHaji');
  if (!sheet) return [];
  
  const data = sheet.getDataRange().getDisplayValues();
  if (data.length < 2) return [];
  
  const headers = data[0].map(h => String(h).trim().toLowerCase().replace(/[^a-z0-9]/g, ''));
  const noPorsiIdx = headers.findIndex(h => h === 'nobpih' || h === 'noporsi');
  const namaIdx = headers.findIndex(h => h === 'nama' || h === 'namalengkap');
  const kanwilIdx = headers.findIndex(h => h === 'kanwil');
  const estimasiIdx = headers.findIndex(h => h === 'estimasiberangkat');
  
  const list = [];
  for (let r = 1; r < data.length; r++) {
    // Hanya ambil yang punya nama atau porsi
    const nama = namaIdx > -1 ? data[r][namaIdx] : '';
    const noporsi = noPorsiIdx > -1 ? data[r][noPorsiIdx] : '';
    
    if (nama || noporsi) {
      list.push({
        id: r,
        NoPorsi: noporsi,
        Nama: nama,
        Kanwil: kanwilIdx > -1 ? data[r][kanwilIdx] : '',
        EstimasiBerangkat: estimasiIdx > -1 ? data[r][estimasiIdx] : ''
      });
    }
  }
  return list;
}

function saveEstimasiBerangkat(rowIndex, estimasiValue, user) {
  try {
    const db = getDb();
    const sheet = db.getSheetByName('DataJamaahHaji');
    if (!sheet) return { success: false, message: 'Sheet DataJamaahHaji tidak ditemukan' };
    
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim().toLowerCase().replace(/[^a-z0-9]/g, ''));
    let estimasiIdx = headers.findIndex(h => h === 'estimasiberangkat');
    let tglEstimasiIdx = headers.findIndex(h => h === 'tglestimasi');
    const noPorsiIdx = headers.findIndex(h => h === 'nobpih' || h === 'noporsi');
    const namaIdx = headers.findIndex(h => h === 'nama' || h === 'namalengkap');
    
    // Trim estimasi value baru
    const valBaru = String(estimasiValue || '').trim();

    if (estimasiIdx === -1) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue('EstimasiBerangkat');
      estimasiIdx = sheet.getLastColumn() - 1;
    }
    if (tglEstimasiIdx === -1) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue('TglEstimasi');
      tglEstimasiIdx = sheet.getLastColumn() - 1;
    }
    
    const targetRow = rowIndex + 1;
    const rowValues = sheet.getRange(targetRow, 1, 1, sheet.getLastColumn()).getValues()[0];
    const valLama = String(rowValues[estimasiIdx] || '').trim();
    const noPorsi = noPorsiIdx > -1 ? String(rowValues[noPorsiIdx] || '').trim() : '';
    const nama = namaIdx > -1 ? String(rowValues[namaIdx] || '').trim() : '';
    const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    const nowFull = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');

    // Cek apakah estimasi sebelumnya sudah terisi DAN nilainya berbeda dengan nilai baru
    if (valLama !== '' && valLama !== valBaru) {
      catatHistoryEstimasi(db, {
        TglEstimasi: today,
        Timestamp: nowFull,
        NoPorsi: noPorsi,
        Nama: nama,
        EstimasiLama: valLama,
        EstimasiKeberangkatan: valBaru,
        User: user || 'Admin'
      });
    }
    
    // Simpan nilai baru ke DataJamaahHaji
    sheet.getRange(targetRow, estimasiIdx + 1).setValue(valBaru);
    sheet.getRange(targetRow, tglEstimasiIdx + 1).setValue(today);
    
    return {
      success: true, 
      message: 'Estimasi berhasil disimpan' + (valLama !== '' && valLama !== valBaru ? ' & riwayat history dicatat' : '')
    };
  } catch (error) {
    return {success: false, message: 'Gagal menyimpan: ' + error.message};
  }
}

/**
 * Mencatat riwayat perubahan estimasi ke Sheet HistoryEstimasi
 * Header minimal terdiri dari EstimasiKeberangkatan dan TglEstimasi
 */
function catatHistoryEstimasi(db, record) {
  try {
    let histSheet = db.getSheetByName('HistoryEstimasi');
    const defaultHeaders = [
      'TglEstimasi',
      'NoPorsi',
      'Nama',
      'EstimasiLama',
      'EstimasiKeberangkatan',
      'WaktuUpdate',
      'Petugas'
    ];

    if (!histSheet) {
      histSheet = db.insertSheet('HistoryEstimasi');
      histSheet.getRange(1, 1, 1, defaultHeaders.length)
               .setValues([defaultHeaders])
               .setFontWeight('bold')
               .setBackground('#1e293b')
               .setFontColor('#f8fafc');
      histSheet.setFrozenRows(1);
    } else if (histSheet.getLastRow() === 0) {
      histSheet.getRange(1, 1, 1, defaultHeaders.length)
               .setValues([defaultHeaders])
               .setFontWeight('bold')
               .setBackground('#1e293b')
               .setFontColor('#f8fafc');
      histSheet.setFrozenRows(1);
    }

    const rowData = [
      record.TglEstimasi || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
      record.NoPorsi || '',
      record.Nama || '',
      record.EstimasiLama || '',
      record.EstimasiKeberangkatan || '',
      record.Timestamp || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'),
      record.User || 'Admin'
    ];

    histSheet.appendRow(rowData);
  } catch (err) {
    Logger.log('Gagal mencatat history estimasi: ' + err.message);
  }
}

/**
 * Mengambil daftar riwayat perubahan estimasi untuk ditampilkan di UI
 */
function getHistoryEstimasiKeberangkatanList(noPorsiFilter) {
  try {
    const db = getDb();
    const sheet = db.getSheetByName('HistoryEstimasi');
    if (!sheet || sheet.getLastRow() < 2) return [];

    const data = sheet.getDataRange().getDisplayValues();
    const headers = data[0].map(h => String(h).trim().toLowerCase().replace(/[^a-z0-9]/g, ''));
    
    const tglIdx = headers.findIndex(h => h === 'tglestimasi');
    const porsiIdx = headers.findIndex(h => h === 'noporsi' || h === 'nobpih');
    const namaIdx = headers.findIndex(h => h === 'nama' || h === 'namalengkap');
    const lamaIdx = headers.findIndex(h => h === 'estimasilama' || h === 'estimasisebelumnya');
    const baruIdx = headers.findIndex(h => h === 'estimasikeberangkatan' || h === 'estimasiberangkat');
    const waktuIdx = headers.findIndex(h => h === 'waktuupdate' || h === 'timestamp');
    const petugasIdx = headers.findIndex(h => h === 'petugas' || h === 'user');

    const history = [];
    for (let i = data.length - 1; i >= 1; i--) {
      const row = data[i];
      const porsi = porsiIdx > -1 ? row[porsiIdx] : '';
      if (noPorsiFilter && String(porsi).trim() !== String(noPorsiFilter).trim()) {
        continue;
      }
      history.push({
        TglEstimasi: tglIdx > -1 ? row[tglIdx] : '',
        NoPorsi: porsi,
        Nama: namaIdx > -1 ? row[namaIdx] : '',
        EstimasiLama: lamaIdx > -1 ? row[lamaIdx] : '',
        EstimasiKeberangkatan: baruIdx > -1 ? row[baruIdx] : '',
        WaktuUpdate: waktuIdx > -1 ? row[waktuIdx] : '',
        Petugas: petugasIdx > -1 ? row[petugasIdx] : ''
      });
    }
    return history;
  } catch (err) {
    Logger.log('Error getHistoryEstimasiKeberangkatanList: ' + err.message);
    return [];
  }
}
