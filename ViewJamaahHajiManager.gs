/**
 * ============================================================================
 * VIEW JAMAAH HAJI MANAGER (ViewJamaahHajiManager.gs)
 * ============================================================================
 * Backend manager simpel khusus untuk modul mod_view_jamaah_haji.
 * Membaca data Jamaah Haji dari sheet mana pun yang memiliki data di Spreadsheet.
 */

function findAnyJamaahSheetWithData_(db) {
  if (!db) return null;

  const sheets = db.getSheets();
  const candidateNames = [
    'DataJamaahHaji',
    'Data Jamaah Haji',
    'Data_Jamaah_Haji',
    'DATA JAMAAH HAJI',
    'DATAJAMAAHHAJI',
    'ViewHajjData',
    'Jamaah Haji',
    'JamaahHaji',
    'Pendaftaran Haji',
    'Data Haji',
    'EntryAngsuranHaji'
  ];

  const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  // 1. Cek sheet kandidat (ViewHajjData prioritaskan langsung walau IMPORTRANGE membuat getLastRow kecil)
  for (let i = 0; i < candidateNames.length; i++) {
    const targetNorm = norm(candidateNames[i]);
    for (let j = 0; j < sheets.length; j++) {
      if (norm(sheets[j].getName()) === targetNorm) {
        return sheets[j];
      }
    }
  }

  // 2. Scan semua sheet yang mengandung kata 'haji'
  for (let i = 0; i < sheets.length; i++) {
    const s = sheets[i];
    const nameLower = s.getName().toLowerCase();
    if (nameLower.includes('haji')) {
      return s;
    }
  }

  // Fallback ke DataJamaahHaji
  return db.getSheetByName('DataJamaahHaji') || db.getSheetByName('ViewHajjData') || sheets[0];
}

