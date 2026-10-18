/**
 * ============================================================================
 * CUTI MANAGER & LEAVE HANDLER (CutiManager.gs)
 * ============================================================================
 * Modul backend untuk mengelola:
 * 1. Sheet CutiKaryawan (Permohonan & Approval Cuti Karyawan)
 * 2. Sheet CutiBersama (Pengaturan Hari Libur & Cuti Bersama per Tahun)
 * 3. Integrasi data karyawan dari Sheet "Bio Karyawan"
 * 4. Kalkulasi sisa kuota cuti tahunan berbasis Cuti Bersama yang memotong kuota
 */

/**
 * Memastikan Sheet CutiKaryawan dan CutiBersama siap digunakan
 */
function setupCutiSheets() {
  const db = getDb();
  if (!db) return;

  // 1. Inisialisasi Sheet CutiKaryawan
  const cutiHeaders = [
    'CutiID', 'TanggalPengajuan', 'NIK', 'NamaKaryawan', 'Jabatan', 
    'TipeCuti', 'TanggalMulai', 'TanggalSelesai', 'JumlahHari', 'Keterangan', 
    'LinkDokumen', 'StatusApproval', 'ApprovedBy', 'ApprovedAt', 'CatatanApproval', 'CreatedAt'
  ];
  const cutiSheet = getOrCreateSheet(CONFIG.SHEETS.CUTI_KARYAWAN || 'CutiKaryawan', cutiHeaders);

  // Pastikan header 'LinkDokumen' otomatis ditambahkan di baris 1 Sheet CutiKaryawan jika belum ada
  if (cutiSheet && cutiSheet.getLastColumn() > 0) {
    const lastCol = cutiSheet.getLastColumn();
    const headers = cutiSheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h).trim());
    const hasLinkDokumen = headers.some(h => ['linkdokumen', 'link dokumen', 'suratpermohonan', 'link', 'dokumen'].includes(h.toLowerCase()));
    
    if (!hasLinkDokumen) {
      cutiSheet.getRange(1, lastCol + 1).setValue('LinkDokumen');
      const headerCell = cutiSheet.getRange(1, lastCol + 1);
      headerCell.setBackground('#1e293b');
      headerCell.setFontColor('#ffffff');
      headerCell.setFontWeight('bold');
    }
  }

  // 2. Inisialisasi Sheet CutiBersama
  const bersamaHeaders = [
    'ID', 'Tahun', 'Tanggal', 'NamaHariLibur', 'JumlahHari', 
    'PotongCutiTahunan', 'Status', 'Keterangan', 'CreatedAt'
  ];
  const bersamaSheet = getOrCreateSheet(CONFIG.SHEETS.CUTI_BERSAMA || 'CutiBersama', bersamaHeaders);

  // Seeder data default Cuti Bersama tahun 2026 jika sheet masih kosong
  const existingBersama = getSheetData(CONFIG.SHEETS.CUTI_BERSAMA || 'CutiBersama');
  if (!existingBersama || existingBersama.length === 0) {
    const defaultData = [
      ['CB-2026-001', '2026', '2026-03-31', 'Cuti Bersama Hari Raya Idul Fitri 1447 H', 2, 'Ya', 'Aktif', 'Cuti Bersama Idul Fitri', getJakartaTimeString()],
      ['CB-2026-002', '2026', '2026-05-26', 'Cuti Bersama Waisak', 1, 'Ya', 'Aktif', 'Cuti Bersama Waisak', getJakartaTimeString()],
      ['CB-2026-003', '2026', '2026-12-24', 'Cuti Bersama Hari Raya Natal', 1, 'Ya', 'Aktif', 'Cuti Bersama Natal', getJakartaTimeString()]
    ];
    defaultData.forEach(row => bersamaSheet.appendRow(row));
  }
}

/**
 * Mengambil daftar karyawan aktif dari Sheet "Bio Karyawan" untuk dropdown pengajuan cuti
 */
