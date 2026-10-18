/**
 * ============================================================================
 * DASHBOARD HAJI TERENCANA MANAGER (DashboardHTManager.gs)
 * ============================================================================
 * Backend Manager untuk modul mod_dashboard_HT
 * Mengelola agregasi data angsuran Haji Terencana dan pivot bulanan.
 */

function setupDashboardHT() {
  try {
    const db = getDb();
    if (!db) return;
    const moduleSheet = db.getSheetByName('Modules') || db.getSheetByName('MODULES');
    if (!moduleSheet) return;
    
    const data = moduleSheet.getDataRange().getValues();
    if (data.length <= 1) return;
    
    const headers = data[0].map(h => String(h || '').trim().toLowerCase().replace(/[^a-z0-9]/g, ''));
    const idColIdx = headers.findIndex(h => h === 'moduleid' || h === 'id');
    if (idColIdx === -1) return;
    
    const exists = data.some((row, r) => r > 0 && String(row[idColIdx] || '').trim().toLowerCase() === 'mod_dashboard_ht');
    if (!exists) {
      moduleSheet.appendRow([
        'mod_dashboard_ht',
        'Dashboard Haji Terencana',
        'Haji',
        'Active',
        'fa-solid fa-chart-pie',
        'Admin,Manager',
        30,
        'Dashboard agregasi angsuran khusus jamaah Haji Terencana'
      ]);
    }
  } catch (e) {
    Logger.log('Error setupDashboardHT: ' + e.message);
  }
}

