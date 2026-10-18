/**
 * ============================================================================
 * HAJI INPUT MANAGER (HajiInputManager.gs)
 * ============================================================================
 * Backend Manager untuk modul mod_input_data_haji
 */

function setupHajiInputModule() {
  try {
    const db = getDb();
    if (!db) return;
    
    // Setup Module entry
    const moduleSheet = db.getSheetByName('Modules') || db.getSheetByName('MODULES');
    if (moduleSheet) {
      const data = moduleSheet.getDataRange().getValues();
      const headers = data[0].map(h => String(h || '').trim().toLowerCase().replace(/[^a-z0-9]/g, ''));
      const idColIdx = headers.findIndex(h => h === 'moduleid' || h === 'id');
      
      if (idColIdx !== -1) {
        const exists = data.some((row, r) => r > 0 && String(row[idColIdx] || '').trim().toLowerCase() === 'mod_input_data_haji');
        if (!exists) {
          moduleSheet.appendRow([
            'mod_input_data_haji',
            'Input Data Haji (SPPH)',
            'Haji',
            'Active',
            'fa-solid fa-address-card',
            'Admin,Manager,Staff',
            31,
            'Input data jamaah Haji sesuai form SPPH'
          ]);
        }
      }
    }

    // Ensure DataJamaahHaji sheet exists
    let sheetJamaah = db.getSheetByName('DataJamaahHaji');
    if (!sheetJamaah) {
      sheetJamaah = db.insertSheet('DataJamaahHaji');
    }
  } catch (e) {
    Logger.log('Error setupHajiInputModule: ' + e.message);
  }
}