function getEmployeeListForCuti() {
  let rawBio = [];
  try {
    if (typeof getLiveBioKaryawanData === 'function') {
      rawBio = getLiveBioKaryawanData();
    }
    if (!rawBio || rawBio.length === 0) {
      rawBio = getSheetData('Bio Karyawan') || [];
    }
  } catch (e) {
    rawBio = getSheetData('Bio Karyawan') || [];
  }

  const list = [];
  rawBio.forEach((row, idx) => {
    const nama = getRowValue(row, ['nama karyawan', 'nama lengkap', 'nama', 'employee name', 'fullname']);
    const nik = getRowValue(row, ['nik', 'idkaryawan', 'employee id', 'id', 'ktp', 'nomor ktp', 'noktp']) || ('EMP-' + (idx + 1).toString().padStart(3, '0'));
    const jabatan = getRowValue(row, ['jabatan', 'posisi', 'divisi', 'role', 'bagian', 'unit']) || 'Karyawan';
    const status = getRowValue(row, ['status', 'status karyawan', 'status_karyawan']);

    // Hanya sertakan karyawan yang terisi namanya
    if (nama && nama.trim() !== '') {
      list.push({
        nik: nik,
        nama: nama,
        jabatan: jabatan,
        isResigned: status !== '' && status.toLowerCase() !== 'aktif'
      });
    }
  });

  // Sort berdasarkan Nama A-Z
  list.sort((a, b) => a.nama.localeCompare(b.nama));
  return list;
}

/**
 * Mengambil seluruh data Pengajuan Cuti Karyawan
 */
function getCutiListData(forceRefresh) {
  try {
    setupCutiSheets();
    const sheetName = CONFIG.SHEETS.CUTI_KARYAWAN || 'CutiKaryawan';
    const rawData = getSheetData(sheetName) || [];

    const data = rawData.map((row, idx) => {
      const rawHari = getRowValue(row, ['jumlahhari', 'hari', 'duration', 'durasi']);
      let parsedHari = parseFloat(String(rawHari).replace(/[^0-9.,-]/g, '').replace(',', '.'));
      if (isNaN(parsedHari) || parsedHari <= 0) parsedHari = 1;

      return {
        cutiId: String(getRowValue(row, ['cutiid', 'id', 'nocuti']) || ('CT-' + (idx + 1).toString().padStart(3, '0'))),
        tglPengajuan: String(getRowValue(row, ['tanggalpengajuan', 'tglpengajuan', 'createdat']) || ''),
        nik: String(getRowValue(row, ['nik', 'idkaryawan', 'employeeid', 'id']) || '-'),
        namaKaryawan: String(getRowValue(row, ['namakaryawan', 'nama', 'karyawan']) || '-'),
        jabatan: String(getRowValue(row, ['jabatan', 'posisi']) || '-'),
        tipeCuti: String(getRowValue(row, ['tipecuti', 'kategoricuti', 'jeniscuti']) || 'Cuti Tahunan'),
        tglMulai: String(getRowValue(row, ['tanggalmulai', 'tglmulai', 'startdate']) || ''),
        tglSelesai: String(getRowValue(row, ['tanggalselesai', 'tglselesai', 'enddate']) || ''),
        jumlahHari: parsedHari,
        keterangan: String(getRowValue(row, ['keterangan', 'alasan']) || ''),
        linkDokumen: String(getRowValue(row, ['linkdokumen', 'suratpermohonan', 'link', 'dokumen', 'attachment']) || ''),
        statusApproval: String(getRowValue(row, ['statusapproval', 'status']) || 'Pending'),
        approvedBy: String(getRowValue(row, ['approvedby', 'approver']) || ''),
        approvedAt: String(getRowValue(row, ['approvedat', 'tglapproval']) || ''),
        catatanApproval: String(getRowValue(row, ['catatanapproval', 'catatan']) || '')
      };
    });

    // Urutkan paling baru di atas
    data.sort((a, b) => new Date(b.tglPengajuan || 0) - new Date(a.tglPengajuan || 0));

    return {
      success: true,
      data: data,
      employees: getEmployeeListForCuti()
    };
  } catch (e) {
    Logger.log('Error getCutiListData: ' + e.message);
    return { success: false, message: 'Gagal memuat data cuti: ' + e.message, data: [], employees: [] };
  }
}

/**
 * Menyimpan pengajuan cuti baru oleh karyawan/manager
 */