function getViewJamaahHajiData() {
  try {
    const db = getDb();
    if (!db) {
      return { success: false, message: 'Database Spreadsheet tidak dapat diakses', data: [] };
    }

    try { SpreadsheetApp.flush(); } catch(e) {}

    // Cari sheet manapun di Spreadsheet yang memiliki baris data Jamaah Haji
    const sheet = findAnyJamaahSheetWithData_(db);
    if (!sheet) {
      return { success: true, data: [], headers: ['Nama', 'NoBPIH', 'NoHP'], sheetName: 'Tidak Ditemukan' };
    }

    // Menggunakan getDisplayValues() dan rentang hingga 300 baris x 60 kolom 
    // agar data dari rumus IMPORTRANGE (array spill) terbaca sempurna walaupun sheet.getLastRow() kecil
    const maxGridRows = sheet.getMaxRows();
    const maxGridCols = sheet.getMaxColumns();
    if (maxGridRows <= 0 || maxGridCols <= 0) {
      return { success: true, data: [], headers: ['Nama', 'NoBPIH', 'NoHP'], sheetName: sheet.getName() };
    }
    const maxScanRows = Math.min(Math.max(sheet.getLastRow(), 300), maxGridRows);
    const maxScanCols = Math.min(Math.max(sheet.getLastColumn(), 60), maxGridCols);
    
    // getDisplayValues() membaca teks nyata yang tampil di layar (hasil kalkulasi IMPORTRANGE)
    const rawDisplayRange = sheet.getRange(1, 1, maxScanRows, maxScanCols).getDisplayValues();
    const allSheets = db.getSheets().map(s => s.getName() + ' (' + s.getLastRow() + ' baris)');

    if (!rawDisplayRange || rawDisplayRange.length <= 1) {
      return {
        success: true,
        data: [],
        headers: ['Nama', 'NoBPIH', 'NoHP'],
        sheetName: sheet.getName(),
        spreadsheetName: db.getName(),
        summary: { total: 0, availableSheets: allSheets }
      };
    }

    const rawHeaders = rawDisplayRange[0].map(h => String(h || '').trim());
    const rows = rawDisplayRange.slice(1);

    // Cek apakah IMPORTRANGE memerlukan Izin Akses (#REF! / #N/A)
    const refErrorFound = rows.some(row => row.some(cell => String(cell).includes('#REF!') || String(cell).includes('#N/A')));

    // Filter baris kosong & baris error IMPORTRANGE
    const validRows = rows.filter(row => {
      const rowStr = row.join(' ').trim();
      if (!rowStr) return false;
      if (rowStr.includes('#REF!') || rowStr.includes('#N/A') || rowStr.includes('#VALUE!') || rowStr.includes('#ERROR!')) return false;
      return row.some(cell => cell !== undefined && cell !== null && String(cell).trim() !== '');
    });

    if (validRows.length === 0) {
      let extraMsg = '';
      if (refErrorFound) {
        extraMsg = ' Rumus IMPORTRANGE pada sheet ini memerlukan Izin Akses (Allow Access). Silakan buka Google Spreadsheet Anda dan klik tombol "Allow access" pada sel IMPORTRANGE.';
      }

      return {
        success: true,
        data: [],
        headers: ['Nama', 'NoBPIH', 'NoHP'],
        sheetName: sheet.getName(),
        spreadsheetName: db.getName(),
        message: 'Baris data belum ditemukan.' + extraMsg,
        summary: { total: 0, availableSheets: allSheets, isImportRangeRefError: refErrorFound }
      };
    }

    // Extract kolom Nama, NoBPIH, NoHP secara super-fleksibel
    const list = validRows.map((row, idx) => {
      const rowObj = {};
      rawHeaders.forEach((h, colIdx) => {
        const headerKey = h || ('Kolom_' + (colIdx + 1));
        if (rowObj[headerKey] === undefined || rowObj[headerKey] === null || String(rowObj[headerKey]).trim() === '') {
          rowObj[headerKey] = row[colIdx];
        }
      });

      const getVal = (possibleKeys) => {
        if (typeof getRowValue === 'function') {
          const res = getRowValue(rowObj, possibleKeys);
          if (res !== undefined && res !== null && String(res).trim() !== '') return res;
        }
        for (let i = 0; i < possibleKeys.length; i++) {
          const k = possibleKeys[i];
          if (rowObj[k] !== undefined && rowObj[k] !== null && String(rowObj[k]).trim() !== '') return rowObj[k];
        }
        return '';
      };

      let namaVal = String(getVal(['nama', 'namajamaah', 'namanasabah', 'namalengkap', 'jamaah', 'nama_jamaah', 'namajamaahhaji']) || '');
      let bpihVal = String(getVal(['nobpih', 'no_bpih', 'bpih', 'nobpihhaji', 'noporsi', 'porsi', 'nospph', 'spph', 'idjamaah', 'id_jamaah']) || '');
      let hpVal = String(getVal(['nohp', 'no_hp', 'hp', 'telepon', 'phone', 'wa', 'nohpwa', 'notelp', 'handphone', 'teleponwa']) || '');
      let jenisHajiVal = String(getVal(['jenishaji', 'jenis_haji', 'jenis', 'paket', 'kategori']) || 'Setoran Awal');
      let statusHajiVal = String(getVal(['statushaji', 'status_haji', 'status haji']) || '');
      let bulanVal = String(getVal(['bulanpendaftaran', 'bulan_pendaftaran', 'bulan', 'tglinput', 'timestamp', 'createdat']) || 'Umum');
      let bankVal = String(getVal(['banksetorawal', 'bank_setor_awal', 'bank', 'banksetor', 'banksetorawal']) || 'BSI');
      let mahramVal = String(getVal(['mahram', 'pendamping', 'hubmahram']) || '-');
      let rawStatusBpih = String(getVal(['statusbpih', 'status_bpih', 'statusbpihcode', 'status']) || '').trim();

      let statusBpihLabel = 'Setoran Awal (C)';
      const stUpper = rawStatusBpih.toUpperCase();
      if (stUpper === 'C' || stUpper.includes('SETORAN') || stUpper.includes('AWAL')) {
        statusBpihLabel = 'Setoran Awal (C)';
      } else if (stUpper === 'F' || stUpper.includes('LUNAS') || stUpper.includes('BPIH LUNAS')) {
        statusBpihLabel = 'BPIH Lunas (F)';
      } else if (rawStatusBpih) {
        statusBpihLabel = 'Status ' + rawStatusBpih;
      }

      let rawTglInput = String(getVal(['tglinput', 'tanggalinput', 'tgl_input', 'tanggal_input']) || '').trim();
      let lamaAntrianLabel = '';
      if (rawTglInput) {
        let tglDate = null;
        if (/^\d{4}-\d{2}-\d{2}/.test(rawTglInput)) {
          tglDate = new Date(rawTglInput);
        } else if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}/.test(rawTglInput)) {
          let p = rawTglInput.split(/[\/\-]/);
          tglDate = new Date(p[2], parseInt(p[1])-1, p[0]);
        } else {
          let parsed = Date.parse(rawTglInput);
          if (!isNaN(parsed)) tglDate = new Date(parsed);
        }

        if (tglDate && !isNaN(tglDate.getTime())) {
          let now = new Date();
          let months = (now.getFullYear() - tglDate.getFullYear()) * 12 + (now.getMonth() - tglDate.getMonth());
          if (now.getDate() < tglDate.getDate()) months--;
          
          if (months >= 0) {
            let y = Math.floor(months / 12);
            let m = months % 12;
            if (y > 0 && m > 0) lamaAntrianLabel = y + ' Thn ' + m + ' Bln';
            else if (y > 0) lamaAntrianLabel = y + ' Thn';
            else if (m > 0) lamaAntrianLabel = m + ' Bln';
            else lamaAntrianLabel = '< 1 Bln';
          }
        }
      }

      // Fallback jika tidak menemukan nama via header key: ambil isi sel teks non-kosong pertama dari baris tersebut
      if (!namaVal) {
        const nonNullCell = row.find(c => c !== undefined && c !== null && String(c).trim() !== '' && isNaN(String(c).trim()) && !String(c).startsWith('#'));
        namaVal = nonNullCell ? String(nonNullCell).trim() : (row[0] ? String(row[0]).trim() : ('Jamaah ' + (idx + 1)));
      }
      if (!bpihVal) bpihVal = '-';
      if (!hpVal) hpVal = '-';

      return {
        _rowIndex: idx + 2,
        nama: namaVal,
        noBpih: bpihVal,
        noHp: hpVal,
        jenisHaji: jenisHajiVal,
        bulanPendaftaran: bulanVal,
        bankSetorAwal: bankVal,
        mahram: mahramVal,
        statusBpih: rawStatusBpih || 'C',
        statusBpihLabel: statusBpihLabel,
        lamaAntrian: lamaAntrianLabel,
        statusHaji: statusHajiVal,
        rawObj: rowObj
      };
    });

    return {
      success: true,
      data: list,
      headers: ['Nama', 'NoBPIH', 'NoHP'],
      sheetName: sheet.getName(),
      spreadsheetName: db.getName(),
      summary: { total: list.length, availableSheets: allSheets }
    };
  } catch (e) {
    Logger.log('Error getViewJamaahHajiData: ' + e.message);
    return { success: false, message: e.message, data: [] };
  }
}
