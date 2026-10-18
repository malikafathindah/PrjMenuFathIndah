/**
 * ============================================================================
 * HOTEL RATE MATRIX DATA MANAGER & REGISTRY HANDLER (HotelManager.gs)
 * ============================================================================
 * Mengolah seluruh operasi CRUD database Google Sheets "Hotel" yang mendukung
 * entri Matriks Tarif Kontrak Hotel Multi-Periode.
 */

const HOTEL_CONFIG = {
  SHEET_NAME: 'Hotel',
  HEADERS: [
    'ID Hotel',
    'Nama Hotel',
    'Kota',
    'Tanggal Awal (From)',
    'Tanggal Akhir (To)',
    'Harga Beli Double (DBL)',
    'Harga Beli Triple (TRPL)',
    'Harga Beli Quad (QUAD)',
    'Harga Jual Double',
    'Harga Jual Triple',
    'Harga Jual Quad',
    'Harga Jual Per Jamah Double',
    'Harga Jual Per Jamah Triple',
    'Harga Jual Per Jamah Quad',
    'Meal Plan',
    'Provider',
    'Brochure',
    'Tanggal Input',
    'CreatedAt',
    'User Input',
    'Jarak',
    'Google Maps'
  ]
};

/**
 * Memastikan seluruh header konfigurasi ada di baris 1 Sheet tanpa merusak kolom yang sudah ada
 */
function ensureHotelSheetHeaders_(sheet) {
  try {
    const lastCol = sheet.getLastColumn();
    if (lastCol <= 0) {
      sheet.appendRow(HOTEL_CONFIG.HEADERS);
      return;
    }
    const currentHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h || '').trim());
    const missingHeaders = HOTEL_CONFIG.HEADERS.filter(h => !currentHeaders.includes(h));
    if (missingHeaders.length > 0) {
      sheet.getRange(1, lastCol + 1, 1, missingHeaders.length).setValues([missingHeaders]);
    }
  } catch (err) {
    Logger.log('ensureHotelSheetHeaders_ error: ' + err.message);
  }
}

/**
 * Menyiapkan sheet "Hotel" jika belum ada
 */
function setupHotelSheet() {
  try {
    const ss = getDb();
    let sheet = ss.getSheetByName(HOTEL_CONFIG.SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(HOTEL_CONFIG.SHEET_NAME);
      sheet.appendRow(HOTEL_CONFIG.HEADERS);
    } else {
      ensureHotelSheetHeaders_(sheet);
    }
    return sheet;
  } catch (e) {
    Logger.log('Error setupHotelSheet: ' + e.message);
    const ss = getDb();
    let sheet = ss.getSheetByName(HOTEL_CONFIG.SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(HOTEL_CONFIG.SHEET_NAME);
      sheet.appendRow(HOTEL_CONFIG.HEADERS);
    } else {
      ensureHotelSheetHeaders_(sheet);
    }
    return sheet;
  }
}

function normalizeSheetDateValue(val) {
  if (!val) return '';
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '';
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  let str = String(val).trim();
  if (str.includes('T')) {
    str = str.split('T')[0];
  }
  return str;
}

/**
 * Mengambil semua daftar data hotel & periode tarif dari Sheet "Hotel",
 * lalu dikelompokkan berdasarkan ID Hotel / Nama Hotel.
 */
