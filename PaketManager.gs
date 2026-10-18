/**
 * ============================================================================
 * PAKET MANAGER (PaketManager.gs)
 * ============================================================================
 * Mengelola penyimpanan, pemanggilan, dan pembaruan data paket Umrah & Haji
 * pada Google Sheets "DataPaket" atau "Paket".
 */

const PAKET_CONFIG = {
  SHEET_NAME: 'DataPaket',
  HEADERS: [
    'ID Paket',
    'Nama Paket',
    'Jenis Paket Umrah',
    'Musim / Year',
    'Tanggal Keberangkatan',
    'Durasi (Hari)',
    'Hotel Makkah',
    'Hotel Madinah',
    'Maskapai',
    'Harga Quad',
    'Harga Triple',
    'Harga Double',
    'Kuota Total',
    'Sisa Kuota',
    'Status Paket',
    'Catatan',
    'CreatedAt',
    'UserInput'
  ]
};

/**
 * Helper untuk parsing angka fleksibel (handling string Rp 32.500.000, "9 Hari", etc.)
 */
function parsePaketNumber(val, defaultVal = 0) {
  if (val === undefined || val === null || val === '') return defaultVal;
  if (typeof val === 'number') return isNaN(val) ? defaultVal : val;
  let str = String(val).trim();
  if (!str) return defaultVal;

  // Clean currency and text suffix/prefix except digits, dots, commas, minus
  str = str.replace(/[^0-9.,-]/g, '');
  if (!str) return defaultVal;

  if (str.includes('.') && str.includes(',')) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (str.includes('.') && !str.includes(',')) {
    const parts = str.split('.');
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
      str = str.replace(/\./g, '');
    }
  } else if (str.includes(',')) {
    str = str.replace(',', '.');
  }
  const parsed = parseFloat(str);
  return isNaN(parsed) ? defaultVal : parsed;
}

/**
 * Helper fleksibel untuk mengambil properti dari objek baris data (bebas beda kapitalisasi/spasi header)
 */
function getPaketPropVal(obj, keys, defaultVal = '') {
  if (!obj || typeof obj !== 'object') return defaultVal;
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== '') {
      return obj[k];
    }
  }
  const objKeys = Object.keys(obj);
  for (let i = 0; i < keys.length; i++) {
    const target = keys[i].toLowerCase().replace(/[^a-z0-9]/g, '');
    for (let j = 0; j < objKeys.length; j++) {
      if (objKeys[j].toLowerCase().replace(/[^a-z0-9]/g, '') === target) {
        const val = obj[objKeys[j]];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          return val;
        }
      }
    }
  }
  return defaultVal;
}

/**
 * Menyiapkan sheet "DataPaket" jika belum ada
 */
function setupPaketSheet() {
  try {
    const ss = getDb();
    if (!ss) throw new Error('Database Spreadsheet tidak dapat dibuka!');

    let sheet = ss.getSheetByName('DataPaket') || 
                findSheetByNameFlexible('DataPaket');
    if (!sheet) {
      sheet = ss.insertSheet('DataPaket');
    }

    const currentMaxCols = sheet.getMaxColumns();
    if (currentMaxCols < PAKET_CONFIG.HEADERS.length) {
      const needed = PAKET_CONFIG.HEADERS.length - currentMaxCols;
      if (currentMaxCols > 0) {
        sheet.insertColumnsAfter(currentMaxCols, needed);
      } else {
        sheet.insertColumns(1, needed);
      }
    }

    const lastRow = sheet.getLastRow();
    if (lastRow === 0) {
      sheet.appendRow(PAKET_CONFIG.HEADERS);
    } else {
      const checkWidth = Math.min(sheet.getMaxColumns(), PAKET_CONFIG.HEADERS.length);
      if (checkWidth > 0) {
        const currentHeaders = sheet.getRange(1, 1, 1, checkWidth).getValues()[0];
        if (!currentHeaders || !currentHeaders[0] || String(currentHeaders[0]).trim() === '') {
          sheet.getRange(1, 1, 1, PAKET_CONFIG.HEADERS.length).setValues([PAKET_CONFIG.HEADERS]);
        }
      }
    }
    return sheet;
  } catch (e) {
    Logger.log('Error setupPaketSheet: ' + e.message);
    try {
      const ss = getDb();
      if (ss) {
        return ss.getSheetByName('DataPaket') || findSheetByNameFlexible('DataPaket') || ss.getSheets()[0];
      }
    } catch (err) {}
    throw e;
  }
}

/**
 * Helper untuk mengecek apakah suatu nilai bernilai error spreadsheet (#REF!, #N/A, dll.)
 */
function isPaketErrorVal(val) {
  if (val === undefined || val === null) return true;
  if (val instanceof Date) return false;
  if (typeof val === 'number') return isNaN(val);
  const str = String(val).trim();
  if (!str) return false;
  const upperStr = str.toUpperCase();
  
  const errorTokens = [
    '#REF!', '#N/A', '#VALUE!', '#ERROR!', '#DIV/0!', 
    '#NAME?', '#NUM!', '#NULL!', '#BUSY!', '#GETTING_DATA',
    'NAN', 'UNDEFINED', 'NULL', '[OBJECT OBJECT]'
  ];

  return errorTokens.some(err => upperStr === err || upperStr.includes(err));
}

