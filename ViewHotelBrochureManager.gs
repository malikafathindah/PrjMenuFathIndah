/**
 * ============================================================================
 * VIEW HOTEL BROCHURE MANAGER (ViewHotelBrochureManager.gs)
 * ============================================================================
 * Backend khusus untuk modul mod_view_hotel_brochure
 */

function getHotelBrochureFilterOptions() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Hotel');
    if (!sheet) return { success: false, message: 'Sheet Hotel tidak ditemukan' };
    
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return { success: true, hotels: [], providers: [] };
    
    const hotelsSet = new Set();
    const providersSet = new Set();
    
    // Asumsi Header: 
    // Nama Hotel (index 1)
    // Provider (index 15)
    for (let i = 1; i < data.length; i++) {
      const namaHotel = String(data[i][1]).trim();
      const provider = String(data[i][15]).trim();
      
      if (namaHotel) hotelsSet.add(namaHotel);
      if (provider) providersSet.add(provider);
    }
    
    return {
      success: true,
      hotels: Array.from(hotelsSet).sort(),
      providers: Array.from(providersSet).sort()
    };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

function searchHotelBrochureData(filterPayload) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Hotel');
    if (!sheet) return { success: false, message: 'Sheet Hotel tidak ditemukan' };
    
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return { success: true, data: [] };
    
    const { namahotel, provider, startDate, endDate } = filterPayload;
    
    const startFilter = startDate ? new Date(startDate).setHours(0,0,0,0) : null;
    const endFilter = endDate ? new Date(endDate).setHours(23,59,59,999) : null;
    
    const results = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const h_id = row[0];
      const h_nama = String(row[1]).trim();
      const h_kota = String(row[2]).trim();
      const h_startRaw = row[3];
      const h_endRaw = row[4];
      const h_provider = String(row[15]).trim();
      const h_brochure = String(row[16]).trim();
      
      // Filter Nama Hotel
      if (namahotel && h_nama.toLowerCase().indexOf(namahotel.toLowerCase()) === -1) {
        continue;
      }
      
      // Filter Provider
      if (provider && h_provider.toLowerCase().indexOf(provider.toLowerCase()) === -1) {
        continue;
      }
      
      // Filter Tanggal Overlap
      let isDateMatch = true;
      if (startFilter || endFilter) {
        if (!h_startRaw || !h_endRaw) {
          isDateMatch = false; // kalau ada filter tanggal tapi data gk punya tgl
        } else {
          const rowStart = new Date(h_startRaw).setHours(0,0,0,0);
          const rowEnd = new Date(h_endRaw).setHours(23,59,59,999);
          
          if (startFilter && endFilter) {
            // Overlap check: rowStart <= endFilter AND rowEnd >= startFilter
            isDateMatch = (rowStart <= endFilter && rowEnd >= startFilter);
          } else if (startFilter) {
            isDateMatch = (rowEnd >= startFilter);
          } else if (endFilter) {
            isDateMatch = (rowStart <= endFilter);
          }
        }
      }
      
      if (!isDateMatch) continue;
      
      results.push({
        idhotel: h_id,
        namahotel: h_nama,
        kota: h_kota,
        tglawal: h_startRaw instanceof Date ? h_startRaw.toISOString() : h_startRaw,
        tglakhir: h_endRaw instanceof Date ? h_endRaw.toISOString() : h_endRaw,
        provider: h_provider,
        brochure: h_brochure,
        beli_dbl: row[5],
        beli_trpl: row[6],
        beli_quad: row[7],
        jual_dbl: row[8],
        jual_trpl: row[9],
        jual_quad: row[10],
        pax_dbl: row[11],
        pax_trpl: row[12],
        pax_quad: row[13],
        meal_plan: row[14]
      });
    }
    
    return { success: true, data: results };
  } catch (err) {
    return { success: false, message: err.message };
  }
}