function saveHajiInputData(formData) {
  try {
    const db = getDb();
    if (!db) return { success: false, message: 'Database tidak ditemukan' };
    
    setupHajiInputModule();
    
    const sheet = db.getSheetByName('DataJamaahHaji');
    if (!sheet) return { success: false, message: 'Sheet DataJamaahHaji tidak ditemukan' };
    
    let headers = [];
    if (sheet.getLastRow() === 0) {
      // Initialize basic headers if sheet is completely empty
      headers = [
        'Timestamp', 'Nomor SPPH', 'Nomor KTP', 'Nama Lengkap', 'Nama Ayah Kandung', 
        'Tempat Lahir', 'Tanggal Lahir', 'Umur', 'Jenis Kelamin', 'Kewarganegaraan', 
        'Alamat', 'RT', 'RW', 'Desa/Kelurahan', 'Kecamatan', 'Kabupaten/Kota', 
        'Provinsi', 'Kode Pos', 'No Telepon', 'Pendidikan', 'Pekerjaan', 'Pergi Haji', 
        'Nama Mahram', 'Hubungan Mahram', 'No Daftar Mahram', 'Golongan Darah', 
        'Status Perkawinan', 'Kode Diagnosis', 'Rambut', 'Alis', 'Hidung', 'Muka', 
        'Tinggi', 'Berat', 'Jenis Haji', 'Harga Paket', 'DP Angsuran', 'Angsuran Bulan', 'DownPayment', 'nomor rekening agent',
        'EstimasiBerangkat', 'TglEstimasi'
      ];
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#f3f4f6');
      sheet.setFrozenRows(1);
    } else {
      headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
    }
    
    // Map object to array based on headers
    const newRow = new Array(headers.length).fill('');
    
    // Convert property names in formData to match headers (case insensitive, ignoring non-alphanumeric)
    const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const headerMap = {};
    headers.forEach((h, i) => headerMap[norm(h)] = i);
    
    // Custom Mapping (Variable Form -> Header Sheet)
    const customMap = {
      'Nama Lengkap': 'Nama',
      'Nomor SPPH': 'NoSPPH',
      'No Telepon': 'NoHP',
      'Nama Mahram': 'Mahram',
      'Nomor KTP': 'NoKTP',
      'Nama Ayah Kandung': 'NamaOrtu',
      'Desa/Kelurahan': 'DesaKel',
      'Kabupaten/Kota': 'KabKota',
      'Provinsi': 'NmProvinsi',
      'Status Perkawinan': 'StatusNikah',
      'Hubungan Mahram': 'HubMahram',
      'No Daftar Mahram': 'NoDaftarMahram',
      'Golongan Darah': 'GolDarah',
      'Jenis Program Haji': 'JenisHaji',
      'Estimasi Keberangkatan': 'EstimasiBerangkat',
      'Tgl Pengecekkan': 'TglEstimasi'
    };
    
    // Format Timestamp yyyy-mm-dd hh:mm:ss
    formData.Timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
    formData.CreatedAt = formData.Timestamp;
    formData.StatusBPIH = 'C';
    
    // Cleanup temporary fields from frontend
    delete formData['Program Haji Dropdown'];
    delete formData['Tipe Kamar Dropdown'];
    
    // Generate BulanPendaftaran
    const j = String(formData['Jenis Program Haji'] || '').toLowerCase().trim();
    let prefix = 'HT';
    if (j.includes('setoran') || j.includes('awal') || j === 'sa') {
      prefix = 'SA';
    } else if (j.includes('pembiayaan') || j === 'pb') {
      prefix = 'PB';
    }
    const now = new Date();
    const monthStr = String(now.getMonth() + 1).padStart(2, '0');
    const yearStr = String(now.getFullYear());
    formData['BulanPendaftaran'] = prefix + monthStr + ' ' + yearStr;
    
    // Generate IDJamaah (JH-Tahun-UrutanBaris) if not provided
    let tahunID = new Date().getFullYear();
    if (formData['TglInput']) {
      tahunID = formData['TglInput'].substring(0, 4);
    }
    if (!formData['IDJamaah']) {
      formData['IDJamaah'] = 'JH-' + tahunID + '-' + String(sheet.getLastRow()).padStart(4, '0');
    }
    
    // Ensure default Jenis Haji if empty
    if (!formData['Jenis Program Haji']) formData['Jenis Program Haji'] = 'Haji Terencana';

    // Map provided data
    for (const key in formData) {
      let val = formData[key];
      if (typeof val === 'string') {
        if (key === 'DownPayment') {
          val = val.replace(/[^0-9]/g, '');
        } else if (['Harga USD', 'Diskon USD', 'Total Harga USD', 'Faedah USD', 'Harga Rupiah', 'Kurs Paket', 'Diskon Rupiah', 'Total Harga Rupiah', 'Faedah Rupiah'].includes(key)) {
          val = val.replace(/\./g, '');
        }
      }

      const targetHeader = customMap[key] ? customMap[key] : key;
      const normalizedKey = norm(targetHeader);
      
      if (headerMap.hasOwnProperty(normalizedKey)) {
        newRow[headerMap[normalizedKey]] = val;
      } else {
        headers.push(targetHeader);
        sheet.getRange(1, headers.length).setValue(targetHeader).setFontWeight('bold');
        headerMap[normalizedKey] = headers.length - 1;
        newRow[headers.length - 1] = val;
      }
    }
    
    // Check if IDJamaah exists for UPDATE
    let updated = false;
    const idJamaahColIndex = headerMap['idjamaah'];
    if (idJamaahColIndex !== undefined && sheet.getLastRow() > 1) {
      const existingData = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
      for (let i = 0; i < existingData.length; i++) {
        if (String(existingData[i][idJamaahColIndex]).trim() === String(formData['IDJamaah']).trim()) {
          // Merge old row with new row so we don't lose data not present in form
          const mergedRow = existingData[i].map((oldVal, idx) => {
             return newRow[idx] !== '' && newRow[idx] !== undefined ? newRow[idx] : oldVal;
          });
          sheet.getRange(i + 2, 1, 1, headers.length).setValues([mergedRow]);
          updated = true;
          break;
        }
      }
    }
    
    if (!updated) {
      sheet.appendRow(newRow);
    }
    
    return { 
      success: true, 
      message: updated ? 
        'Alhamdulillah! Perubahan data jamaah haji telah sukses disinkronkan ke dalam database.' : 
        'Alhamdulillah! Data pendaftaran jamaah haji baru telah sukses tersimpan dengan aman.' 
    };
    
  } catch (e) {
    Logger.log('Error saveHajiInputData: ' + e.message);
    return { success: false, message: 'Terjadi kesalahan sistem saat menyimpan data.' };
  }
}

