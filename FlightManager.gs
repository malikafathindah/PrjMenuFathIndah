/**
 * ============================================================================
 * FLIGHT MANAGER (FlightManager.gs)
 * ============================================================================
 * Mengelola penyimpanan, pemanggilan, dan penghapusan data penerbangan & block seat
 * ke/dari Google Sheets "Penerbangan".
 */

const FLIGHT_CONFIG = {
  SHEET_NAME: 'Penerbangan',
  HEADERS: [
    'ID Flight',
    'PNR Code',
    'Maskapai',
    'Tipe Penerbangan',
    'Jenis Layanan',
    'No Flight Out',
    'Origin Out',
    'Transit Out',
    'Dest Out',
    'ETD Out',
    'ETA Out',
    'No Flight In',
    'Origin In',
    'Transit In',
    'Dest In',
    'ETD In',
    'ETA In',
    'Block Seat Total',
    'Harga Beli Ticket',
    'Free Bagasi',
    'Air Zamzam',
    'Status Seat',
    'Catatan',
    'CreatedAt',
    'UserInput'
  ]
};

/**
 * Menyiapkan sheet "Penerbangan" jika belum ada
 */
function setupFlightSheet() {
  try {
    const ss = getDb();
    let sheet = ss.getSheetByName(FLIGHT_CONFIG.SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(FLIGHT_CONFIG.SHEET_NAME);
      sheet.appendRow(FLIGHT_CONFIG.HEADERS);
    } else {
      const lastCol = sheet.getLastColumn();
      if (lastCol > 0) {
        const currentHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
        if (currentHeaders.length < FLIGHT_CONFIG.HEADERS.length) {
          sheet.getRange(1, 1, 1, FLIGHT_CONFIG.HEADERS.length).setValues([FLIGHT_CONFIG.HEADERS]);
        }
      }
    }
    return sheet;
  } catch (e) {
    Logger.log('Error setupFlightSheet: ' + e.message);
    throw e;
  }
}

/**
 * Menyimpan data penerbangan baru atau memperbarui penerbangan lama
 * @param {Object} data Objek data penerbangan dari frontend
 */
function saveFlightData(data) {
  try {
    if (!data || !data.pnrCode || !data.maskapai) {
      return { success: false, message: 'Kode PNR dan Maskapai Penerbangan wajib diisi!' };
    }

    const sheet = setupFlightSheet();
    const now = new Date();
    const timestampStr = Utilities.formatDate(now, Session.getScriptTimeZone() || 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss');
    const id = data.idflight || ('FL-' + Utilities.formatDate(now, Session.getScriptTimeZone() || 'Asia/Jakarta', 'yyyyMMdd-HHmmss'));
    const userEmail = Session.getActiveUser().getEmail() || data.userInput || 'admin';

    const rowData = [
      id,
      data.pnrCode,
      data.maskapai,
      data.tipePenerbangan || 'Direct',
      data.jenisLayanan || 'Reguler',
      data.noFlightOut || '',
      data.originOut || 'CGK',
      data.transitOut || '',
      data.destOut || 'MED',
      data.etdOut || '',
      data.etaOut || '',
      data.noFlightIn || '',
      data.originIn || 'JED',
      data.transitIn || '',
      data.destIn || 'CGK',
      data.etdIn || '',
      data.etaIn || '',
      Number(data.blockSeatTotal || 45),
      Number(data.hargaBeliTicket || 0),
      data.freeBagasi || '30 Kg Bagasi + 7 Kg Kabin',
      data.airZamzam || 'Free 5 Liter',
      data.statusSeat || 'Available',
      data.catatan || '',
      timestampStr,
      userEmail
    ];

    const rows = sheet.getDataRange().getValues();
    let existingRowIndex = -1;

    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0]).trim() === String(id).trim() || String(rows[i][1]).trim() === String(data.pnrCode).trim()) {
        existingRowIndex = i + 1;
        break;
      }
    }

    if (existingRowIndex > 0) {
      sheet.getRange(existingRowIndex, 1, 1, rowData.length).setValues([rowData]);
      return { success: true, message: 'Data penerbangan ' + data.pnrCode + ' berhasil diperbarui!', id: id };
    } else {
      sheet.appendRow(rowData);
      return { success: true, message: 'Data penerbangan baru ' + data.pnrCode + ' berhasil disimpan!', id: id };
    }
  } catch (e) {
    Logger.log('Error saveFlightData: ' + e.message);
    return { success: false, message: 'Terjadi kesalahan server: ' + e.message };
  }
}

/**
 * Mengambil seluruh daftar master penerbangan
 */
function getFlightList() {
  try {
    const sheet = setupFlightSheet();
    const rows = sheet.getDataRange().getValues();

    if (rows.length <= 1) {
      return { success: true, data: [] };
    }

    const list = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r[0]) continue;

      list.push({
        idflight: String(r[0]),
        pnrCode: String(r[1]),
        maskapai: String(r[2]),
        tipePenerbangan: String(r[3] || 'Direct'),
        jenisLayanan: String(r[4] || 'Reguler'),
        noFlightOut: String(r[5] || ''),
        originOut: String(r[6] || 'CGK'),
        transitOut: String(r[7] || ''),
        destOut: String(r[8] || 'MED'),
        etdOut: String(r[9] || ''),
        etaOut: String(r[10] || ''),
        noFlightIn: String(r[11] || ''),
        originIn: String(r[12] || 'JED'),
        transitIn: String(r[13] || ''),
        destIn: String(r[14] || 'CGK'),
        etdIn: String(r[15] || ''),
        etaIn: String(r[16] || ''),
        blockSeatTotal: Number(r[17] || 45),
        hargaBeliTicket: Number(r[18] || 0),
        freeBagasi: String(r[19] || ''),
        airZamzam: String(r[20] || 'Free 5 Liter'),
        statusSeat: String(r[21] || 'Available'),
        catatan: String(r[22] || ''),
        createdAt: String(r[23] || ''),
        userInput: String(r[24] || '')
      });
    }

    return { success: true, data: list };
  } catch (e) {
    Logger.log('Error getFlightList: ' + e.message);
    return { success: false, message: 'Gagal mengambil data penerbangan: ' + e.message, data: [] };
  }
}

/**
 * Menghapus entri penerbangan dari sheet
 * @param {string} idflight ID penerbangan
 */
function deleteFlightData(idflight) {
  try {
    const sheet = setupFlightSheet();
    const rows = sheet.getDataRange().getValues();

    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0]).trim() === String(idflight).trim()) {
        sheet.deleteRow(i + 1);
        return { success: true, message: 'Data penerbangan berhasil dihapus!' };
      }
    }
    return { success: false, message: 'Data penerbangan tidak ditemukan.' };
  } catch (e) {
    Logger.log('Error deleteFlightData: ' + e.message);
    return { success: false, message: 'Terjadi kesalahan: ' + e.message };
  }
}