function saveCutiRequestData(formData, currentUser) {
  try {
    setupCutiSheets();
    const sheetName = CONFIG.SHEETS.CUTI_KARYAWAN || 'CutiKaryawan';

    if (!formData.namaKaryawan || !formData.tglMulai || !formData.tglSelesai) {
      return { success: false, message: 'Nama Karyawan, Tanggal Mulai, dan Tanggal Selesai wajib diisi!' };
    }

    const existingData = getSheetData(sheetName) || [];
    const cutiId = formData.cutiId || ('CT-' + new Date().getFullYear() + '-' + (existingData.length + 1).toString().padStart(3, '0'));
    const tglPengajuan = formData.tglPengajuan || getJakartaTimeString();

    const docLink = formData.linkDokumen || formData.link || formData.suratPermohonan || '';
    const record = {
      CutiID: cutiId,
      TanggalPengajuan: tglPengajuan,
      NIK: formData.nik || '-',
      NamaKaryawan: formData.namaKaryawan,
      Jabatan: formData.jabatan || 'Karyawan',
      TipeCuti: formData.tipeCuti || 'Cuti Tahunan',
      TanggalMulai: formData.tglMulai,
      TanggalSelesai: formData.tglSelesai,
      JumlahHari: Number(formData.jumlahHari || 1),
      Keterangan: formData.keterangan || '',
      LinkDokumen: docLink,
      'Link Dokumen': docLink,
      StatusApproval: formData.statusApproval || 'Pending',
      ApprovedBy: formData.approvedBy || '',
      ApprovedAt: formData.approvedAt || '',
      CatatanApproval: formData.catatanApproval || '',
      CreatedAt: getJakartaTimeString()
    };

    if (formData.cutiId) {
      updateRowWhere(sheetName, 'CutiID', formData.cutiId, record);
      return { success: true, message: 'Data pengajuan cuti ' + cutiId + ' berhasil diperbarui!' };
    } else {
      insertRow(sheetName, record);
      return { success: true, message: 'Pengajuan cuti untuk ' + formData.namaKaryawan + ' berhasil dikirim!' };
    }
  } catch (e) {
    return { success: false, message: 'Gagal menyimpan pengajuan cuti: ' + e.message };
  }
}

/**
 * Mengubah status approval permohonan cuti (Disetujui / Ditolak / Cancelled)
 */
function updateCutiStatusData(cutiId, status, catatan, approverUser, linkDokumen) {
  try {
    setupCutiSheets();
    const sheetName = CONFIG.SHEETS.CUTI_KARYAWAN || 'CutiKaryawan';

    const updateObj = {
      StatusApproval: status,
      ApprovedBy: approverUser || 'System Admin',
      ApprovedAt: getJakartaTimeString(),
      CatatanApproval: catatan || ''
    };

    if (linkDokumen !== undefined) {
      updateObj.LinkDokumen = linkDokumen || '';
    }

    const res = updateRowWhere(sheetName, 'CutiID', cutiId, updateObj);
    if (res.success) {
      return { success: true, message: 'Keputusan status & LinkDokumen cuti ' + cutiId + ' berhasil disimpan!' };
    }
    return res;
  } catch (e) {
    return { success: false, message: 'Gagal memperbarui status cuti: ' + e.message };
  }
}

/**
 * Menghapus pengajuan cuti
 */
function deleteCutiRequestData(cutiId) {
  try {
    setupCutiSheets();
    const sheetName = CONFIG.SHEETS.CUTI_KARYAWAN || 'CutiKaryawan';
    return deleteRowWhere(sheetName, 'CutiID', cutiId);
  } catch (e) {
    return { success: false, message: 'Gagal menghapus data cuti: ' + e.message };
  }
}

/**
 * Helper untuk memformat tanggal ke format ISO YYYY-MM-DD
 */
function formatIsoDate(dateVal) {
  if (!dateVal) return '';
  if (dateVal instanceof Date) {
    const y = dateVal.getFullYear();
    const m = String(dateVal.getMonth() + 1).padStart(2, '0');
    const d = String(dateVal.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }
  const s = String(dateVal).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    return s.substring(0, 10);
  }
  const dmyMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmyMatch) {
    const d = String(dmyMatch[1]).padStart(2, '0');
    const m = String(dmyMatch[2]).padStart(2, '0');
    const y = dmyMatch[3];
    return y + '-' + m + '-' + d;
  }
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }
  return s;
}

