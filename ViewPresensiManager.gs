const PRESENSI_CONFIG = {
  USERS_SS_ID: '1VL8trcMIcZ6n5Be-2-9YwmC1pOsKliO_wbILmU_cC1s',
  ABSENSI_SS_ID: '1SboSRXp_AH6m0VIWQ5Gd3fCAwAtC5Ktl83rTpo8_NWI'
};

// 1. Fungsi Validasi Login (Jika masih digunakan secara standalone/khusus)
function checkLogin(userId, password, deviceInfo) {
  var ssUser = SpreadsheetApp.openById(PRESENSI_CONFIG.USERS_SS_ID);
  var sheetUser = ssUser.getSheetByName('Users');
  if (!sheetUser) return { success: false, message: 'Sheet Users tidak ditemukan!' };
  
  var data = sheetUser.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][1].toString().trim() === userId.toString().trim() && data[i][2].toString().trim() === password.toString().trim()) {
      var namaKaryawan = data[i][3]; // Kolom FullName
      catatLogLogin(userId, namaKaryawan, deviceInfo);
      return { success: true, userId: userId, nama: namaKaryawan };
    }
  }
  return { success: false, message: 'User ID atau Password salah!' };
}

// 2. Fungsi Simpan Absen Datang/Pulang beserta Koordinat GPS
function apiRecordAbsen(token, userId, nama, tipe, lat, lng) {
  var ss = SpreadsheetApp.openById(PRESENSI_CONFIG.ABSENSI_SS_ID);
  var sheet = ss.getSheetByName('Absensi');
  if (!sheet) {
    sheet = ss.insertSheet('Absensi');
    sheet.appendRow(["Timestamp", "Username", "FULLNAME", "Tipe Absen", "Latitude", "Longitude", "Maps URL", "Tanggal", "Status", "Bulan", "Tahun"]);
  }

  var timestamp = new Date();
  var tanggalHariIni = timestamp.getDate();
  var BulanHariIni = timestamp.getMonth() + 1;
  var TahunHariIni = timestamp.getFullYear();
  
  var statusHadir = "H";
  var mapsUrl = "";
  
  if (lat && lng && lat !== "Tidak terdeteksi" && lng !== "Tidak terdeteksi") {
    mapsUrl = "https://maps.google.com/?q=" + lat + "," + lng;
  } else {
    lat = "Tidak terdeteksi";
    lng = "Tidak terdeteksi";
    mapsUrl = "-";
  }

  sheet.appendRow([timestamp, userId, nama, tipe, lat, lng, mapsUrl, tanggalHariIni, statusHadir, BulanHariIni, TahunHariIni]);
  
  return { 
    success: true, 
    message: 'Absen ' + tipe + ' berhasil dicatat!', 
  };
}