/**
 * Helper untuk membersihkan nilai error spreadsheet seperti #REF!, #N/A, #VALUE!, #ERROR!, #DIV/0!
 */
function cleanPaketErrorVal(val, defaultVal = '') {
  if (val === undefined || val === null) return defaultVal;
  if (val instanceof Date) return val;
  if (typeof val === 'number' && isNaN(val)) return defaultVal;
  if (isPaketErrorVal(val)) return defaultVal;
  const str = String(val).trim();
  return str;
}

/**
 * Helper untuk format tanggal ke Bahasa Indonesia (dd mmmm yyyy), contoh: "15 Oktober 2026"
 */
function formatPaketDateIndo(val) {
  if (val === undefined || val === null) return '-';
  
  const indMonthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  if (val instanceof Date) {
    const day = val.getDate();
    const monthIdx = val.getMonth();
    const year = val.getFullYear();
    if (year > 1990 && year < 2100) {
      return day + ' ' + indMonthNames[monthIdx] + ' ' + year;
    }
  }

  let str = cleanPaketErrorVal(val, '-');
  if (!str || str === '-' || str === '0') return '-';

  // Jika sudah mengandung nama bulan Indonesia, langsung kembalikan
  const alreadyFormatted = indMonthNames.some(m => String(str).toLowerCase().includes(m.toLowerCase()));
  if (alreadyFormatted) return String(str).trim();

  // Format ISO YYYY-MM-DD atau YYYY/MM/DD
  const isoMatch = String(str).match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    const year = isoMatch[1];
    const monthIdx = parseInt(isoMatch[2], 10) - 1;
    const day = parseInt(isoMatch[3], 10);

    if (monthIdx >= 0 && monthIdx < 12) {
      return day + ' ' + indMonthNames[monthIdx] + ' ' + year;
    }
  }

  // Format DD/MM/YYYY atau DD-MM-YYYY
  const dmyMatch = String(str).match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const monthIdx = parseInt(dmyMatch[2], 10) - 1;
    const year = dmyMatch[3];

    if (monthIdx >= 0 && monthIdx < 12) {
      return day + ' ' + indMonthNames[monthIdx] + ' ' + year;
    }
  }

  // Fallback ke JavaScript Date object
  const parsedDate = new Date(str);
  if (!isNaN(parsedDate.getTime()) && String(str).length > 5 && !/^\d+$/.test(String(str))) {
    const day = parsedDate.getDate();
    const monthIdx = parsedDate.getMonth();
    const year = parsedDate.getFullYear();
    if (year > 1990 && year < 2100) {
      return day + ' ' + indMonthNames[monthIdx] + ' ' + year;
    }
  }

  return String(str).trim();
}

/**
 * Helper untuk mendeteksi apakah suatu baris adalah baris informasi hotel/catatan/separator
 * (Bukan merupakan baris paket/program keberangkatan utama atau varian paket)
 */
function isPaketInfoRow(typePaket, program, keterangan) {
  const combined = (String(typePaket || '') + ' ' + String(program || '') + ' ' + String(keterangan || '')).toLowerCase().trim();
  if (!combined) return false;

  const infoKeywords = [
    'med :', 'med:', 'mak :', 'mak:', 'hotel :', 'hotel:', 'info :', 'info:', 
    'catatan :', 'catatan:', 'note :', 'note:', 'movenpick', 'strf', 'star',
    'bintang', 'include', 'exclude', 'syarat', 'ket :', 'ket:'
  ];

  const hasInfoKeyword = infoKeywords.some(kw => combined.includes(kw));
  if (hasInfoKeyword) return true;

  // Cek jika mengandung pola *** atau ***** (bintang hotel)
  if (/\*{3,}/.test(combined)) return true;

  return false;
}

/**
 * Mengambil data dari Sheet "DashProg" (Dashboard Program Paket & Penjualan) secara 100% Dinamis (Baris & Kolom)
 * Target Spreadsheet ID: 1kItrJaXUdzvq6WlM6xoslUk7LWTWQGokmBQLBxAIqCg (GID: 1483869261)
 * Syarat:
 * 1. Cari header yang sesuai secara dinamis (Row 1-15)
 * 2. Baris yang di-hide (hidden by user/filter) tidak ditampilkan
 * 3. Merge baris yang kosong diisi data dari atasnya (carry-over continuous)
 * 4. Penambahan baris dan kolom dinamis tetap didukung
 * 5. Script lain tetap dipertahankan
 */