/**
 * Mengambil data Cuti Bersama per Tahun
 */
function getCutiBersamaListData(targetYear) {
  try {
    setupCutiSheets();
    const sheetName = CONFIG.SHEETS.CUTI_BERSAMA || 'CutiBersama';
    const rawData = getSheetData(sheetName) || [];

    let list = rawData.map((row, idx) => {
      const tglVal = formatIsoDate(getRowValue(row, ['tanggal', 'tgl', 'date']));
      let yearVal = String(getRowValue(row, ['tahun', 'year']) || '');
      if (!yearVal && tglVal) {
        const yrMatch = tglVal.match(/\b(20\d{2}|19\d{2})\b/);
        if (yrMatch) yearVal = yrMatch[0];
      }
      if (!yearVal) yearVal = new Date().getFullYear().toString();

      const rawHari = getRowValue(row, ['jumlahhari', 'hari', 'durasi']);
      let parsedHari = parseFloat(String(rawHari).replace(/[^0-9.,-]/g, '').replace(',', '.'));
      if (isNaN(parsedHari) || parsedHari <= 0) parsedHari = 1;

      return {
        id: String(getRowValue(row, ['id', 'cbid']) || ('CB-' + (idx + 1).toString().padStart(3, '0'))),
        tahun: yearVal,
        tanggal: tglVal,
        namaHariLibur: String(getRowValue(row, ['namaharilibur', 'nama', 'libur', 'namalibur', 'namaharii']) || 'Cuti Bersama'),
        jumlahHari: parsedHari,
        potongCutiTahunan: String(getRowValue(row, ['potongcutitahunan', 'potongcuti', 'potong']) || 'Ya'),
        status: String(getRowValue(row, ['status', 'aktif']) || 'Aktif'),
        keterangan: String(getRowValue(row, ['keterangan', 'catatan']) || ''),
        createdAt: String(getRowValue(row, ['createdat', 'tglinput']) || '')
      };
    });

    if (targetYear) {
      list = list.filter(item => String(item.tahun) === String(targetYear));
    }

    list.sort((a, b) => new Date(a.tanggal || 0) - new Date(b.tanggal || 0));

    return {
      success: true,
      data: list,
      currentYear: targetYear || new Date().getFullYear().toString()
    };
  } catch (e) {
    return { success: false, message: 'Gagal memuat data Cuti Bersama: ' + e.message, data: [] };
  }
}

/**
 * Menyimpan / update data Cuti Bersama
 */
function saveCutiBersamaData(formData) {
  try {
    setupCutiSheets();
    const sheetName = CONFIG.SHEETS.CUTI_BERSAMA || 'CutiBersama';

    if (!formData.namaHariLibur || !formData.tanggal) {
      return { success: false, message: 'Nama Hari Libur dan Tanggal wajib diisi!' };
    }

    const existingData = getSheetData(sheetName) || [];
    const cbId = formData.id || ('CB-' + (formData.tahun || new Date().getFullYear()) + '-' + (existingData.length + 1).toString().padStart(3, '0'));

    const record = {
      ID: cbId,
      Tahun: String(formData.tahun || new Date().getFullYear()),
      Tanggal: formatIsoDate(formData.tanggal),
      NamaHariLibur: formData.namaHariLibur,
      JumlahHari: Number(formData.jumlahHari || 1),
      PotongCutiTahunan: formData.potongCutiTahunan || 'Ya',
      Status: formData.status || 'Aktif',
      Keterangan: formData.keterangan || '',
      CreatedAt: getJakartaTimeString()
    };

    if (formData.id) {
      updateRowWhere(sheetName, 'ID', formData.id, record);
      return { success: true, message: 'Data Cuti Bersama ' + cbId + ' berhasil diperbarui!' };
    } else {
      insertRow(sheetName, record);
      return { success: true, message: 'Hari Cuti Bersama ' + formData.namaHariLibur + ' berhasil ditambahkan!' };
    }
  } catch (e) {
    return { success: false, message: 'Gagal menyimpan Cuti Bersama: ' + e.message };
  }
}

/**
 * Menghapus data Cuti Bersama
 */