function getDashboardHTData() {
  try {
    const db = getDb();
    if (!db) return { success: false, message: 'Database tidak ditemukan' };
    
    setupDashboardHT();
    
    const sheetJamaah = db.getSheetByName('DataJamaahHaji');
    const sheetAngsuran = db.getSheetByName('EntryAngsuranHaji');
    
    if (!sheetJamaah || !sheetAngsuran) {
      return { success: false, message: 'Sheet DataJamaahHaji atau EntryAngsuranHaji tidak ditemukan' };
    }
    
    // Parse Jamaah
    const jamaahData = sheetJamaah.getDataRange().getValues();
    const jHeaders = jamaahData[0].map(h => String(h || '').trim());
    const jNorm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    
    const hNoBpih = jHeaders.findIndex(h => ['nobpih', 'bpih'].includes(jNorm(h)));
    const hNama = jHeaders.findIndex(h => ['nama', 'namajamaah'].includes(jNorm(h)));
    const hBulanDaftar = jHeaders.findIndex(h => ['bulanpendaftaran', 'kode'].includes(jNorm(h)));
    const hJenisHaji = jHeaders.findIndex(h => ['jenishaji', 'typehaji'].includes(jNorm(h)));
    
    // Asumsi penamaan kolom di sheet DataJamaahHaji jika ada
    const hHarga = jHeaders.findIndex(h => ['hargabpih', 'hargapaket', 'harga'].includes(jNorm(h)));
    const hDp = jHeaders.findIndex(h => ['dpangsuran', 'dp'].includes(jNorm(h)));
    const hAngsuranBulan = jHeaders.findIndex(h => ['blangsuran', 'angsuranbulan', 'angsuranperbulan'].includes(jNorm(h)));
    
    const htJamaah = {}; // Map NoBPIH => Object
    
    for (let i = 1; i < jamaahData.length; i++) {
      const row = jamaahData[i];
      const jenisHaji = hJenisHaji !== -1 ? String(row[hJenisHaji] || '').trim() : '';
      
      // Filter Haji Terencana
      if (jenisHaji.toLowerCase().includes('haji terencana') || jenisHaji === 'HT') {
        const noBpih = hNoBpih !== -1 ? String(row[hNoBpih] || '').trim() : '';
        if (!noBpih || noBpih === '-') continue;
        
        htJamaah[noBpih] = {
          noPorsi: noBpih,
          namaJamaah: hNama !== -1 ? String(row[hNama] || '') : '',
          kode: hBulanDaftar !== -1 ? String(row[hBulanDaftar] || '') : '',
          hargaPaket: hHarga !== -1 ? parseFloat(String(row[hHarga]).replace(/[^0-9.-]/g, '')) || 0 : 0,
          dp: hDp !== -1 ? parseFloat(String(row[hDp]).replace(/[^0-9.-]/g, '')) || 0 : 0,
          angsuranBulan: hAngsuranBulan !== -1 ? parseFloat(String(row[hAngsuranBulan]).replace(/[^0-9.-]/g, '')) || 0 : 0,
          transaksi: {}, // YearMonth -> sum
          rincianTransaksi: [], // Full detail for modal
          totalKumulatif: 0,
          pendingMonths: {}
        };
      }
    }
    
    // Parse Angsuran
    const angsuranData = sheetAngsuran.getDataRange().getValues();
    const aHeaders = angsuranData[0].map(h => String(h || '').trim());
    
    const aNoBpih = aHeaders.findIndex(h => ['nobpih', 'bpih'].includes(jNorm(h)));
    const aJumlah = aHeaders.findIndex(h => ['jumlah', 'nominal'].includes(jNorm(h)));
    let aTanggal = aHeaders.findIndex(h => ['tanggal', 'tgl'].includes(jNorm(h)));
    if (aTanggal === -1) aTanggal = aHeaders.findIndex(h => ['timestamp', 'createdat'].includes(jNorm(h)));
    const aStatus = aHeaders.findIndex(h => ['status', 'statuspembayaran'].includes(jNorm(h)));
    
    for (let i = 1; i < angsuranData.length; i++) {
      const row = angsuranData[i];
      const noBpih = aNoBpih !== -1 ? String(row[aNoBpih] || '').trim() : '';
      
      // Jika transaksi ini milik salah satu jamaah Haji Terencana
      if (htJamaah[noBpih]) {
        let rawDate = aTanggal !== -1 ? row[aTanggal] : '';
        if (!rawDate) {
          const tsIdx = aHeaders.findIndex(h => ['timestamp'].includes(jNorm(h)));
          if (tsIdx !== -1 && row[tsIdx]) rawDate = row[tsIdx];
        }
        
        const jumlah = aJumlah !== -1 ? parseFloat(String(row[aJumlah]).replace(/[^0-9.-]/g, '')) || 0 : 0;
        const statusVal = aStatus !== -1 ? String(row[aStatus] || '').trim().toLowerCase() : '';
        
        let dateObj = null;
        if (rawDate instanceof Date) {
          dateObj = rawDate;
        } else if (typeof rawDate === 'string' && rawDate.trim() !== '') {
          // Handle string dates (e.g. YYYY-MM-DD or DD/MM/YYYY)
          const cleanDate = rawDate.trim().substring(0, 10); // Ambil 10 karakter pertama
          const parts = cleanDate.split(/[-/]/);
          if (parts.length === 3) {
            if (parts[0].length === 4) {
              // Format YYYY-MM-DD
              dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            } else {
              // Format DD/MM/YYYY atau DD-MM-YYYY
              dateObj = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
            }
          } else {
            dateObj = new Date(rawDate);
          }
        } else {
          dateObj = new Date(rawDate);
        }
        
        // Jika tidak valid, fallback ke tanggal hari ini agar data tetap muncul
        if (!dateObj || isNaN(dateObj.getTime())) {
           dateObj = new Date(); 
        }
        
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const ymKey = `${year}-${month}`; // format: YYYY-MM (misal: 2026-09)
        
        if (!htJamaah[noBpih].transaksi[ymKey]) {
          htJamaah[noBpih].transaksi[ymKey] = 0;
        }
        htJamaah[noBpih].transaksi[ymKey] += jumlah;
        htJamaah[noBpih].totalKumulatif += jumlah;
        
        if (statusVal === 'pending') {
          htJamaah[noBpih].pendingMonths[ymKey] = true;
        }
        
        // Detail full untuk PDF popup
        htJamaah[noBpih].rincianTransaksi.push({
          tanggal: dateObj.toISOString(),
          jumlah: jumlah,
          status: statusVal
        });
      }
    }
    
    // Convert ke array dan urutkan berdasarkan Kode (BulanPendaftaran)
    const resultArr = Object.values(htJamaah);
    resultArr.sort((a, b) => String(a.noPorsi).localeCompare(String(b.noPorsi)));
    
    // Kumpulkan semua keys (Bulan-Tahun) unik dari semua transaksi untuk men-generate kolom tabel dinamis
    const allYmKeys = new Set();
    resultArr.forEach(j => {
      Object.keys(j.transaksi).forEach(k => allYmKeys.add(k));
    });
    
    const sortedKeys = Array.from(allYmKeys).sort();
    let continuousYmKeys = [];
    
    if (sortedKeys.length > 0) {
      const minKey = sortedKeys[0];
      const maxKey = sortedKeys[sortedKeys.length - 1];
      
      let [currY, currM] = minKey.split('-').map(Number);
      const [maxY, maxM] = maxKey.split('-').map(Number);
      
      while (currY < maxY || (currY === maxY && currM <= maxM)) {
        continuousYmKeys.push(`${currY}-${String(currM).padStart(2, '0')}`);
        currM++;
        if (currM > 12) {
          currM = 1;
          currY++;
        }
      }
    }
    
    return {
      success: true,
      data: resultArr,
      ymKeys: continuousYmKeys
    };
    
  } catch (e) {
    Logger.log('Error getDashboardHTData: ' + e.message);
    return { success: false, message: e.message };
  }
}

// ============================================================================
// RPC WRAPPER UNTUK DIPANGGIL OLEH FRONTEND
// ============================================================================

function apiGetDashboardHTData(token) {
  return getDashboardHTData();
}