function getDashProgDataList() {
  try {
    const targetSpreadsheetId = '1kItrJaXUdzvq6WlM6xoslUk7LWTWQGokmBQLBxAIqCg';
    const targetGid = 1483869261;

    let ss = null;
    try {
      ss = SpreadsheetApp.openById(targetSpreadsheetId);
    } catch (openErr) {
      Logger.log('Warning openById targetSpreadsheetId: ' + openErr.message);
      ss = typeof getDb === 'function' ? getDb() : SpreadsheetApp.getActiveSpreadsheet();
    }

    if (!ss) return { success: false, headers: [], data: [], message: 'Spreadsheet tidak ditemukan.' };

    // Cari sheet secara fleksibel (GID -> Nama Sheet -> Scanning Content)
    let sheet = null;
    const allSheets = ss.getSheets();
    if (Array.isArray(allSheets) && allSheets.length > 0) {
      // 1. Cari berdasarkan GID
      sheet = allSheets.find(s => String(s.getSheetId()) === String(targetGid));
      
      // 2. Cari berdasarkan Nama Sheet
      if (!sheet) {
        const targetNames = ['dashprog', 'dash prog', 'dashboard program', 'program', 'datapaket', 'paket'];
        sheet = allSheets.find(s => targetNames.includes(s.getName().toLowerCase().trim()));
      }

      // 3. Fallback pencarian nama fleksibel
      if (!sheet && typeof findSheetByNameFlexibleInSs === 'function') {
        sheet = findSheetByNameFlexibleInSs(ss, 'DashProg');
      }

      // 4. Fallback sheet pertama
      if (!sheet) sheet = allSheets[0];
    }

    if (!sheet) return { success: false, headers: [], data: [], message: 'Sheet DashProg tidak ditemukan.' };

    const lastRow = Math.max(sheet.getLastRow(), 1);
    const lastCol = Math.max(sheet.getLastColumn(), 1);
    const data = sheet.getRange(1, 1, lastRow, lastCol).getValues();
    if (!data || !Array.isArray(data) || data.length === 0) {
      return { success: true, headers: [], data: [] };
    }

    // 0. PRE-PROCESS MERGED CELLS (Gunakan getMergedRanges resmi Google Sheets API)
    const mergedData = data.map(row => (Array.isArray(row) ? row.slice() : []));
    const isRowMergedWithPrev = {};

    try {
      if (typeof sheet.getMergedRanges === 'function') {
        const mergedRanges = sheet.getMergedRanges();
        if (Array.isArray(mergedRanges)) {
          mergedRanges.forEach(rg => {
            const sRow = rg.getRow() - 1;      // 0-based index
            const eRow = rg.getLastRow() - 1;   // 0-based index
            const sCol = rg.getColumn() - 1;   // 0-based index
            const eCol = rg.getLastColumn() - 1; // 0-based index

            // Cell utama (top-left) di Google Sheets menyimpan nilai asli dari area yang di-merge
            const topLeftVal = (data[sRow] && data[sRow][sCol] !== undefined) ? data[sRow][sCol] : '';
            const cleanedTopLeft = (topLeftVal instanceof Date) ? topLeftVal : cleanPaketErrorVal(topLeftVal, '');

            // Salin nilai top-left ke cell turunan yang benar-benar TERCEK MERGE
            for (let r = sRow; r <= eRow; r++) {
              if (r > sRow) {
                isRowMergedWithPrev[r + 1] = true;
              }
              if (!mergedData[r]) continue;
              for (let c = sCol; c <= eCol; c++) {
                const curCellVal = mergedData[r][c];
                if (curCellVal === '' || curCellVal === null || curCellVal === undefined || isPaketErrorVal(curCellVal)) {
                  mergedData[r][c] = cleanedTopLeft;
                }
              }
            }
          });
        }
      }
    } catch (mErr) {
      Logger.log('Warning getMergedRanges failed in getDashProgDataList: ' + mErr.message);
    }

    // 1. CARI HEADER YANG SESUAI DINAMIS (Poin 1)
    const coreTargets = [
      'no', 'schedulekeberangkatan', 'schedule', 'keberangkatan', 'tglkeberangkatan',
      'actualflaight', 'actualflight', 'flight', 'penerbangan',
      'embarkasih', 'embarkasi', 'embark',
      'owner', 'pemilik', 'pj',
      'typepaket', 'jenispaket', 'type', 'tipepaket', 'jenis',
      'program', 'namaprogram', 'paket', 'namapaket', 'nama',
      'forecastsale', 'forecast', 'targetsale',
      'tikettersedia', 'tiket',
      'qtyjamaah', 'qtyjamaahtotal', 'totaljamaah',
      'pembimbing', 'muthawwif', 'tourleader', 'tl',
      'seattersedia', 'sisaseat',
      'keterangan', 'catatan', 'ket'
    ];

    let headerRowIndex = 0;
    let maxMatchCount = 0;

    // Scan 15 baris pertama untuk menemukan baris dengan pencocokan header terbanyak
    const scanLimit = Math.min(mergedData.length, 15);
    for (let r = 0; r < scanLimit; r++) {
      const row = mergedData[r];
      if (!Array.isArray(row)) continue;
      let matchCount = 0;
      row.forEach(cell => {
        const cellStr = String(cell || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        if (cellStr && coreTargets.includes(cellStr)) {
          matchCount++;
        }
      });
      if (matchCount > maxMatchCount) {
        maxMatchCount = matchCount;
        headerRowIndex = r;
      }
    }

    const headerRow = mergedData[headerRowIndex] || [];
    const dynamicHeaders = [];

    let flightColIdx = -1;
    let scheduleColIdx = -1;
    headerRow.forEach((h, colIdx) => {
      const hClean = String(h || '').trim();
      if (!hClean) return;
      const target = hClean.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (['actualflaight', 'actualflight', 'flight', 'penerbangan'].includes(target)) {
        flightColIdx = colIdx;
      }
      if (['schedulekeberangkatan', 'schedule', 'keberangkatan', 'tglkeberangkatan'].includes(target)) {
        scheduleColIdx = colIdx;
      }
      if (!coreTargets.includes(target)) {
        dynamicHeaders.push({
          headerName: hClean,
          colIndex: colIdx
        });
      }
    });

    // Integrated RequestSeat list
    const allReqList = [];
    try {
      const reqSheet = ss.getSheetByName('RequestSeat') || ss.getSheetByName('Request_Seat');
      if (reqSheet && reqSheet.getLastRow() > 1) {
        const reqData = reqSheet.getDataRange().getValues();
        for (let r = 1; r < reqData.length; r++) {
          const reqRow = reqData[r];
          if (!reqRow || reqRow.length === 0) continue;
          allReqList.push({
            idRequest: String(reqRow[0] || ''),
            userRequest: String(reqRow[2] || ''),
            typePaket: String(reqRow[3] || '').trim().toLowerCase(),
            kanwil: String(reqRow[4] || ''),
            jumlahSeat: Number(reqRow[5] || 0),
            idPaket: String(reqRow[11] || '').trim().toLowerCase()
          });
        }
      }
    } catch (reqErr) {
      Logger.log('Error reading RequestSeat list: ' + reqErr.message);
    }

    const list = [];
    let currentRombonganContext = null;

    // Loop data baris setelah headerRowIndex menggunakan matrix mergedData
    for (let i = headerRowIndex + 1; i < mergedData.length; i++) {
      const rowPosition = i + 1; // 1-based index di Google Sheets

      // 2. CEK BARIS YANG DI-HIDE (Poin 2)
      try {
        if (typeof sheet.isRowHiddenByUser === 'function' && sheet.isRowHiddenByUser(rowPosition)) {
          continue;
        }
        if (typeof sheet.isRowHiddenByFilter === 'function' && sheet.isRowHiddenByFilter(rowPosition)) {
          continue;
        }
      } catch (hideErr) {
        // Abaikan jika method tidak tersedia di versi runtime tertentu
      }

      const rowData = mergedData[i];
      if (!rowData || rowData.length === 0) continue;

      // Build key-value map for standard getter
      const rowObj = { _rowIndex: rowPosition };
      headerRow.forEach((h, colIdx) => {
        const cellVal = rowData[colIdx];
        if (h) rowObj[h] = cellVal;
      });

      let no = cleanPaketErrorVal(getPaketPropVal(rowObj, ['No', 'NO', 'no'], ''));
      let scheduleRaw = cleanPaketErrorVal(getPaketPropVal(rowObj, ['Schedule Keberangkatan', 'Schedule', 'Keberangkatan', 'Tgl Keberangkatan'], ''));
      let flightRaw = cleanPaketErrorVal(getPaketPropVal(rowObj, ['Actual Flaight', 'Actual Flight', 'Flight', 'Penerbangan'], ''));
      let embarkasiRaw = cleanPaketErrorVal(getPaketPropVal(rowObj, ['Embarkasih', 'Embarkasi', 'Embark'], ''));
      let ownerRaw = cleanPaketErrorVal(getPaketPropVal(rowObj, ['Owner', 'Pemilik', 'PJ'], ''));
      let typePaket = cleanPaketErrorVal(getPaketPropVal(rowObj, ['Type Paket', 'Jenis Paket', 'Type', 'Tipe Paket', 'Jenis'], ''));
      let program = cleanPaketErrorVal(getPaketPropVal(rowObj, ['Program', 'Nama Program', 'Paket', 'Nama Paket', 'Nama'], ''));
      let pembimbingRaw = cleanPaketErrorVal(getPaketPropVal(rowObj, ['Pembimbing', 'Muthawwif', 'Tour Leader', 'TL'], ''));
      let keterangan = cleanPaketErrorVal(getPaketPropVal(rowObj, ['Keterangan', 'Catatan', 'Ket'], ''));
      let statusPaketRaw = cleanPaketErrorVal(getPaketPropVal(rowObj, ['Status Paket', 'Status', 'Status Program', 'Status Data', 'Status_Paket', 'status'], 'Active'));

      const statusClean = String(statusPaketRaw || 'Active').trim().toLowerCase();
      const isInactiveStatus = [
        'inactive', 'non-aktif', 'non aktif', 'tidak aktif', 
        'closed', 'tutup', 'archived', 'arsip', 'disabled', 'false', '0'
      ].includes(statusClean);

      // Sesuai aturan global: lewati/sembunyikan paket yang berstatus Inactive/Non-Aktif
      if (isInactiveStatus) continue;

      const isInfo = isPaketInfoRow(typePaket, program, keterangan);

      // Cek apakah ada data pada sel manapun di baris ini (termasuk Keterangan)
      let hasAnyCellData = Boolean(no || scheduleRaw || flightRaw || embarkasiRaw || ownerRaw || typePaket || program || pembimbingRaw || keterangan);
      if (!hasAnyCellData) {
        dynamicHeaders.forEach(dh => {
          const val = cleanPaketErrorVal(rowData[dh.colIndex]);
          if (val && val !== '0' && val !== 0) {
            hasAnyCellData = true;
          }
        });
      }
      if (!hasAnyCellData) continue; // Abaikan baris kosong total

      // PEMETAAN KONTEKS MERGE CARRY-OVER VS BARIS INFO:
      if (isInfo) {
        // BARIS INFO (seperti "Med : Movenpick Madinah / ***** Strf"):
        // Dikosongkan (TIDAK PERNAH diisi dari rombongan atasnya)
        scheduleRaw = '';
        flightRaw = '';
        embarkasiRaw = '';
        ownerRaw = '';
        pembimbingRaw = '';
      } else {
        // BARIS PAKET / PROGRAM REGULER:
        if (scheduleRaw) {
          // Ditemukan Rombongan Utama Baru -> Update Konteks Rombongan
          currentRombonganContext = {
            scheduleRaw: scheduleRaw,
            flightRaw: flightRaw,
            embarkasiRaw: embarkasiRaw,
            ownerRaw: ownerRaw,
            pembimbingRaw: pembimbingRaw
          };
        } else if (currentRombonganContext) {
          // Varian Paket Turunan (Merged child row) -> Warisi kontek Rombongan Utama
          scheduleRaw = currentRombonganContext.scheduleRaw;
          if (!flightRaw) flightRaw = currentRombonganContext.flightRaw;
          if (!embarkasiRaw) embarkasiRaw = currentRombonganContext.embarkasiRaw;
          if (!ownerRaw) ownerRaw = currentRombonganContext.ownerRaw;
          if (!pembimbingRaw) pembimbingRaw = currentRombonganContext.pembimbingRaw;
        }
      }

      // Indonesian Date Formatting
      const scheduleKeberangkatan = formatPaketDateIndo(scheduleRaw);
      const actualFlight = formatPaketDateIndo(flightRaw);

      // Core numbers & calculations
      const forecastSale = parsePaketNumber(cleanPaketErrorVal(getPaketPropVal(rowObj, ['Forecast Sale', 'Forecast', 'Target Sale', 'ForecastSale'], 0), 0), 0);
      const tiketTersedia = parsePaketNumber(cleanPaketErrorVal(getPaketPropVal(rowObj, ['Tiket Tersedia', 'Tiket', 'TiketTersedia'], 0), 0), 0);
      const qtyJamaahDirect = parsePaketNumber(cleanPaketErrorVal(getPaketPropVal(rowObj, ['QTY Jama\'ah', 'QTY Jamaah', 'Qty Jamaah', 'QTY_Jamaah'], 0), 0), 0);

      // 4. PENAMBAHAN KOLOM DINAMIS (Poin 4)
      const dynamicCols = [];
      let sumDynamicJamaah = 0;

      dynamicHeaders.forEach(dh => {
        const rawVal = rowData[dh.colIndex];
        const cleanedVal = cleanPaketErrorVal(rawVal, 0);
        const numVal = parsePaketNumber(cleanedVal, 0);
        sumDynamicJamaah += numVal;

        const camelKey = dh.headerName.toLowerCase().replace(/[^a-z0-9]/g, '');

        dynamicCols.push({
          key: camelKey,
          label: dh.headerName,
          val: numVal,
          displayVal: numVal > 0 ? numVal : '-'
        });
      });

      const qtyJamaahTotalRaw = parsePaketNumber(cleanPaketErrorVal(getPaketPropVal(rowObj, ['QTY Jama\'ah Total', 'Total Jamaah'], 0), 0), 0);
      const qtyJamaah = qtyJamaahTotalRaw > 0 ? qtyJamaahTotalRaw : (sumDynamicJamaah > 0 ? sumDynamicJamaah : qtyJamaahDirect);

      let seatTersedia = parsePaketNumber(cleanPaketErrorVal(getPaketPropVal(rowObj, ['Seat Tersedia', 'Sisa Seat', 'Seat_Tersedia'], 0), 0), 0);
      if (seatTersedia === 0 && tiketTersedia > 0) {
        seatTersedia = Math.max(0, tiketTersedia - qtyJamaah);
      }

      const idP = 'PROG-' + (i - headerRowIndex);
      const curType = String(typePaket || '').trim().toLowerCase();

      let typeReqCount = 0;
      if (curType && allReqList && allReqList.length > 0) {
        allReqList.forEach(r => {
          const rType = String(r.typePaket || '').trim().toLowerCase();
          if (rType) {
            if (rType === curType || rType.includes(curType) || curType.includes(rType)) {
              typeReqCount++;
            }
          }
        });
      }

      const rowResult = {
        idPaket: idP,
        no: no || (i - headerRowIndex),
        scheduleKeberangkatan: scheduleKeberangkatan || '-',
        actualFlight: actualFlight || '-',
        embarkasi: embarkasiRaw || '-',
        owner: ownerRaw || '-',
        typePaket: typePaket || 'Reguler',
        program: program || 'Program Tanpa Nama',
        namaPaket: program || 'Program Tanpa Nama',
        jenisPaket: typePaket || 'Reguler',
        forecastSale: forecastSale,
        tiketTersedia: tiketTersedia,
        kuotaTotal: tiketTersedia,
        qtyJamaahDirect: qtyJamaahDirect,
        pembimbing: pembimbingRaw || '-',
        dynamicCols: dynamicCols,
        qtyJamaah: qtyJamaah,
        seatTersedia: seatTersedia,
        sisaKuota: seatTersedia,
        keterangan: keterangan,
        typePaketHasRequest: typeReqCount > 0,
        typePaketRequestCount: typeReqCount,
        requestSeatCount: typeReqCount,
        hasRequestSeat: typeReqCount > 0,
        rowIndex: rowPosition
      };

      // Set dynamic keys directly on row object
      dynamicCols.forEach(dc => {
        rowResult[dc.key] = dc.val;
      });

      list.push(rowResult);
    }

    return {
      success: true,
      headers: dynamicHeaders.map(dh => dh.headerName),
      data: list
    };
  } catch (e) {
    Logger.log('Error getDashProgDataList: ' + e.message);
    return { success: false, headers: [], data: [], message: 'Error: ' + e.message };
  }
}

/**
 * Mengambil seluruh data paket dari sheet "DataPaket"
 */
function getPaketDataList() {
  try {
    const sheet = setupPaketSheet();
    const targetSheetName = sheet ? sheet.getName() : PAKET_CONFIG.SHEET_NAME;

    const rawRows = getSheetData(targetSheetName);
    if (!rawRows || !Array.isArray(rawRows) || rawRows.length === 0) return [];

    const list = [];
    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];

      const idPaket = String(getPaketPropVal(row, ['ID Paket', 'ID', 'Id Paket', 'idPaket', 'id', 'Kode Paket', 'ID_Paket'], '')).trim();
      const namaPaket = String(getPaketPropVal(row, ['Nama Paket', 'NamaPaket', 'Nama', 'namaPaket', 'Paket', 'Nama_Paket'], '')).trim();

      const statusPaketStr = String(getPaketPropVal(row, ['Status Paket', 'Status', 'statusPaket', 'Status_Paket'], 'Active')).trim();
      const statusClean = statusPaketStr.toLowerCase();
      const isInactiveStatus = [
        'inactive', 'non-aktif', 'non aktif', 'tidak aktif', 
        'closed', 'tutup', 'archived', 'arsip', 'disabled', 'false', '0'
      ].includes(statusClean);

      // Sesuai aturan global: lewati/sembunyikan paket yang berstatus Inactive/Non-Aktif
      if (isInactiveStatus) continue;

      list.push({
        idPaket: idPaket || ('PKT-' + (i + 1)),
        namaPaket: namaPaket || 'Paket Tanpa Nama',
        program: namaPaket || 'Paket Tanpa Nama',
        jenisPaket: String(getPaketPropVal(row, ['Jenis Paket Umrah', 'Type Paket', 'Jenis Paket', 'Tipe Paket', 'jenisPaket', 'Type_Paket', 'Jenis'], 'Reguler')).trim(),
        typePaket: String(getPaketPropVal(row, ['Jenis Paket Umrah', 'Type Paket', 'Jenis Paket', 'Tipe Paket', 'jenisPaket', 'Type_Paket', 'Jenis'], 'Reguler')).trim(),
        musimYear: String(getPaketPropVal(row, ['Musim / Year', 'Musim', 'Tahun', 'Year', 'musimYear', 'Musim_Year'], '')).trim(),
        tglKeberangkatan: tglKeberangkatanStr,
        durasiHari: parsePaketNumber(getPaketPropVal(row, ['Durasi (Hari)', 'Durasi', 'Hari', 'durasiHari', 'Durasi_Hari'], 0), 0),
        hotelMakkah: String(getPaketPropVal(row, ['Hotel Makkah', 'HotelMakkah', 'hotelMakkah', 'Hotel_Makkah'], '')).trim(),
        hotelMadinah: String(getPaketPropVal(row, ['Hotel Madinah', 'HotelMadinah', 'hotelMadinah', 'Hotel_Madinah'], '')).trim(),
        maskapai: String(getPaketPropVal(row, ['Maskapai', 'Penerbangan', 'Airline', 'maskapai'], '')).trim(),
        hargaQuad: parsePaketNumber(getPaketPropVal(row, ['Harga Quad', 'Quad', 'HargaQuad', 'hargaQuad', 'Harga_Quad'], 0), 0),
        hargaTriple: parsePaketNumber(getPaketPropVal(row, ['Harga Triple', 'Triple', 'HargaTriple', 'hargaTriple', 'Harga_Triple'], 0), 0),
        hargaDouble: parsePaketNumber(getPaketPropVal(row, ['Harga Double', 'Double', 'HargaDouble', 'hargaDouble', 'Harga_Double'], 0), 0),
        kuotaTotal: parsePaketNumber(getPaketPropVal(row, ['Kuota Total', 'Total Kuota', 'Kuota', 'kuotaTotal', 'Total_Kuota'], 0), 0),
        tiketTersedia: parsePaketNumber(getPaketPropVal(row, ['Kuota Total', 'Total Kuota', 'Kuota', 'kuotaTotal', 'Total_Kuota'], 0), 0),
        sisaKuota: parsePaketNumber(getPaketPropVal(row, ['Sisa Kuota', 'Sisa', 'sisaKuota', 'Sisa_Kuota'], 0), 0),
        seatTersedia: parsePaketNumber(getPaketPropVal(row, ['Sisa Kuota', 'Sisa', 'sisaKuota', 'Sisa_Kuota'], 0), 0),
        statusPaket: statusPaketStr || 'Active',
        catatan: String(getPaketPropVal(row, ['Catatan', 'Keterangan', 'catatan'], '')).trim(),
        keterangan: String(getPaketPropVal(row, ['Catatan', 'Keterangan', 'catatan'], '')).trim(),
        createdAt: String(getPaketPropVal(row, ['CreatedAt', 'Created At', 'createdAt'], '')),
        userInput: String(getPaketPropVal(row, ['UserInput', 'User Input', 'userInput'], '')),
        rowIndex: row._rowIndex || (i + 2)
      });
    }

    return list;
  } catch (e) {
    Logger.log('Error getPaketDataList: ' + e.message);
    return [];
  }
}