function getHotelList() {
  try {
    setupHotelSheet();
    const rows = getSheetData(HOTEL_CONFIG.SHEET_NAME);
    
    if (!rows || rows.length === 0) return [];
    
    // Grouping berdasarkan ID Hotel
    const hotelGroupMap = {};
    
    rows.forEach(r => {
      const idHotel = String(r['ID Hotel'] || r.idhotel || '').trim();
      const namaHotel = String(r['Nama Hotel'] || r.namahotel || '').trim();
      if (!idHotel && !namaHotel) return;

      const groupKey = idHotel || namaHotel;
      const brochureVal = String(r['Brochure'] || r['Link Brochure'] || r.brochure || r.linkbrochure || '').trim();
      const jarakVal = String(r['Jarak'] || r['Jarak Hotel'] || r.jarak || '').trim();
      const googleMapsVal = String(r['Google Maps'] || r['Link Google Maps'] || r.googlemaps || r['Maps'] || '').trim();

      if (!hotelGroupMap[groupKey]) {
        hotelGroupMap[groupKey] = {
          idhotel: groupKey,
          namahotel: namaHotel || groupKey,
          kota: String(r['Kota'] || r.kota || 'Makkah').trim(),
          provider: String(r['Provider'] || r.provider || '').trim(),
          brochure: brochureVal,
          jarak: jarakVal,
          googleMaps: googleMapsVal,
          tglinput: normalizeSheetDateValue(r['Tanggal Input'] || r.tglinput),
          createdAt: String(r['CreatedAt'] || r.created_at || '').trim(),
          userInput: String(r['User Input'] || r.userInput || r.user_input || r.user || r['User'] || '').trim(),
          ratePeriods: []
        };
      } else {
        if (!hotelGroupMap[groupKey].brochure && brochureVal) {
          hotelGroupMap[groupKey].brochure = brochureVal;
        }
        if (!hotelGroupMap[groupKey].jarak && jarakVal) {
          hotelGroupMap[groupKey].jarak = jarakVal;
        }
        if (!hotelGroupMap[groupKey].googleMaps && googleMapsVal) {
          hotelGroupMap[groupKey].googleMaps = googleMapsVal;
        }
      }

      const hrgDbl = Number(r['Harga Beli Double (DBL)'] || r['Harga Beli Double'] || r.hargadouble || 0);
      const hrgTrpl = Number(r['Harga Beli Triple (TRPL)'] || r['Harga Beli Triple'] || r.hargatriple || 0);
      const hrgQuad = Number(r['Harga Beli Quad (QUAD)'] || r['Harga Beli Quad'] || r.hargaquod || 0);

      const dblSell = Number(r['Harga Jual Double'] || r.hrgjualdouble || (hrgDbl > 0 ? hrgDbl + 10 : 0));
      const trplSell = Number(r['Harga Jual Triple'] || r.hrgjualtriple || (hrgTrpl > 0 ? hrgTrpl + 10 : 0));
      const quadSell = Number(r['Harga Jual Quad'] || r.hrgjualquod || (hrgQuad > 0 ? hrgQuad + 10 : 0));

      const dblPerPax = Number(r['Harga Jual Per Jamah Double'] || r.hrgperpaxdouble || (dblSell > 0 ? Number((dblSell / 2).toFixed(2)) : 0));
      const trplPerPax = Number(r['Harga Jual Per Jamah Triple'] || r.hrgperpaxtriple || (trplSell > 0 ? Number((trplSell / 3).toFixed(2)) : 0));
      const quadPerPax = Number(r['Harga Jual Per Jamah Quad'] || r.hrgperpaxquod || (quadSell > 0 ? Number((quadSell / 4).toFixed(2)) : 0));

      // Tambahkan baris periode rate
      hotelGroupMap[groupKey].ratePeriods.push({
        tglawal: normalizeSheetDateValue(r['Tanggal Awal (From)'] || r.tglawal),
        tglakhir: normalizeSheetDateValue(r['Tanggal Akhir (To)'] || r.tglakhir),
        hargadouble: hrgDbl,
        hargatriple: hrgTrpl,
        hargaquod: hrgQuad,
        hrgjualdouble: dblSell,
        hrgjualtriple: trplSell,
        hrgjualquod: quadSell,
        hrgperpaxdouble: dblPerPax,
        hrgperpaxtriple: trplPerPax,
        hrgperpaxquod: quadPerPax,
        meal_plan: String(r['Meal Plan'] || r.meal_plan || 'F.B Fareast').trim(),
        brochure: String(r['Brochure'] || r['Link Brochure'] || r.brochure || r.linkbrochure || '').trim()
      });
    });

    return Object.values(hotelGroupMap);
  } catch (e) {
    Logger.log('Error getHotelList: ' + e.message);
    return [];
  }
}

/**
 * Menyimpan data hotel lengkap beserta seluruh baris periode tarifnya (batch rate periods)
 * @param {Object} hotelPayload Object { idhotel, namahotel, kota, provider, brochure, ratePeriods: [...] }
 * @param {Object} filePayloadBrochure Object { base64Data, mimeType, fileName }
 */
