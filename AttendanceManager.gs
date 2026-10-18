/**
 * ============================================================================
 * ATTENDANCE SUMMARY HANDLER (AttendanceManager.gs)
 * ============================================================================
 * Membaca modul "Rekap Absensi" dari Google Sheet:
 * - Abaikan baris data yang kosong / tidak ada nama karyawan
 * - Status 'P' = Dinas (Warna Merah Muda / Pink)
 * - Status 'C' = Cuti (Warna Putih)
 * - Bulan & Tahun dinamis dari Baris 3 Kolom 3 & Baris 4 Kolom 3
 * - Header: Baris 9, 10, 11 | Data: Mulai Baris 12
 */

function getAttendanceSheet() {
  const db = getDb();
  let sheet = db.getSheetByName('Rekap Absensi') ||
              db.getSheetByName('Rekap Absen') ||
              db.getSheetByName('RekapAbsensi') ||
              db.getSheetByName('Absensi');

  if (!sheet) {
    sheet = getOrCreateSheet('Rekap Absensi');
  }
  return sheet;
}

/**
 * Mengisi data contoh ke Sheet "Rekap Absensi" jika sheet kosong / baru
 */
function seedDefaultAttendanceSheetIfEmpty(sheet) {
  try {
    const lastRow = sheet.getLastRow();
    if (lastRow < 11) {
      sheet.clear();

      sheet.getRange(1, 1).setValue('REKAPITULASI ABSENSI KARYAWAN PT FATH INDAH');
      
      // Baris 3 Kolom 3 = Bulan (8 / Agustus)
      sheet.getRange(3, 1).setValue('Periode Absensi:');
      sheet.getRange(3, 2).setValue('Bulan:');
      sheet.getRange(3, 3).setValue(8);

      // Baris 4 Kolom 3 = Tahun (2026)
      sheet.getRange(4, 1).setValue('Zona Waktu:');
      sheet.getRange(4, 2).setValue('Tahun:');
      sheet.getRange(4, 3).setValue(2026);

      sheet.getRange(1, 1).setFontWeight('bold').setFontSize(14).setFontColor('#06b6d4');

      // Baris 9: NO, NAMA KARYAWAN, LOKASI & BULAN di Kolom 4 (Index 3)
      const r9 = ['NO', 'NAMA KARYAWAN', 'LOKASI'];
      for (let d = 1; d <= 31; d++) {
        r9.push(d === 1 ? 'BULAN AGUSTUS 2026 (TANGGAL 1 - 30)' : '');
      }

      // Baris 10: Tanggal 1 s/d 31
      const r10 = ['', '', ''];
      for (let d = 1; d <= 31; d++) {
        r10.push(d);
      }

      // Baris 11: Nama Hari
      const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
      const r11 = ['NO', 'NAMA KARYAWAN', 'LOKASI'];
      for (let d = 1; d <= 31; d++) {
        const dayName = days[(d + 5) % 7];
        r11.push(dayName);
      }

      // Baris 12+: Data Sampel (P = Dinas Pink, C = Cuti Putih)
      const sampleRows = [
        [1, 'Budi Santoso', 'Jakarta', 'H','H','H','H','P','C','C','H','H','H','H','H','C','C','H','H','H','H','H','C','C','H','H','H','H','H','C','C','H','H','H'],
        [2, 'Siti Aminah', 'Bandung', 'H','H','S','H','H','C','C','H','H','P','H','H','C','C','H','H','H','H','H','C','C','H','H','H','H','H','C','C','H','H','H'],
        [3, 'Ahmad Rizky', 'Surabaya', 'H','I','I','H','P','C','C','H','H','H','H','H','C','C','H','H','H','H','H','C','C','H','H','H','H','H','C','C','H','H','H'],
        [4, 'Dewi Lestari', 'Medan', 'P','H','H','H','H','C','C','H','H','H','H','H','C','C','H','H','H','H','H','C','C','H','H','H','H','H','C','C','H','H','H'],
        [5, 'Eko Prasetyo', 'Semarang', 'H','H','A','A','H','C','C','H','H','I','P','H','C','C','H','H','H','H','H','C','C','H','H','H','H','H','C','C','H','H','H']
      ];

      sheet.getRange(9, 1, 1, r9.length).setValues([r9]);
      sheet.getRange(10, 1, 1, r10.length).setValues([r10]);
      sheet.getRange(11, 1, 1, r11.length).setValues([r11]);

      const headerRange = sheet.getRange(9, 1, 3, r9.length);
      headerRange.setBackground('#0f172a');
      headerRange.setFontColor('#38bdf8');
      headerRange.setFontWeight('bold');

      sheet.getRange(12, 1, sampleRows.length, sampleRows[0].length).setValues(sampleRows);
    }
  } catch (e) {
    Logger.log('Error seedDefaultAttendanceSheetIfEmpty: ' + e.message);
  }
}