/**
 * Menyimpan data paket baru atau memperbarui data paket lama
 * @param {Object} data Objek data paket dari frontend
 */
function savePaketData(data) {
  try {
    if (!data || !data.namaPaket) {
      return { success: false, message: 'Nama Paket wajib diisi!' };
    }

    const sheet = setupPaketSheet();
    const now = new Date();
    const timestampStr = Utilities.formatDate(now, Session.getScriptTimeZone() || 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss');
    const userEmail = Session.getActiveUser().getEmail() || data.userInput || 'admin';
    const id = data.idPaket || ('PKT-' + Utilities.formatDate(now, Session.getScriptTimeZone() || 'Asia/Jakarta', 'yyyyMMdd-HHmmss'));

    const rowData = [
      id,
      data.namaPaket,
      data.jenisPaket || 'Reguler',
      data.musimYear || '',
      data.tglKeberangkatan || '',
      parsePaketNumber(data.durasiHari, 0),
      data.hotelMakkah || '',
      data.hotelMadinah || '',
      data.maskapai || '',
      parsePaketNumber(data.hargaQuad, 0),
      parsePaketNumber(data.hargaTriple, 0),
      parsePaketNumber(data.hargaDouble, 0),
      parsePaketNumber(data.kuotaTotal, 0),
      parsePaketNumber(data.sisaKuota, 0),
      data.statusPaket || 'Active',
      data.catatan || '',
      timestampStr,
      userEmail
    ];

    const lastRow = sheet.getLastRow();
    let updated = false;

    if (lastRow > 1) {
      const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (let i = 0; i < ids.length; i++) {
        if (String(ids[i][0]).trim() === id) {
          const existingCreatedAt = sheet.getRange(i + 2, 17).getValue();
          if (existingCreatedAt) rowData[16] = existingCreatedAt;

          sheet.getRange(i + 2, 1, 1, rowData.length).setValues([rowData]);
          updated = true;
          break;
        }
      }
    }

    if (!updated) {
      sheet.appendRow(rowData);
    }

    return {
      success: true,
      message: updated ? 'Data paket berhasil diperbarui!' : 'Data paket baru berhasil disimpan!',
      idPaket: id
    };
  } catch (e) {
    Logger.log('Error savePaketData: ' + e.message);
    return { success: false, message: 'Gagal menyimpan data paket: ' + e.message };
  }
}

/**
 * Menghapus data paket berdasarkan ID Paket
 * @param {string} idPaket ID Paket yang akan dihapus
 */
function deletePaketData(idPaket) {
  try {
    if (!idPaket) return { success: false, message: 'ID Paket tidak valid!' };

    const sheet = setupPaketSheet();
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return { success: false, message: 'Data paket tidak ditemukan!' };

    const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < ids.length; i++) {
      if (String(ids[i][0]).trim() === String(idPaket).trim()) {
        sheet.deleteRow(i + 2);
        return { success: true, message: 'Data paket berhasil dihapus!' };
      }
    }

    return { success: false, message: 'Data paket dengan ID tersebut tidak ditemukan!' };
  } catch (e) {
    Logger.log('Error deletePaketData: ' + e.message);
    return { success: false, message: 'Gagal menghapus data paket: ' + e.message };
  }
}