function saveHotelRecordBatch(hotelPayload, filePayloadBrochure) {
  try {
    if (!hotelPayload || !hotelPayload.namahotel) {
      return { success: false, message: 'Nama Hotel wajib diisi!' };
    }

    let brochureUrl = hotelPayload.brochure || '';
    if (filePayloadBrochure && filePayloadBrochure.base64Data) {
      try {
        const FOLDER_ID = '1ZuLBYHRPFYWJY9uemmpt8EZ0f-r9Alt3';
        const folder = DriveApp.getFolderById(FOLDER_ID);
        const fileNameOriginal = filePayloadBrochure.fileName || 'brochure.pdf';
        let ext = '.pdf';
        if (fileNameOriginal.includes('.')) {
          ext = '.' + fileNameOriginal.split('.').pop();
        } else if (filePayloadBrochure.mimeType) {
          ext = filePayloadBrochure.mimeType.includes('image') ? '.jpg' : '.pdf';
        }
        const timestamp = new Date().getTime();
        const namaHotelStr = String(hotelPayload.namahotel).replace(/[^a-zA-Z0-9 ]/g, '_');
        const newFileName = `Brochure_${namaHotelStr}_${timestamp}${ext}`;

        const blob = Utilities.newBlob(
          Utilities.base64Decode(filePayloadBrochure.base64Data),
          filePayloadBrochure.mimeType || MimeType.PDF,
          newFileName
        );
        const newFile = folder.createFile(blob);
        brochureUrl = newFile.getUrl();
        hotelPayload.brochure = brochureUrl;
        
        try {
          newFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        } catch (shareErr) {
          Logger.log('Warning: Tidak dapat set sharing public (mungkin policy workspace): ' + shareErr.message);
        }

        if (hotelPayload.ratePeriods && hotelPayload.ratePeriods.length > 0) {
          hotelPayload.ratePeriods.forEach(p => {
            p.brochure = brochureUrl;
          });
        }
      } catch (errUp) {
        return { success: false, message: 'Gagal upload brochure hotel: ' + errUp.message };
      }
    }

    const sheet = setupHotelSheet();
    const data = sheet.getDataRange().getValues();
    
    // Auto Generate ID jika belum ada
    let idHotel = String(hotelPayload.idhotel || '').trim();
    if (!idHotel) {
      const nextNum = Math.max(Object.keys(data).length, 1);
      idHotel = 'HTL-' + String(nextNum).padStart(3, '0');
    }

    // 1. Hapus seluruh baris lama dengan idHotel tersebut (jika update)
    if (data.length > 1) {
      for (let i = data.length - 1; i >= 1; i--) {
        if (String(data[i][0]).trim().toLowerCase() === idHotel.toLowerCase()) {
          sheet.deleteRow(i + 1);
        }
      }
    }

    const nowStr = getJakartaTimeString();
    const tglInput = hotelPayload.tglinput || nowStr.split(' ')[0];
    const defaultMargin = Number(hotelPayload.defaultMargin) || 10;
    const userInput = String(hotelPayload.userInput || hotelPayload.user || hotelPayload.username || 'Admin').trim();

    const ratePeriods = (hotelPayload.ratePeriods && hotelPayload.ratePeriods.length > 0) 
      ? hotelPayload.ratePeriods 
      : [{
          tglawal: hotelPayload.tglawal || '',
          tglakhir: hotelPayload.tglakhir || '',
          hargadouble: Number(hotelPayload.hargadouble || 0),
          hargatriple: Number(hotelPayload.hargatriple || 0),
          hargaquod: Number(hotelPayload.hargaquod || 0),
          meal_plan: hotelPayload.meal_plan || 'F.B Fareast',
          brochure: hotelPayload.brochure || ''
        }];

    const sheetHeaders = sheet.getLastColumn() > 0
      ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h || '').trim())
      : HOTEL_CONFIG.HEADERS;

    // 2. Append seluruh baris periode rate baru beserta perhitungan Harga Jual & Harga Per Jamah
    const rowsToAppend = ratePeriods.map(p => {
      const hrgDbl = Number(p.hargadouble || 0);
      const hrgTrpl = Number(p.hargatriple || 0);
      const hrgQuad = Number(p.hargaquod || 0);

      const dblSell = Number(p.hrgjualdouble) || (hrgDbl > 0 ? hrgDbl + defaultMargin : 0);
      const trplSell = Number(p.hrgjualtriple) || (hrgTrpl > 0 ? hrgTrpl + defaultMargin : 0);
      const quadSell = Number(p.hrgjualquod) || (hrgQuad > 0 ? hrgQuad + defaultMargin : 0);

      const dblPerPax = dblSell > 0 ? Number((dblSell / 2).toFixed(2)) : 0;
      const trplPerPax = trplSell > 0 ? Number((trplSell / 3).toFixed(2)) : 0;
      const quadPerPax = quadSell > 0 ? Number((quadSell / 4).toFixed(2)) : 0;

      const rowMap = {
        'ID Hotel': idHotel,
        'Nama Hotel': hotelPayload.namahotel,
        'Kota': hotelPayload.kota || 'Makkah',
        'Tanggal Awal (From)': p.tglawal || '',
        'Tanggal Akhir (To)': p.tglakhir || '',
        'Harga Beli Double (DBL)': hrgDbl,
        'Harga Beli Triple (TRPL)': hrgTrpl,
        'Harga Beli Quad (QUAD)': hrgQuad,
        'Harga Jual Double': dblSell,
        'Harga Jual Triple': trplSell,
        'Harga Jual Quad': quadSell,
        'Harga Jual Per Jamah Double': dblPerPax,
        'Harga Jual Per Jamah Triple': trplPerPax,
        'Harga Jual Per Jamah Quad': quadPerPax,
        'Meal Plan': p.meal_plan || 'F.B Fareast',
        'Provider': hotelPayload.provider || '',
        'Brochure': p.brochure || hotelPayload.brochure || '',
        'Tanggal Input': tglInput,
        'CreatedAt': nowStr,
        'User Input': userInput,
        'Jarak': hotelPayload.jarak || '',
        'Google Maps': hotelPayload.googleMaps || ''
      };

      return sheetHeaders.map(col => rowMap.hasOwnProperty(col) ? rowMap[col] : '');
    });

    rowsToAppend.forEach(row => sheet.appendRow(row));

    return { 
      success: true, 
      message: 'Data Hotel ' + hotelPayload.namahotel + ' (' + ratePeriods.length + ' periode tarif) berhasil disimpan!', 
      idhotel: idHotel 
    };

  } catch (e) {
    Logger.log('Error saveHotelRecordBatch: ' + e.message);
    return { success: false, message: 'Gagal menyimpan data hotel: ' + e.message };
  }
}