function getHajiInputListData() {
  try {
    const db = getDb();
    const sheet = db.getSheetByName('DataJamaahHaji');
    if (!sheet || sheet.getLastRow() < 2) return [];
    
    const data = sheet.getDataRange().getDisplayValues();
    const headers = data[0].map(h => String(h || '').trim());
    
    const list = [];
    for (let r = 1; r < data.length; r++) {
      let obj = {};
      for (let c = 0; c < headers.length; c++) {
        obj[headers[c]] = data[r][c];
      }
      list.push(obj);
    }
    // Return latest first
    return list.reverse();
  } catch(e) {
    return [];
  }
}

function deleteHajiInputData(idJamaah) {
  try {
    const db = getDb();
    const sheet = db.getSheetByName('DataJamaahHaji');
    if (!sheet) return {success: false, message: 'Sheet tidak ditemukan'};
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h || '').trim().toLowerCase().replace(/[^a-z0-9]/g, ''));
    const idCol = headers.indexOf('idjamaah');
    const bpihCol = headers.indexOf('nobpih');
    const porsiCol = headers.indexOf('noporsi');
    const spphCol = headers.indexOf('nospph');
    const ktpCol = headers.indexOf('noktp');
    
    if (idCol === -1 && bpihCol === -1 && porsiCol === -1 && spphCol === -1 && ktpCol === -1) {
      return {success: false, message: 'Kolom referensi ID tidak ditemukan'};
    }
    
    for (let r = 1; r < data.length; r++) {
      const rowId = idCol > -1 ? String(data[r][idCol]).trim() : '';
      const rowBpih = bpihCol > -1 ? String(data[r][bpihCol]).trim() : '';
      const rowPorsi = porsiCol > -1 ? String(data[r][porsiCol]).trim() : '';
      const rowSpph = spphCol > -1 ? String(data[r][spphCol]).trim() : '';
      const rowKtp = ktpCol > -1 ? String(data[r][ktpCol]).trim() : '';
      
      const searchId = String(idJamaah).trim();
      
      if ((rowId && rowId === searchId) || 
          (rowBpih && rowBpih === searchId) || 
          (rowPorsi && rowPorsi === searchId) ||
          (rowSpph && rowSpph === searchId) ||
          (rowKtp && rowKtp === searchId)) {
        sheet.deleteRow(r + 1);
        return {success: true, message: 'Data Jamaah berhasil dihapus!'};
      }
    }
    return {success: false, message: 'ID Jamaah tidak ditemukan.'};
  } catch(e) {
    return {success: false, message: 'Gagal menghapus: ' + e.message};
  }
}

// ============================================================================
// RPC WRAPPER
// ============================================================================

function apiSaveHajiInputData(token, formData) {
  return saveHajiInputData(formData);
}

function apiGetHajiInputListData(token) {
  return getHajiInputListData();
}

function apiDeleteHajiInputData(token, idJamaah) {
  return deleteHajiInputData(idJamaah);
}