/**
 * Mengambil daftar Kantor / Kanwil dari Sheet DataKantor
 */
function getKanwilListFromSheet() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('DataKantor') || ss.getSheetByName('Data Kantor') || ss.getSheetByName('Kantor');
    const list = [];

    if (sheet) {
      const data = sheet.getDataRange().getValues();
      if (data && data.length > 0) {
        const header = data[0];
        let colIdx = -1;
        header.forEach((h, idx) => {
          const cleanH = String(h).toLowerCase().trim();
          if (cleanH.includes('kantor') || cleanH.includes('kanwil') || cleanH.includes('cabang') || cleanH.includes('nama')) {
            if (colIdx === -1) colIdx = idx;
          }
        });

        if (colIdx !== -1) {
          for (let i = 1; i < data.length; i++) {
            const val = String(data[i][colIdx] || '').trim();
            if (val && !list.includes(val)) list.push(val);
          }
        } else {
          // If no specific column match, grab header text items or first column
          for (let i = 1; i < data.length; i++) {
            const val = String(data[i][0] || '').trim();
            if (val && !list.includes(val)) list.push(val);
          }
        }
      }
    }

    // Fallback to dynamic headers from DashProg if DataKantor empty or missing
    if (list.length === 0) {
      const dashRes = getDashProgDataList();
      if (dashRes && Array.isArray(dashRes.headers) && dashRes.headers.length > 0) {
        dashRes.headers.forEach(h => {
          if (h && !list.includes(h)) list.push(h);
        });
      }
    }

    // Default standard list fallback
    if (list.length === 0) {
      return [
        'Kanwil JABO', 'Kanwil Surabaya', 'Kanwil Kaltim', 'Kanwil solo Raya',
        'Kanwil Banyumas', 'Kanwil pekalongan Raya', 'Kacab Gresik', 'Rembang',
        'Kyai Khusnan', 'Other'
      ];
    }

    return list;
  } catch (e) {
    Logger.log('Error getKanwilListFromSheet: ' + e.message);
    return [
      'Kanwil JABO', 'Kanwil Surabaya', 'Kanwil Kaltim', 'Kanwil solo Raya',
      'Kanwil Banyumas', 'Kanwil pekalongan Raya', 'Kacab Gresik', 'Rembang',
      'Kyai Khusnan', 'Other'
    ];
  }
}

