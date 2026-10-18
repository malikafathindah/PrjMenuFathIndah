/**
 * ============================================================================
 * COST STRUCTURE MANAGER (CostStructureManager.gs)
 * ============================================================================
 * Mengelola penyimpanan, pemanggilan, dan penghapusan draf perhitungan HPP &
 * Struktur Biaya Paket Umrah ke/dari Google Sheets.
 */

/**
 * Menyimpan atau memperbarui draf Struktur Biaya Paket Umrah ke sheet CostStructure
 * @param {Object|string} payload Data struktur biaya dari frontend (objek atau JSON string)
 */
function saveCostStructure(payload) {
  try {
    let data;
    if (typeof payload === 'string') {
      data = JSON.parse(payload);
    } else {
      data = payload;
    }

    if (!data || !data.namaProduk) {
      return { success: false, message: 'Nama Produk Umrah wajib diisi!' };
    }

    const sheetHeaders = [
      'ID', 'Timestamp', 'KodeProduk', 'NamaProduk', 'Kategori',
      'TglBerangkat', 'TglBerlaku', 'TotalHPP', 'TotalFaedah',
      'HargaJual', 'PayloadJSON', 'UserInput'
    ];

    const sheet = getOrCreateSheet(CONFIG.SHEETS.COST_STRUCTURE || 'CostStructure', sheetHeaders);

    const now = new Date();
    const timestampStr = Utilities.formatDate(now, Session.getScriptTimeZone() || 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss');
    const id = data.id || ('CS-' + Utilities.formatDate(now, Session.getScriptTimeZone() || 'Asia/Jakarta', 'yyyyMMdd-HHmmss'));
    const kpu = data.kpu || ('KPU-' + Utilities.formatDate(now, Session.getScriptTimeZone() || 'Asia/Jakarta', 'yyyyMM-') + Math.floor(100 + Math.random() * 900));

    const totalHpp = Number(data.totalHpp || 0);
    const totalFaedah = Number(data.totalFaedah || 0);
    const hargaJual = Number(data.hargaJual || (totalHpp + totalFaedah));
    const jsonStr = JSON.stringify(data);
    const userEmail = Session.getActiveUser().getEmail() || 'admin';

    const rowData = [
      id,
      timestampStr,
      kpu,
      data.namaProduk,
      data.kategori || 'UMRAH',
      data.tglBerangkat || '',
      data.tglBerlaku || '',
      totalHpp,
      totalFaedah,
      hargaJual,
      jsonStr,
      userEmail
    ];

    // Cek apakah ID sudah ada (Update)
    const existingData = sheet.getDataRange().getValues();
    let updated = false;

    for (let i = 1; i < existingData.length; i++) {
      if (String(existingData[i][0]).trim() === id) {
        sheet.getRange(i + 1, 1, 1, rowData.length).setValues([rowData]);
        updated = true;
        break;
      }
    }

    if (!updated) {
      sheet.appendRow(rowData);
    }

    return {
      success: true,
      message: updated ? 'Struktur Biaya berhasil diperbarui!' : 'Struktur Biaya baru berhasil disimpan!',
      id: id,
      data: data
    };

  } catch (e) {
    Logger.log('Error saveCostStructure: ' + e.message);
    return { success: false, message: 'Gagal menyimpan Struktur Biaya: ' + e.message };
  }
}

/**
 * Mengambil daftar draf Struktur Biaya dari sheet CostStructure
 */
function getCostStructureList() {
  try {
    const sheetHeaders = [
      'ID', 'Timestamp', 'KodeProduk', 'NamaProduk', 'Kategori',
      'TglBerangkat', 'TglBerlaku', 'TotalHPP', 'TotalFaedah',
      'HargaJual', 'PayloadJSON', 'UserInput'
    ];

    const sheet = getOrCreateSheet(CONFIG.SHEETS.COST_STRUCTURE || 'CostStructure', sheetHeaders);
    const rows = sheet.getDataRange().getValues();

    if (rows.length <= 1) {
      return { success: true, data: [] };
    }

    const result = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row[0]) continue;

      let payload = {};
      try {
        if (row[10]) payload = JSON.parse(row[10]);
      } catch (err) {
        payload = {};
      }

      result.push({
        id: String(row[0]),
        timestamp: String(row[1]),
        kpu: String(row[2]),
        namaProduk: String(row[3]),
        kategori: String(row[4]),
        tglBerangkat: String(row[5]),
        tglBerlaku: String(row[6]),
        totalHpp: Number(row[7] || 0),
        totalFaedah: Number(row[8] || 0),
        hargaJual: Number(row[9] || 0),
        payload: payload,
        userInput: String(row[11] || '')
      });
    }

    return { success: true, data: result.reverse() };

  } catch (e) {
    Logger.log('Error getCostStructureList: ' + e.message);
    return { success: false, message: 'Gagal memuat Struktur Biaya: ' + e.message, data: [] };
  }
}