/**
 * /**
 * Utama: Membaca Rekap Absensi (Filter Baris Kosong & P = Dinas Pink) dengan RAM Caching Super Cepat
 */
function getAttendanceSummaryData(forceRefresh) {
  try {
    const cache = CacheService.getScriptCache();
    if (!forceRefresh) {
      const cached = cache.get('ATTENDANCE_SUMMARY_CACHE_V6');
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch (e) {}
      }
    }

    const sheet = getAttendanceSheet();
    seedDefaultAttendanceSheetIfEmpty(sheet);

    let data = sheet.getDataRange().getValues();

    if (!data || data.length < 11) {
      sheet.clear();
      seedDefaultAttendanceSheetIfEmpty(sheet);
      data = sheet.getDataRange().getValues();
    }

    // 1. Ambil Bulan dari Baris 3 Kolom 3 (Index data[2][2])
    let rawMonth = (data.length > 2 && data[2] && data[2][2]) ? data[2][2] : 8;
    
    // 2. Ambil Tahun dari Baris 4 Kolom 3 (Index data[3][2])
    let rawYear = (data.length > 3 && data[3] && data[3][2]) ? data[3][2] : 2026;

    let monthNum = 8;
    if (typeof rawMonth === 'number' && rawMonth >= 1 && rawMonth <= 12) {
      monthNum = rawMonth;
    } else if (rawMonth) {
      const mStr = String(rawMonth).toLowerCase();
      const monthsMap = {
        'januari': 1, 'january': 1, 'jan': 1,
        'februari': 2, 'february': 2, 'feb': 2,
        'maret': 3, 'march': 3, 'mar': 3,
        'april': 4, 'apr': 4,
        'mei': 5, 'may': 5,
        'juni': 6, 'june': 6, 'jun': 6,
        'juli': 7, 'july': 7, 'jul': 7,
        'agustus': 8, 'august': 8, 'agu': 8, 'aug': 8,
        'september': 9, 'sep': 9,
        'oktober': 10, 'october': 10, 'okt': 10, 'oct': 10,
        'november': 11, 'nov': 11,
        'desember': 12, 'december': 12, 'des': 12, 'dec': 12
      };
      for (let key in monthsMap) {
        if (mStr.includes(key)) {
          monthNum = monthsMap[key];
          break;
        }
      }
    }

    let yearNum = parseInt(rawYear) || 2026;

    // Hitung tanggal & hari Sabtu/Minggu secara presisi
    const daysAbbr = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    const daysSingle = ['M', 'S', 'S', 'R', 'K', 'J', 'S'];
    const dateInfoList = [];

    for (let d = 1; d <= 31; d++) {
      const dateObj = new Date(yearNum, monthNum - 1, d);
      const dayIdx = dateObj.getDay();
      const isWeekend = (dayIdx === 0 || dayIdx === 6);
      dateInfoList.push({
        date: d,
        dayIdx: dayIdx,
        dayName: daysAbbr[dayIdx],
        daySingle: daysSingle[dayIdx],
        isWeekend: isWeekend
      });
    }

    let r9Idx = 8;
    let r10Idx = 9;
    let r11Idx = 10;
    let dataStartIdx = 11;

    const row9Raw = data[r9Idx] || [];
    const row10Raw = data[r10Idx] || [];
    const row11Raw = data[r11Idx] || [];

    const maxCols = Math.max(row9Raw.length, row10Raw.length, row11Raw.length, 34);

    const row9 = [];
    const row10 = [];
    const row11 = [];
    const combined = [];

    for (let c = 0; c < maxCols; c++) {
      const v9 = row9Raw[c] !== undefined && row9Raw[c] !== null ? String(row9Raw[c]).trim() : '';
      const v10 = row10Raw[c] !== undefined && row10Raw[c] !== null ? String(row10Raw[c]).trim() : '';
      const v11 = row11Raw[c] !== undefined && row11Raw[c] !== null ? String(row11Raw[c]).trim() : '';

      row9.push(v9);
      row10.push(v10);
      row11.push(v11);

      const labelParts = [v9, v10, v11].filter((val, idx, arr) => val && arr.indexOf(val) === idx);
      combined.push(labelParts.length > 0 ? labelParts.join(' - ') : 'Kolom ' + (c + 1));
    }

    const rawDataRows = data.length > dataStartIdx ? data.slice(dataStartIdx) : [];
    const processedRows = [];
    const seenEmployees = new Set();

    rawDataRows.forEach((row, rowIndex) => {
      // Abaikan jika seluruh sel dalam baris kosong
      const isRowEmpty = row.every(cell => cell === '' || cell === null || cell === undefined);
      if (isRowEmpty) return;

      // Abaikan jika Nama Karyawan (Kolom Index 1) Kosong
      const empName = row[1] !== undefined && row[1] !== null ? String(row[1]).trim() : '';
      if (!empName) return;

      // Filter Deduplikasi: Abaikan jika Nama Karyawan sudah diproses sebelumnya
      const empKey = empName.toLowerCase();
      if (seenEmployees.has(empKey)) return;
      seenEmployees.add(empKey);

      const cleanValues = row.map(val => (val !== undefined && val !== null ? String(val).trim() : ''));

      processedRows.push({
        id: processedRows.length + 1,
        rowNum: dataStartIdx + rowIndex + 1,
        values: cleanValues
      });
    });

    const result = {
      success: true,
      month: monthNum,
      year: yearNum,
      dateInfoList: dateInfoList,
      headers: {
        row9: row9,
        row10: row10,
        row11: row11,
        combined: combined
      },
      rows: processedRows
    };

    try {
      cache.put('ATTENDANCE_SUMMARY_CACHE_V7', JSON.stringify(result), 1800); // Cache 30 Menit
    } catch (e) {}

    return result;

  } catch (err) {
    Logger.log('Error pada getAttendanceSummaryData: ' + err.toString());
    return {
      success: false,
      message: 'Gagal membaca sheet Rekap Absensi: ' + err.message,
      headers: { row9: [], row10: [], row11: [], combined: [] },
      rows: []
    };
  }
}