/**
 * Setup atau dapatkan Sheet RequestSeat
 */
function setupRequestSeatSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('RequestSeat') || ss.getSheetByName('Request_Seat');
  if (!sheet) {
    sheet = ss.insertSheet('RequestSeat');
    sheet.appendRow([
      'idRequest', 'Timestamp', 'User Request', 'Type Paket', 'Kanwil',
      'Jumlah Seat', 'Catatan', 'Status', 'UserAppv', 'TglApprv', 'JamApprv', 'idPaket'
    ]);
    sheet.getRange(1, 1, 1, 12).setFontWeight('bold').setBackground('#1e293b').setFontColor('#f8fafc');
  }
  return sheet;
}

/**
 * Menyimpan pengajuan Request Seat ke Sheet RequestSeat
 */
function saveRequestSeatData(formData, currentUser) {
  try {
    if (!formData) return { success: false, message: 'Data pengajuan tidak valid!' };
    if (!formData.kanwil) return { success: false, message: 'Harap pilih Asal Kanwil / Cabang!' };
    if (!formData.jumlahSeat || Number(formData.jumlahSeat) <= 0) return { success: false, message: 'Jumlah seat harus lebih besar dari 0!' };

    const sheet = setupRequestSeatSheet();
    const idRequest = 'REQ-' + Date.now();
    const now = new Date();
    const timestampStr = Utilities.formatDate(now, Session.getScriptTimeZone() || 'Asia/Jakarta', 'dd/MM/yyyy HH:mm:ss');
    const userReq = (currentUser && (currentUser.fullName || currentUser.username)) ? (currentUser.fullName || currentUser.username) : (formData.userRequest || 'User');

    const rowData = [
      idRequest,
      timestampStr,
      userReq,
      formData.typePaket || '-',
      formData.kanwil || '-',
      Number(formData.jumlahSeat || 1),
      formData.catatan || '-',
      'Pending',
      '',
      '',
      '',
      formData.idPaket || ''
    ];

    sheet.appendRow(rowData);

    return {
      success: true,
      message: 'Request seat berhasil diajukan!',
      idRequest: idRequest
    };
  } catch (e) {
    Logger.log('Error saveRequestSeatData: ' + e.message);
    return { success: false, message: 'Gagal mengajukan request seat: ' + e.message };
  }
}

