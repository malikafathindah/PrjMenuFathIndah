/**
 * ============================================================================
 * GEOLOCATION & AUDIT TRAIL HANDLER (GeoAudit.gs)
 * ============================================================================
 * Mengamankan sistem dengan mencatat alamat IP, perkiraan lokasi geografis,
 * dan seluruh aktivitas pengguna secara otomatis ke Sheet "ActivityLogs".
 */

/**
 * Mengambil Informasi IP & Geolokasi Publik beserta Koordinat Google Maps
 * @param {string} optionalIp IP khusus jika dikirim dari client
 * @param {object} clientMeta Metadata client termasuk koordinat GPS (lat, lng)
 */
function getGeoInfo(optionalIp = '', clientMeta = {}) {
  // Sesuai permintaan: Fitur pencarian Lokasi, IP Address, dan Google Maps dinonaktifkan
  // Hal ini bertujuan agar proses (seperti Login) menjadi sangat cepat dan tidak perlu 
  // menunggu respons dari API eksternal.
  return {
    ip: '-',
    location: '-',
    isp: '-',
    lat: null,
    lon: null,
    mapsUrl: '-',
    fullLocationString: '-'
  };
}

/**
 * Mencatat aktivitas pengguna ke sheet "ActivityLogs"
 * @param {string} username Username pelaku
 * @param {string} action Jenis aksi (misal: LOGIN, LOGOUT, CREATE_USER, ACCESS_MODULE)
 * @param {string} module ID Modul atau Nama Fitur
 * @param {string} details Catatan tambahan
 * @param {object} clientMeta Metadata opsional dari client (misal: client IP, lat, lng)
 */
function logActivity(username, action, module, details = '', clientMeta = {}) {
  try {
    const clientIp = clientMeta.ip || '';
    const geoInfo = getGeoInfo(clientIp, clientMeta);

    const logId = 'LOG-' + new Date().getTime().toString(36).toUpperCase();
    const timestamp = getJakartaTimeString();

    const logEntry = {
      LogID: logId,
      Timestamp: timestamp,
      Username: username || 'GUEST',
      IP_Address: geoInfo.ip,
      Location: geoInfo.location || 'Indonesia',
      Maps_URL: geoInfo.mapsUrl || ('https://www.google.com/maps?q=' + encodeURIComponent(geoInfo.location || 'Jakarta, Indonesia')),
      Action: action + (details ? ' (' + details + ')' : ''),
      Module: module || 'System'
    };

    insertRow(CONFIG.SHEETS.ACTIVITY_LOGS, logEntry);
    return logEntry;
  } catch (err) {
    Logger.log('Error saat menulis Activity Log: ' + err.toString());
  }
}