/**
 * Menghapus record Struktur Biaya berdasarkan ID
 * @param {string} id ID Cost Structure (misal CS-20260902-120000)
 */
function deleteCostStructure(id) {
  try {
    if (!id) return { success: false, message: 'ID tidak valid!' };

    const sheet = getOrCreateSheet(CONFIG.SHEETS.COST_STRUCTURE || 'CostStructure');
    const rows = sheet.getDataRange().getValues();

    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0]).trim() === String(id).trim()) {
        sheet.deleteRow(i + 1);
        return { success: true, message: 'Struktur Biaya ID ' + id + ' berhasil dihapus!' };
      }
    }

    return { success: false, message: 'Data ID ' + id + ' tidak ditemukan.' };

  } catch (e) {
    Logger.log('Error deleteCostStructure: ' + e.message);
    return { success: false, message: 'Gagal menghapus data: ' + e.message };
  }
}

/**
 * Mengambil data sheet BiayaDN (Biaya Dalam Negeri) per Kota
 * Mendukung Kota di Kolom 1 (Row 2..N) atau Kota di Header (Col 3..N)
 */
function getBiayaDNData() {
  try {
    const defaultHeaders = [
      'Kota',
      'Biaya Manasik',
      'Trasport to Bandara',
      'Embarkasi (Bus PP)',
      'Embarkasi (Pesawat PP)',
      'Biaya Handling Bandara Inter & Blok Seat (Dep&Arrv)',
      'Biaya Handling Bandara Domestik (Dep&Arrv)',
      'Lounge Bandara',
      'Nasi Box',
      'Resto Zukavia',
      'Resto Solaria',
      'Hotel Zest Bandara',
      'Hotel Swiss Bell Bandara'
    ];

    const sheet = getOrCreateSheet('BiayaDN', defaultHeaders);

    // Seed default rows if empty
    if (sheet.getLastRow() <= 1) {
      const defaultRows = [
        ['JAKARTA',  450000, 150000, 0,      0,       250000, 0,      250000, 50000, 0,      0,     0,      0],
        ['SURABAYA', 450000, 200000, 350000, 1800000, 250000, 150000, 200000, 45000, 100000, 75000, 450000, 650000],
        ['SOLO',     400000, 150000, 250000, 1700000, 250000, 150000, 200000, 40000, 90000,  75000, 400000, 600000],
        ['MEDAN',    450000, 180000, 300000, 1900000, 250000, 150000, 225000, 45000, 100000, 75000, 450000, 650000],
        ['BANDUNG',  400000, 150000, 250000, 1600000, 250000, 150000, 200000, 40000, 90000,  75000, 400000, 600000],
        ['MAKASSAR', 450000, 200000, 350000, 2100000, 250000, 150000, 225000, 45000, 100000, 75000, 450000, 650000]
      ];
      defaultRows.forEach(r => sheet.appendRow(r));
    }

    const rows = sheet.getDataRange().getValues();
    const headers = rows[0] || [];

    const cityList = [];
    const cityDataMap = {};

    // Deteksi Struktur A: Kolom 1 adalah "Kota" (setiap baris = 1 kota)
    const firstColHeader = String(headers[0] || '').trim().toLowerCase();
    const isKotaInCol1 = firstColHeader.includes('kota') || (rows.length > 1 && !rows[1][0].toString().toLowerCase().includes('biaya'));

    if (isKotaInCol1) {
      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        const cityName = String(row[0] || '').trim().toUpperCase();
        if (!cityName) continue;

        cityList.push(cityName);
        cityDataMap[cityName] = {};

        for (let c = 1; c < headers.length; c++) {
          const compName = String(headers[c] || '').trim();
          if (compName) {
            cityDataMap[cityName][compName] = Number(row[c] || 0);
          }
        }
      }
    } else {
      // Deteksi Struktur B: Row 1 Header memuat nama-nama Kota (columns 2..N)
      for (let c = 2; c < headers.length; c++) {
        const cityName = String(headers[c] || '').trim().toUpperCase();
        if (cityName) cityList.push(cityName);
      }

      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        const compName = String(row[1] || row[0] || '').trim();
        if (!compName) continue;

        cityList.forEach((cityName, idx) => {
          if (!cityDataMap[cityName]) cityDataMap[cityName] = {};
          cityDataMap[cityName][compName] = Number(row[2 + idx] || 0);
        });
      }
    }

    return {
      success: true,
      cities: cityList,
      cityDataMap: cityDataMap
    };
  } catch (e) {
    Logger.log('Error getBiayaDNData: ' + e.message);
    return {
      success: false,
      message: e.message,
      cities: ['JAKARTA', 'SURABAYA', 'SOLO', 'MEDAN', 'BANDUNG', 'MAKASSAR'],
      cityDataMap: {}
    };
  }
}