/**
 * Mengambil daftar riwayat pengajuan Request Seat berdasarkan ID Paket / Type Paket
 */
function getRequestSeatList(idPaket) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('RequestSeat') || ss.getSheetByName('Request_Seat');
    if (!sheet) return { success: true, data: [] };

    const data = sheet.getDataRange().getValues();
    if (!data || data.length <= 1) return { success: true, data: [] };

    const list = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0) continue;

      const item = {
        idRequest: String(row[0] || ('REQ-' + i)),
        timestamp: String(row[1] || ''),
        userRequest: String(row[2] || ''),
        typePaket: String(row[3] || ''),
        kanwil: String(row[4] || ''),
        jumlahSeat: Number(row[5] || 0),
        catatan: String(row[6] || ''),
        status: String(row[7] || 'Pending'),
        userAppv: String(row[8] || ''),
        tglApprv: String(row[9] || ''),
        jamApprv: String(row[10] || ''),
        idPaket: String(row[11] || ''),
        rowIndex: i + 1
      };

      if (!idPaket || item.idPaket === String(idPaket) || item.typePaket === String(idPaket)) {
        list.push(item);
      }
    }

    // Return in reverse chronological order
    list.reverse();
    return { success: true, data: list };
  } catch (e) {
    Logger.log('Error getRequestSeatList: ' + e.message);
    return { success: false, data: [], message: 'Gagal mengambil riwayat request: ' + e.message };
  }
}