// 3. Fungsi Simpan Laporan Tidak Masuk / Izin
function apiRecordIzin(token, userId, nama, alasan, lat, lng) {
  var ss = SpreadsheetApp.openById(PRESENSI_CONFIG.ABSENSI_SS_ID);
  var timestamp = new Date();
  
  var tanggalHariIni = timestamp.getDate();
  var BulanHariIni = timestamp.getMonth() + 1;
  var TahunHariIni = timestamp.getFullYear();
  
  // Status default (S = Sakit, I = Izin, C = Cuti, D = Perjalanan Dinas, L = Lain-lain)
  var statusHadir = alasan ? alasan.charAt(0).toUpperCase() : 'I';

  var mapsUrl = "-";
  var latVal = (lat !== undefined && lat !== null && lat !== "" && lat !== "Tidak terdeteksi") ? lat : "Tidak terdeteksi";
  var lngVal = (lng !== undefined && lng !== null && lng !== "" && lng !== "Tidak terdeteksi") ? lng : "Tidak terdeteksi";

  if (lat && lng && lat !== "Tidak terdeteksi" && lng !== "Tidak terdeteksi") {
    mapsUrl = "https://maps.google.com/?q=" + lat + "," + lng;
  }

  // --- A. PENCATATAN KE SHEET "Izin" ---
  var sheetIzin = ss.getSheetByName('Izin');
  if (!sheetIzin) {
    sheetIzin = ss.insertSheet('Izin');
    sheetIzin.appendRow(["Timestamp", "Username", "FULLNAME", "Alasan", "Tanggal", "Status", "Latitude", "Longitude", "Maps URL"]);
  }
  sheetIzin.appendRow([timestamp, userId, nama, alasan, tanggalHariIni, statusHadir, latVal, lngVal, mapsUrl]);

  // --- B. PENCATATAN OTOMATIS KE SHEET "Absensi" ---
  var sheetAbsen = ss.getSheetByName('Absensi');
  if (!sheetAbsen) {
    sheetAbsen = ss.insertSheet('Absensi');
    sheetAbsen.appendRow(["Timestamp", "Username", "FULLNAME", "Tipe Absen", "Latitude", "Longitude", "Maps URL", "Tanggal", "Status", "Bulan", "Tahun"]);
  }

  var tipeAbsen = "Izin (" + alasan + ")";

  // Struktur kolom disamakan persis dengan fungsi recordAbsen:
  sheetAbsen.appendRow([
    timestamp, 
    userId, 
    nama, 
    tipeAbsen, 
    latVal, 
    lngVal, 
    mapsUrl, 
    tanggalHariIni, 
    statusHadir, 
    BulanHariIni, 
    TahunHariIni
  ]);

  return { 
    success: true, 
    message: 'Laporan izin/tidak masuk berhasil dikirim dan dicatat di Absensi beserta lokasi GPS!', 
  };
}