function deleteCutiBersamaData(id) {
  try {
    setupCutiSheets();
    const sheetName = CONFIG.SHEETS.CUTI_BERSAMA || 'CutiBersama';
    return deleteRowWhere(sheetName, 'ID', id);
  } catch (e) {
    return { success: false, message: 'Gagal menghapus Cuti Bersama: ' + e.message };
  }
}

/**
 * Mengalkulasi rekapitulasi sisa cuti per karyawan untuk tahun tertentu
 * Aturan Kuota Dasar = 12 Hari
 * Net Kuota Tahunan = 12 - (Total Cuti Bersama Aktif yang PotongCutiTahunan == 'Ya')
 */
function getCutiSummaryData(targetYear) {
  try {
    const year = String(targetYear || new Date().getFullYear());
    
    // 1. Ambil Cuti Bersama
    const resCB = getCutiBersamaListData(year);
    const cbList = resCB.success ? resCB.data : [];
    
    // Hitung total Cuti Bersama yang memotong kuota tahunan
    let totalCbPotong = 0;
    cbList.forEach(cb => {
      const statusClean = String(cb.status || '').trim().toLowerCase();
      const potongClean = String(cb.potongCutiTahunan || '').trim().toLowerCase();
      if ((statusClean === 'aktif' || statusClean === '') && potongClean === 'ya') {
        totalCbPotong += Number(cb.jumlahHari || 0);
      }
    });

    const baseQuota = 12; // Standard HR Annual Quota
    const netQuota = Math.max(0, baseQuota - totalCbPotong);

    // 2. Ambil daftar karyawan dari Bio Karyawan
    let employees = getEmployeeListForCuti();
    if (!employees) employees = [];

    // 3. Ambil seluruh data Cuti Karyawan
    const resCuti = getCutiListData(false);
    const cutiList = resCuti.success ? resCuti.data : [];

    // Filter cuti non-rejected pada tahun berjalan (Mendukung status 'Disetujui', 'Approved', 'Pending', atau entry langsung di sheet)
    const validCuti = cutiList.filter(c => {
      const st = String(c.statusApproval || '').trim().toLowerCase();
      const isRejected = st.includes('tolak') || st.includes('reject') || st.includes('batal') || st.includes('cancel');
      if (isRejected) return false;
      
      const tgl = String(c.tglMulai || c.tglPengajuan || c.tglSelesai || '');
      if (!tgl) return true;
      const yrMatch = tgl.match(/\b(20\d{2}|19\d{2})\b/);
      const itemYear = yrMatch ? yrMatch[0] : new Date(tgl).getFullYear().toString();
      return !year || itemYear === String(year);
    });

    const normStr = s => String(s || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');

    // Gabungkan karyawan dari CutiKaryawan yang belum terdaftar di Bio Karyawan
    validCuti.forEach(c => {
      const cNik = normStr(c.nik);
      const cNama = normStr(c.namaKaryawan);
      if (!cNama && (!cNik || cNik === '-')) return;

      const exists = employees.some(emp => {
        const empNik = normStr(emp.nik);
        const empNama = normStr(emp.nama);
        if (cNik && cNik !== '-' && empNik && empNik !== '-' && cNik === empNik) return true;
        if (cNama && empNama && (cNama === empNama || cNama.includes(empNama) || empNama.includes(cNama))) return true;
        return false;
      });

      if (!exists && c.namaKaryawan && c.namaKaryawan !== '-') {
        employees.push({
          nik: c.nik || '-',
          nama: c.namaKaryawan,
          jabatan: c.jabatan || 'Karyawan',
          isResigned: false
        });
      }
    });

    // Subtotal per Karyawan
    const summary = employees.map(emp => {
      const empCuti = validCuti.filter(c => {
        const cNik = normStr(c.nik);
        const empNik = normStr(emp.nik);
        const isNikValid = cNik !== '' && cNik !== '-' && empNik !== '' && empNik !== '-';
        if (isNikValid && cNik === empNik) {
          return true;
        }
        const cNama = normStr(c.namaKaryawan);
        const empNama = normStr(emp.nama);
        if (cNama !== '' && empNama !== '') {
          return cNama === empNama || cNama.includes(empNama) || empNama.includes(cNama);
        }
        return false;
      });

      let cutiTahunanTerpakai = 0;
      let cutiSakitCount = 0;
      let cutiUmrahCount = 0;
      let cutiMelahirkanCount = 0;
      let cutiLainnyaCount = 0;

      empCuti.forEach(c => {
        const tipe = String(c.tipeCuti || '').toLowerCase();
        const rawHari = c.jumlahHari;
        let hari = parseFloat(String(rawHari).replace(/[^0-9.,-]/g, '').replace(',', '.'));
        if (isNaN(hari) || hari <= 0) hari = 1;

        if (tipe.includes('sakit')) {
          cutiSakitCount += hari;
        } else if (tipe.includes('umrah') || tipe.includes('umroh')) {
          cutiUmrahCount += hari;
        } else if (tipe.includes('lahir') || tipe.includes('melahirkan') || tipe.includes('bersalin')) {
          cutiMelahirkanCount += hari;
        } else if (tipe.includes('duka') || tipe.includes('gugur') || tipe.includes('penting') || tipe.includes('khusus')) {
          cutiLainnyaCount += hari;
        } else {
          // Default seluruh pengajuan cuti (Tahunan, Cuti Biasa, Cuti, Izin, etc.) memotong kuota tahunan
          cutiTahunanTerpakai += hari;
        }
      });

      const sisaCuti = netQuota - cutiTahunanTerpakai;
      const totalCutiTaken = empCuti.length;
      const hasTakenCuti = (cutiTahunanTerpakai > 0 || cutiSakitCount > 0 || cutiUmrahCount > 0 || cutiMelahirkanCount > 0 || cutiLainnyaCount > 0 || totalCutiTaken > 0);

      return {
        nik: emp.nik,
        nama: emp.nama,
        jabatan: emp.jabatan,
        baseQuota: baseQuota,
        cutiBersamaPotong: totalCbPotong,
        netQuota: netQuota,
        terpakai: cutiTahunanTerpakai,
        cutiSakit: cutiSakitCount,
        cutiUmrah: cutiUmrahCount,
        cutiMelahirkan: cutiMelahirkanCount,
        cutiLainnya: cutiLainnyaCount,
        sisaCuti: sisaCuti,
        totalCutiTaken: totalCutiTaken,
        hasTakenCuti: hasTakenCuti
      };
    });

    return {
      success: true,
      year: year,
      baseQuota: baseQuota,
      totalCbPotong: totalCbPotong,
      netQuota: netQuota,
      summary: summary
    };
  } catch (e) {
    Logger.log('Error getCutiSummaryData: ' + e.message);
    return { success: false, message: 'Gagal mengalkulasi rekap cuti: ' + e.message, summary: [] };
  }
}

/**
 * Mengunggah berkas Surat Permohonan Cuti ke Google Drive dan mengembalikan Link Google Drive URL
 */
function uploadCutiDokumenToDrive(base64Data, fileName, mimeType) {
  try {
    if (!base64Data || !fileName) {
      return { success: false, message: 'Data berkas tidak valid.' };
    }

    let folder;
    const folderName = 'Cuti_Karyawan_Dokumen';
    const folders = DriveApp.getFoldersByName(folderName);
    if (folders.hasNext()) {
      folder = folders.next();
    } else {
      folder = DriveApp.createFolder(folderName);
    }

    let cleanBase64 = base64Data;
    if (base64Data.includes(',')) {
      cleanBase64 = base64Data.split(',')[1];
    }

    const decoded = Utilities.base64Decode(cleanBase64);
    const blob = Utilities.newBlob(decoded, mimeType || 'application/pdf', fileName);

    const driveFile = folder.createFile(blob);
    try {
      driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (eShare) {
      Logger.log('Warning setSharing: ' + eShare.message);
    }

    const fileUrl = driveFile.getUrl();

    return {
      success: true,
      fileUrl: fileUrl,
      fileName: fileName,
      message: 'Dokumen "' + fileName + '" berhasil diunggah ke Google Drive!'
    };
  } catch (e) {
    Logger.log('Error uploadCutiDokumenToDrive: ' + e.message);
    return { success: false, message: 'Gagal mengunggah ke Google Drive: ' + e.message };
  }
}