/**
 * ============================================================================
 * LOG DATA ABSENSI HANDLER (Sheet: Data Absensi)
 * ============================================================================
 */

function getDataAttendanceSheet() {
  const db = getDb();
  let sheet = db.getSheetByName('Data Absensi') ||
              db.getSheetByName('DataAbsensi') ||
              db.getSheetByName('Data Absen') ||
              db.getSheetByName('Log Absensi');

  if (!sheet) {
    sheet = getOrCreateSheet('Data Absensi');
  }
  return sheet;
}

/**
 * Auto-seed data contoh untuk Sheet "Data Absensi" jika masih kosong
 */
function seedDefaultDataAttendanceSheetIfEmpty(sheet) {
  try {
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      sheet.clear();
      
      const headers = ['Timestamp', 'NamaKaryawan', 'Tipe', 'Kode', 'Link Google Maps'];
      const sampleLogs = [
        ['2026-08-24 07:45:12 WIB', 'Budi Santoso', 'Masuk', 'H', 'https://www.google.com/maps?q=-6.2088,106.8456'],
        ['2026-08-24 07:55:00 WIB', 'Siti Aminah', 'Masuk', 'H', 'https://www.google.com/maps?q=-6.9175,107.6191'],
        ['2026-08-24 08:10:25 WIB', 'Ahmad Rizky', 'Masuk', 'H', 'https://www.google.com/maps?q=-7.2575,112.7521'],
        ['2026-08-24 08:30:15 WIB', 'Dewi Lestari', 'Dinas', 'P', 'https://www.google.com/maps?q=3.5952,98.6722'],
        ['2026-08-24 09:00:00 WIB', 'Eko Prasetyo', 'Sakit', 'S', 'https://www.google.com/maps?q=-6.9667,110.4167'],
        ['2026-08-24 17:05:30 WIB', 'Budi Santoso', 'Pulang', 'H', 'https://www.google.com/maps?q=-6.2088,106.8456'],
        ['2026-08-24 17:15:10 WIB', 'Siti Aminah', 'Pulang', 'H', 'https://www.google.com/maps?q=-6.9175,107.6191']
      ];

      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      const headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setBackground('#0f172a').setFontColor('#38bdf8').setFontWeight('bold');

      sheet.getRange(2, 1, sampleLogs.length, sampleLogs[0].length).setValues(sampleLogs);
    }
  } catch (e) {
    Logger.log('Error seedDefaultDataAttendanceSheetIfEmpty: ' + e.message);
  }
}

/**
 * Format tanggal dari Timestamp menjadi "dd mmmm yyyy" (Bahasa Indonesia)
 */
function formatDateIndo(dateObj) {
  if (!dateObj || isNaN(dateObj.getTime())) return '';
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = months[dateObj.getMonth()];
  const year = dateObj.getFullYear();
  return `${day} ${month} ${year}`;
}

/**
 * Format jam dari Timestamp menjadi "hh:mm:ss"
 */