/**
 * Menghapus seluruh baris data hotel berdasarkan ID Hotel
 * @param {string} idHotel 
 */
function deleteHotelRecord(idHotel) {
  try {
    if (!idHotel) return { success: false, message: 'ID Hotel tidak valid!' };
    
    const sheet = setupHotelSheet();
    const data = sheet.getDataRange().getValues();
    let deletedCount = 0;
    
    for (let i = data.length - 1; i >= 1; i--) {
      if (String(data[i][0]).trim().toLowerCase() === String(idHotel).trim().toLowerCase()) {
        sheet.deleteRow(i + 1);
        deletedCount++;
      }
    }
    
    if (deletedCount > 0) {
      return { success: true, message: 'Data Hotel ID ' + idHotel + ' berhasil dihapus!' };
    }
    
    return { success: false, message: 'Data Hotel ID ' + idHotel + ' tidak ditemukan!' };
  } catch (e) {
    Logger.log('Error deleteHotelRecord: ' + e.message);
    return { success: false, message: 'Gagal menghapus data hotel: ' + e.message };
  }
}

/**
 * Mengambil daftar file brochure (PDF / Gambar) dari Folder Google Drive
 * Target Folder ID: 1ZuLBYHRPFYWJY9uemmpt8EZ0f-r9Alt3
 */
function getDriveBrochureFiles() {
  try {
    const FOLDER_ID = '1ZuLBYHRPFYWJY9uemmpt8EZ0f-r9Alt3';
    let folder;
    try {
      folder = DriveApp.getFolderById(FOLDER_ID);
    } catch (eFolder) {
      Logger.log('Error access drive folder: ' + eFolder.message);
      return { 
        success: false, 
        message: 'Folder Google Drive tidak ditemukan atau ID salah (ID: ' + FOLDER_ID + '): ' + eFolder.toString(), 
        files: [] 
      };
    }

    const filesIter = folder.getFiles();
    const fileList = [];

    while (filesIter.hasNext()) {
      const file = filesIter.next();
      const mimeType = String(file.getMimeType() || '').toLowerCase();
      const fileName = String(file.getName() || '');
      const fileId = file.getId();
      const url = 'https://drive.google.com/file/d/' + fileId + '/view';

      const isPdf = mimeType.includes('pdf') || fileName.toLowerCase().endsWith('.pdf');
      const isImage = mimeType.includes('image') || /\.(png|jpe?g|webp|gif|bmp)$/i.test(fileName);

      const lastUpdatedDate = file.getLastUpdated();
      const updatedAtRaw = lastUpdatedDate ? lastUpdatedDate.getTime() : 0;
      let updatedAtStr = '';
      if (lastUpdatedDate && !isNaN(lastUpdatedDate.getTime())) {
        const y = lastUpdatedDate.getFullYear();
        const m = String(lastUpdatedDate.getMonth() + 1).padStart(2, '0');
        const d = String(lastUpdatedDate.getDate()).padStart(2, '0');
        const hh = String(lastUpdatedDate.getHours()).padStart(2, '0');
        const mm = String(lastUpdatedDate.getMinutes()).padStart(2, '0');
        updatedAtStr = `${y}-${m}-${d} ${hh}:${mm}`;
      }

      fileList.push({
        id: fileId,
        name: fileName,
        url: url,
        mimeType: mimeType,
        isPdf: isPdf,
        isImage: isImage,
        updatedAt: updatedAtStr,
        updatedAtRaw: updatedAtRaw
      });
    }

    // Urutkan berdasarkan tanggal & jam terbaru (descending)
    fileList.sort((a, b) => (b.updatedAtRaw || 0) - (a.updatedAtRaw || 0));

    return { success: true, files: fileList };
  } catch (err) {
    Logger.log('Error getDriveBrochureFiles: ' + err.message);
    return { success: false, message: 'Gagal membaca folder Drive brochure: ' + err.message, files: [] };
  }
}