// 4. Fungsi Ambil Riwayat Absensi Karyawan Berdasarkan User ID
function apiGetRiwayat(token, userId) {
  var ss = SpreadsheetApp.openById(PRESENSI_CONFIG.ABSENSI_SS_ID);
  var sheetAbsen = ss.getSheetByName('Absensi');
  if (!sheetAbsen) return [];
  var dataAbsen = sheetAbsen.getDataRange().getValues();
  var result = [];

  var now = new Date();
  var currentMonth = now.getMonth();
  var currentYear = now.getFullYear();

  for (var i = 1; i < dataAbsen.length; i++) {
    if (!dataAbsen[i][0]) continue;
    var rawDate = new Date(dataAbsen[i][0]);
    if (isNaN(rawDate.getTime())) continue;

    var rowUserId = dataAbsen[i][1] ? dataAbsen[i][1].toString().trim().toLowerCase() : "";
    var rowFullName = dataAbsen[i][2] ? dataAbsen[i][2].toString().trim().toLowerCase() : "";

    var target = userId.toString().trim().toLowerCase();
    if (target !== "" && (rowUserId === target || rowFullName === target || rowFullName.includes(target) || rowUserId.includes(target))) {
      if (rawDate.getMonth() === currentMonth && rawDate.getFullYear() === currentYear) {
        var dateFormatted = Utilities.formatDate(rawDate, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
        result.push({
          waktu: dateFormatted,
          tipe: dataAbsen[i][3] || "-",
          mapsUrl: dataAbsen[i][6] || "-"
        });
      }
    }
  }
  return result.reverse();
}

// 5. Fungsi mencatat log login ke worksheet "Log_Login"
function catatLogLogin(userId, nama, deviceInfo) {
  var ss = SpreadsheetApp.openById(PRESENSI_CONFIG.ABSENSI_SS_ID);
  var namaSheetLog = "Log_Login";
  var sheetLog = ss.getSheetByName(namaSheetLog);
  
  if (!sheetLog) {
    sheetLog = ss.insertSheet(namaSheetLog);
    sheetLog.appendRow(["Waktu Login", "Username", "FULLNAME", "Perangkat / Browser", "Keterangan"]);
  }
  
  var timestamp = new Date();
  sheetLog.appendRow([timestamp, userId, nama, deviceInfo, "Berhasil Login"]);
}

// 6. Mengambil Daftar Karyawan (Khusus Admin)
function apiGetAllKaryawan(token) {
  var ss = SpreadsheetApp.openById(PRESENSI_CONFIG.ABSENSI_SS_ID);
  var sheetUsers = ss.getSheetByName('Users');
  if (!sheetUsers) return [];
  
  var data = sheetUsers.getDataRange().getValues();
  if (data.length < 2) return [];
  
  var headers = data[0].map(h => h.toString().toLowerCase().trim());
  
  var idxNama = headers.indexOf('nama');
  if (idxNama === -1) idxNama = headers.indexOf('nama karyawan');
  if (idxNama === -1) idxNama = headers.indexOf('fullname');
  if (idxNama === -1) idxNama = 1; // Fallback ke kolom B
  
  var idxUsername = headers.indexOf('username');
  if (idxUsername === -1) idxUsername = headers.indexOf('id');
  if (idxUsername === -1) idxUsername = idxNama; // Fallback jika username tidak ada, gunakan nama
  
  var result = [];
  for (var i = 1; i < data.length; i++) {
    var uname = data[i][idxUsername];
    var nama = data[i][idxNama];
    if (uname && nama) {
      result.push({ username: uname.toString(), nama: nama.toString() });
    }
  }
  return result;
}

// 7. Menghapus Absensi (Khusus Admin)
function apiDeleteAbsen(token, userId, tanggal, bulan, tahun) {
  var ss = SpreadsheetApp.openById(PRESENSI_CONFIG.ABSENSI_SS_ID);
  var sheet = ss.getSheetByName('Absensi');
  if (!sheet) return { success: false, message: 'Sheet Absensi tidak ditemukan!' };
  
  var data = sheet.getDataRange().getValues();
  var deleted = 0;
  
  // Hapus baris dari bawah agar index tidak berantakan
  for (var i = data.length - 1; i > 0; i--) {
    var rawDate = new Date(data[i][0]);
    if (isNaN(rawDate.getTime())) continue;
    
    var rowUserId = data[i][1] ? data[i][1].toString().trim().toLowerCase() : "";
    var rowFullName = data[i][2] ? data[i][2].toString().trim().toLowerCase() : "";
    
    var target = userId.toString().trim().toLowerCase();
    if (target !== "" && (rowUserId === target || rowFullName === target || rowFullName.includes(target) || rowUserId.includes(target)) && 
        rawDate.getDate().toString() === tanggal.toString() &&
        (rawDate.getMonth() + 1).toString() === bulan.toString() &&
        rawDate.getFullYear().toString() === tahun.toString()) {
      sheet.deleteRow(i + 1);
      deleted++;
    }
  }
  
  // Bersihkan juga dari sheet Izin jika ada data yang nyangkut
  var sheetIzin = ss.getSheetByName('Izin');
  if (sheetIzin) {
    var dataIzin = sheetIzin.getDataRange().getValues();
    for (var j = dataIzin.length - 1; j > 0; j--) {
      var rawDateIzin = new Date(dataIzin[j][0]);
      if (isNaN(rawDateIzin.getTime())) continue;
      
      var rowUserIdIzin = dataIzin[j][1] ? dataIzin[j][1].toString().trim().toLowerCase() : "";
      var rowFullNameIzin = dataIzin[j][2] ? dataIzin[j][2].toString().trim().toLowerCase() : "";
      
      if ((rowUserIdIzin === target || rowFullNameIzin === target) && 
          rawDateIzin.getDate().toString() === tanggal.toString() &&
          (rawDateIzin.getMonth() + 1).toString() === bulan.toString() &&
          rawDateIzin.getFullYear().toString() === tahun.toString()) {
        sheetIzin.deleteRow(j + 1);
      }
    }
  }
  
  if (deleted > 0) {
    return { success: true, message: 'Berhasil menghapus data absen pada tanggal tersebut.' };
  } else {
    return { success: false, message: 'Data absen tidak ditemukan atau sudah terhapus.' };
  }
}