function formatTimeHHMMSS(dateObj) {
  if (!dateObj || isNaN(dateObj.getTime())) return '';
  const hours = String(dateObj.getHours()).padStart(2, '0');
  const minutes = String(dateObj.getMinutes()).padStart(2, '0');
  const seconds = String(dateObj.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

/**
 * Format tanggal standar YYYY-MM-DD untuk Date Picker Filter
 */
function formatDateISO(dateObj) {
  if (!dateObj || isNaN(dateObj.getTime())) return '';
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Utilitas Utama: Membaca Sheet "Data Absensi"
 */
function getRawAttendanceLogsData() {
  try {
    const sheet = getDataAttendanceSheet();
    seedDefaultDataAttendanceSheetIfEmpty(sheet);

    const data = sheet.getDataRange().getValues();
    if (!data || data.length < 2) {
      return { success: true, data: [] };
    }

    const rawHeaders = data[0].map(h => String(h || '').trim());
    
    let tsIdx = rawHeaders.findIndex(h => /timestamp/i.test(h));
    let nameIdx = rawHeaders.findIndex(h => h.replace(/\s+/g, '').toLowerCase() === 'namakaryawan');
    if (nameIdx === -1) {
      nameIdx = rawHeaders.findIndex(h => /namakaryawan|nama/i.test(h));
    }
    let typeIdx = rawHeaders.findIndex(h => /tipe|type/i.test(h));
    let codeIdx = rawHeaders.findIndex(h => /kode|code/i.test(h));
    let mapIdx = rawHeaders.findIndex(h => /maps|peta|google/i.test(h));

    if (tsIdx === -1) tsIdx = 0;
    if (nameIdx === -1) nameIdx = 1;
    if (typeIdx === -1) typeIdx = 2;
    if (codeIdx === -1) codeIdx = 3;
    if (mapIdx === -1) mapIdx = 4;

    const rows = data.slice(1);
    const resultList = [];

    rows.forEach((row, idx) => {
      const isRowEmpty = row.every(cell => cell === '' || cell === null || cell === undefined);
      if (isRowEmpty) return;

      const rawTs = row[tsIdx];
      const empName = row[nameIdx] !== undefined && row[nameIdx] !== null ? String(row[nameIdx]).trim() : '';
      if (!empName) return;

      const typeVal = row[typeIdx] !== undefined ? String(row[typeIdx]).trim() : '';
      const codeVal = row[codeIdx] !== undefined ? String(row[codeIdx]).trim() : '';
      const mapVal = row[mapIdx] !== undefined ? String(row[mapIdx]).trim() : '';

      let dateObj = null;
      let formattedDate = '';
      let formattedTime = '';
      let isoDate = '';

      if (rawTs instanceof Date) {
        dateObj = rawTs;
      } else if (rawTs) {
        const parsed = new Date(rawTs);
        if (!isNaN(parsed.getTime())) {
          dateObj = parsed;
        } else {
          const parts = String(rawTs).replace('WIB', '').trim().split(' ');
          if (parts.length >= 1) {
            const dateParts = parts[0].split('-');
            if (dateParts.length === 3) {
              const year = parseInt(dateParts[0]);
              const month = parseInt(dateParts[1]) - 1;
              const day = parseInt(dateParts[2]);
              let hour = 0, min = 0, sec = 0;
              if (parts[1]) {
                const timeParts = parts[1].split(':');
                if (timeParts.length >= 2) {
                  hour = parseInt(timeParts[0]);
                  min = parseInt(timeParts[1]);
                  sec = timeParts[2] ? parseInt(timeParts[2]) : 0;
                }
              }
              dateObj = new Date(year, month, day, hour, min, sec);
            }
          }
        }
      }

      if (dateObj && !isNaN(dateObj.getTime())) {
        formattedDate = formatDateIndo(dateObj);
        formattedTime = formatTimeHHMMSS(dateObj);
        isoDate = formatDateISO(dateObj);
      } else {
        formattedDate = String(rawTs || '-');
        formattedTime = '-';
        isoDate = '';
      }

      let formattedMapLink = mapVal;
      if (mapVal) {
        const lowerVal = mapVal.toLowerCase();
        if (!lowerVal.startsWith('http://') && !lowerVal.startsWith('https://')) {
          if (lowerVal.startsWith('www.')) {
            formattedMapLink = 'https://' + mapVal;
          } else if (/^[-+]?[\d.]+\s*,\s*[-+]?[\d.]+$/.test(mapVal)) {
            formattedMapLink = 'https://www.google.com/maps?q=' + encodeURIComponent(mapVal.replace(/\s+/g, ''));
          } else if (mapVal.length > 3) {
            formattedMapLink = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(mapVal);
          }
        }
      }

      resultList.push({
        id: idx + 1,
        rawTimestamp: dateObj ? dateObj.getTime() : 0,
        isoDate: isoDate,
        tanggal: formattedDate,
        jam: formattedTime,
        namaKaryawan: empName,
        tipe: typeVal,
        kode: codeVal,
        linkMaps: formattedMapLink
      });
    });

    return {
      success: true,
      data: resultList
    };

  } catch (e) {
    Logger.log('Error getRawAttendanceLogsData: ' + e.message);
    return {
      success: false,
      message: 'Gagal membaca Sheet Data Absensi: ' + e.message,
      data: []
    };
  }
}