function extractSpphWithAI(text) {
  try {
    const result = {
      "NoBPIH": "",
      "Nomor KTP": "",
      "Nama Lengkap": "",
      "Nomor SPPH": "",
      "Tempat Lahir": ""
    };
    
    // 1. Nomor KTP: Cari 16 digit angka berurutan
    const ktpMatch = text.match(/\b\d{16}\b/);
    if (ktpMatch) result["Nomor KTP"] = ktpMatch[0];
    
    // 2. No BPIH (Nomor Porsi): Biasanya 10 digit, dicari di sekitar kata porsi atau bpih
    const bpihMatch = text.match(/(?:porsi|bpih)[\s\S]{0,30}?\b(\d{10})\b/i);
    if (bpihMatch) {
      result["NoBPIH"] = bpihMatch[1];
    } else {
      // Fallback: cari 10 digit angka saja jika kata porsi/bpih tidak terbaca sempurna
      const any10 = text.match(/\b\d{10}\b/);
      if (any10) result["NoBPIH"] = any10[0];
    }
    
    // 3. Nomor SPPH: Cari angka 5-15 digit di sekitar kata spph atau registrasi
    const spphMatch = text.match(/(?:spph|registrasi)[\s\S]{0,30}?\b(\d{5,15})\b/i);
    if (spphMatch) {
      result["Nomor SPPH"] = spphMatch[1];
    }
    
    // 4. Nama Lengkap: Ambil huruf setelah kata "Nama" atau "Nama Lengkap"
    const namaMatch = text.match(/nama\s*(?:lengkap)?\s*[:;\-]?\s*([A-Za-z\s\.,']{3,50})(?:\n|\r|$|tempat|nomor)/i);
    if (namaMatch) {
      result["Nama Lengkap"] = namaMatch[1].trim();
    }
    
    // 5. Tempat Lahir: Ambil huruf setelah kata Tempat Lahir atau Tempat/Tgl Lahir
    const lahirMatch = text.match(/tempat(?:[\s\/]*tgl\.?)?\s*lahir\s*[:;\-]?\s*([A-Za-z\s\-]{3,30})(?:[,/0-9]|\n|$)/i);
    if (lahirMatch) {
      result["Tempat Lahir"] = lahirMatch[1].trim();
    }

    // Bersihkan hasil (hapus properti yang kosong agar sesuai format sebelumnya)
    const cleanResult = {};
    for (const key in result) {
      if (result[key] && result[key].trim() !== "") {
        cleanResult[key] = result[key].trim();
      }
    }
    
    return { success: true, data: cleanResult };
  } catch (err) {
    Logger.log("Error extractSpphRegex: " + err.message);
    return { success: false, message: err.message };
  }
}

// ============================================================================
// FUNGSI UNTUK MEMANCING OTORISASI (JALANKAN SEKALI DARI EDITOR)
// ============================================================================
function forceAuthorize() {
  UrlFetchApp.fetch("https://google.com");
  // Baris-baris ini tidak melakukan apa-apa selain memancing Google meminta izin
  var tempDoc = DocumentApp.create("TestOtorisasi");
  DriveApp.getFileById(tempDoc.getId()).setTrashed(true);
  Logger.log("Otorisasi untuk Drive dan Document berhasil diberikan!");
}

// ============================================================================
// FUNGSI UNTUK MENGUBAH GAMBAR/PDF MENJADI TEKS DENGAN GOOGLE DRIVE OCR
// ============================================================================
function processDocumentWithDriveOCR(base64Data, mimeType, filename) {
  try {
    const boundary = "-------314159265358979323846";
    const delimiter = "\r\n--" + boundary + "\r\n";
    const closeDelimiter = "\r\n--" + boundary + "--";

    // Metadata untuk memaksa konversi ke Google Doc (OCR otomatis)
    const metadata = {
      name: filename,
      mimeType: "application/vnd.google-apps.document" 
    };

    const requestBody =
      delimiter +
      "Content-Type: application/json\r\n\r\n" +
      JSON.stringify(metadata) +
      delimiter +
      "Content-Type: " + mimeType + "\r\n" +
      "Content-Transfer-Encoding: base64\r\n\r\n" +
      base64Data +
      closeDelimiter;

    const options = {
      method: "post",
      contentType: "multipart/related; boundary=" + boundary,
      payload: requestBody,
      headers: {
        Authorization: "Bearer " + ScriptApp.getOAuthToken()
      },
      muteHttpExceptions: true
    };

    // Panggil Google Drive API v3
    const response = UrlFetchApp.fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", options);
    const json = JSON.parse(response.getContentText());

    if (json.error) {
      throw new Error(json.error.message);
    }

    const fileId = json.id;
    
    // Baca teks hasil OCR dari dokumen yang baru dibuat
    const doc = DocumentApp.openById(fileId);
    const text = doc.getBody().getText();
    
    // Hapus file sementara dari Google Drive (pindahkan ke sampah)
    DriveApp.getFileById(fileId).setTrashed(true);
    
    // Ekstrak data dari teks hasil OCR menggunakan Regex
    return extractSpphWithAI(text);
    
  } catch (err) {
    Logger.log("Error Drive OCR: " + err.message);
    return { success: false, message: "Gagal memproses dokumen: " + err.message };
  }
}