/**
 * Menghapus pengajuan Request Seat
 */
function deleteRequestSeatData(idRequest, currentUser) {
  try {
    if (!idRequest) return { success: false, message: 'ID Request tidak valid!' };

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('RequestSeat') || ss.getSheetByName('Request_Seat');
    if (!sheet) return { success: false, message: 'Sheet RequestSeat tidak ditemukan!' };

    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return { success: false, message: 'Data request tidak ditemukan!' };

    const data = sheet.getRange(2, 1, lastRow - 1, 12).getValues();
    const reqUser = currentUser ? (currentUser.fullName || currentUser.username || '').toLowerCase().trim() : '';

    for (let i = 0; i < data.length; i++) {
      const rowId = String(data[i][0]).trim();
      const ownerUser = String(data[i][2] || '').toLowerCase().trim();

      if (rowId === String(idRequest).trim()) {
        // Ownership check
        if (reqUser && ownerUser && ownerUser !== reqUser && !reqUser.includes('admin')) {
          return { success: false, message: 'Anda hanya dapat menghapus request seat milik Anda sendiri!' };
        }

        sheet.deleteRow(i + 2);
        return { success: true, message: 'Request seat berhasil dihapus!' };
      }
    }

    return { success: false, message: 'Data request dengan ID tersebut tidak ditemukan!' };
  } catch (e) {
    Logger.log('Error deleteRequestSeatData: ' + e.message);
    return { success: false, message: 'Gagal menghapus request seat: ' + e.message };
  }
}
