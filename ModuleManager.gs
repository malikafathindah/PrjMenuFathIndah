/**
 * Helper fleksibel untuk mengambil properti modul dari sheet atau object default
 */
function getModProp(mod, possibleKeys, defaultVal = '') {
  if (!mod || typeof mod !== 'object') return defaultVal;
  for (let i = 0; i < possibleKeys.length; i++) {
    const k = possibleKeys[i];
    if (mod[k] !== undefined && mod[k] !== null && String(mod[k]).trim() !== '') {
      return String(mod[k]).trim();
    }
  }
  const keys = Object.keys(mod);
  for (let i = 0; i < possibleKeys.length; i++) {
    const target = possibleKeys[i].toLowerCase().replace(/[^a-z0-9]/g, '');
    for (let j = 0; j < keys.length; j++) {
      if (keys[j].toLowerCase().replace(/[^a-z0-9]/g, '') === target) {
        const val = mod[keys[j]];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          return String(val).trim();
        }
      }
    }
  }
  return defaultVal;
}

/**
 * Mengambil daftar menu modul yang berhak diakses oleh Role tertentu
 * @param {string} userRole Role pengguna ('Admin', 'Manager', 'Staff')
 */
function getActiveNavigationMenu(userRole) {
  try {
    // setupDatabase(); // DINONAKTIFKAN: Agar loading menu menjadi instan dan tidak mem-verifikasi database berulang-ulang
    
    let modules = getSheetData(CONFIG.SHEETS.MODULES) || [];
    
    // Default fallback jika sheet Modules kosong / belum lengkap
    const defaultCoreModules = [
      { ModuleID: 'mod_dashboard', ModuleName: 'Dashboard Utama', Category: 'Sistem', Status: 'Active', Icon: 'fa-solid fa-chart-pie', AccessRole: 'Admin,Manager,Staff', Order: 1, Description: 'Ringkasan performa dan statistik sistem' },
      { ModuleID: 'mod_users', ModuleName: 'Manajemen Pengguna', Category: 'Pengaturan', Status: 'Active', Icon: 'fa-solid fa-users-gear', AccessRole: 'Admin', Order: 2, Description: 'Kelola akun user, role, dan hak akses' },
      { ModuleID: 'mod_logs', ModuleName: 'Log Aktivitas & Audit', Category: 'Keamanan', Status: 'Active', Icon: 'fa-solid fa-shield-halved', AccessRole: 'Admin,Manager', Order: 3, Description: 'Audit trail jejak aktivitas pengguna' },
      { ModuleID: 'mod_inventory', ModuleName: 'Manajemen Inventaris', Category: 'Operasional', Status: 'Active', Icon: 'fa-solid fa-boxes-stacked', AccessRole: 'Admin,Manager,Staff', Order: 4, Description: 'Modul plug-and-play kelola stok barang' },
      { ModuleID: 'mod_finance', ModuleName: 'Modul Keuangan', Category: 'Keuangan', Status: 'Active', Icon: 'fa-solid fa-wallet', AccessRole: 'Admin,Manager', Order: 5, Description: 'Modul plug-and-play kelola arus kas' },
      { ModuleID: 'mod_attendance', ModuleName: 'Rekap Absensi', Category: 'Karyawan', Status: 'Active', Icon: 'fa-solid fa-clipboard-user', AccessRole: 'Admin,Manager,Staff', Order: 6, Description: 'Rekapitulasi absensi karyawan dari sheet Rekap Absensi' },
      { ModuleID: 'mod_data_attendance', ModuleName: 'Data Absensi', Category: 'Karyawan', Status: 'Active', Icon: 'fa-solid fa-list-check', AccessRole: 'Admin,Manager,Staff', Order: 7, Description: 'Detail log absensi karyawan dari sheet Data Absensi' },
      { ModuleID: 'mod_bio_karyawan', ModuleName: 'Form Entry Karyawan', Category: 'Karyawan', Status: 'Active', Icon: 'fa-solid fa-user-plus', AccessRole: 'Admin,Manager,Staff', Order: 8, Description: 'Formulir entry data lengkap biodata karyawan baru' },
      { ModuleID: 'mod_daftar_karyawan', ModuleName: 'Daftar Karyawan', Category: 'Karyawan', Status: 'Active', Icon: 'fa-solid fa-users', AccessRole: 'Admin,Manager,Staff', Order: 9, Description: 'Daftar rekapitulasi data seluruh karyawan terdaftar' },
      { ModuleID: 'mod_upload_dok', ModuleName: 'Upload Dokumen', Category: 'Karyawan', Status: 'Active', Icon: 'fa-solid fa-cloud-arrow-up', AccessRole: 'Admin,Manager,Staff', Order: 10, Description: 'Upload dokumen Karyawan ke Google Drive & simpan link ke sheet UploadDok' },
      { ModuleID: 'mod_detail_emp', ModuleName: 'Detail Pegawai', Category: 'Karyawan', Status: 'Active', Icon: 'fa-solid fa-id-card-clip', AccessRole: 'Admin,Manager,Staff', Order: 11, Description: 'Dokumen lengkap detail kepegawaian dan biodata resmi karyawan' },
      { ModuleID: 'mod_emp_analytics', ModuleName: 'Analytics Karyawan', Category: 'Karyawan', Status: 'Active', Icon: 'fa-solid fa-chart-column', AccessRole: 'Admin,Manager,Staff', Order: 12, Description: 'Dashboard analytics & demografi statistik karyawan' },
      { ModuleID: 'mod_cuti_karyawan', ModuleName: 'Pengajuan & Rekap Cuti', Category: 'Karyawan', Status: 'Active', Icon: 'fa-solid fa-calendar-minus', AccessRole: 'Admin,Manager,Staff', Order: 13, Description: 'Pengajuan cuti karyawan, persetujuan, sisa kuota, dan kalender cuti' },
      { ModuleID: 'mod_cuti_bersama', ModuleName: 'Cuti Bersama & Libur', Category: 'Karyawan', Status: 'Active', Icon: 'fa-solid fa-calendar-day', AccessRole: 'Admin,Manager,Staff', Order: 14, Description: 'Setting hari cuti bersama & tanggal libur nasional per tahun' },
      { ModuleID: 'mod_modules', ModuleName: 'Registry Modul', Category: 'Pengaturan', Status: 'Active', Icon: 'fa-solid fa-sliders', AccessRole: 'Admin', Order: 15, Description: 'Kelola pendaftaran dan status modul sistem' },
      { ModuleID: 'mod_input_hotel', ModuleName: 'Input Data Hotel', Category: 'Marketing', Status: 'Active', Icon: 'fa-solid fa-hotel', AccessRole: 'Admin,Manager,Staff', Order: 16, Description: 'Input data hotel, harga kamar (Double/Triple/Quad), vendor provider & kontrak' },
      { ModuleID: 'mod_slip_gaji', ModuleName: 'Lihat Slip Gaji', Category: 'Keuangan', Status: 'Active', Icon: 'fa-solid fa-file-invoice-dollar', AccessRole: 'Admin,Manager,Staff', Order: 25, Description: 'Lihat dan pratinjau dokumen Slip Gaji karyawan dari Google Drive' },
      { ModuleID: 'mod_input_flight', ModuleName: 'Input Data Penerbangan', Category: 'Marketing', Status: 'Active', Icon: 'fa-solid fa-plane-departure', AccessRole: 'Admin,Manager,Staff', Order: 17, Description: 'Input data penerbangan, rute outbound/inbound, alokasi block seat & harga tiket' },
      { ModuleID: 'mod_cost_structure', ModuleName: 'Cost Structure Paket', Category: 'Marketing', Status: 'Active', Icon: 'fa-solid fa-calculator', AccessRole: 'Admin,Manager,Staff', Order: 18, Description: 'Perhitungan HPP, asumsi biaya, margin faedah, & harga jual paket Umrah' },
      { ModuleID: 'mod_form_input_jamaah', ModuleName: 'Form Input Jamaah', Category: 'Jamaah', Status: 'Active', Icon: 'fa-solid fa-file-signature', AccessRole: 'Admin,Manager,Staff', Order: 19, Description: 'Formulir input data pendaftaran jamaah umrah baru' },
      { ModuleID: 'mod_data_jamaah', ModuleName: 'Data Jamaah', Category: 'Jamaah', Status: 'Active', Icon: 'fa-solid fa-table-list', AccessRole: 'Admin,Manager,Staff', Order: 20, Description: 'Daftar rekapitulasi data jamaah terdaftar & pencarian' },
      { ModuleID: 'mod_rooming_list', ModuleName: 'Rooming List & Penempatan', Category: 'Jamaah', Status: 'Active', Icon: 'fa-solid fa-bed', AccessRole: 'Admin,Manager,Staff', Order: 21, Description: 'Pengaturan alokasi penempatan kamar jamaah & cetak rooming list' },
      { ModuleID: 'mod_pembayaran_jamaah', ModuleName: 'Pembayaran & Kwitansi', Category: 'Jamaah', Status: 'Active', Icon: 'fa-solid fa-file-invoice-dollar', AccessRole: 'Admin,Manager,Staff', Order: 22, Description: 'Pencatatan riwayat pembayaran, sisa tagihan & cetak kwitansi jamaah' },
      { ModuleID: 'mod_upload_dok_jamaah', ModuleName: 'Upload Dokumen Jamaah', Category: 'Jamaah', Status: 'Active', Icon: 'fa-solid fa-folder-arrow-up', AccessRole: 'Admin,Manager,Staff', Order: 23, Description: 'Pengunggahan berkas fisik dokumen jamaah ke Google Drive per jenis dokumen' },
      { ModuleID: 'mod_entry_angsuran_haji', ModuleName: 'Entry Angsuran Haji', Category: 'Keuangan', Status: 'Active', Icon: 'fa-solid fa-hand-holding-dollar', AccessRole: 'Admin,Manager,Staff', Order: 26, Description: 'Pencatatan & import angsuran haji nasabah dari file Excel / jurnal' },
      { ModuleID: 'mod_upload_dok_haji', ModuleName: 'Upload Dokumen Haji', Category: 'Jamaah', Status: 'Active', Icon: 'fa-solid fa-folder-open', AccessRole: 'Admin,Manager,Staff', Order: 27, Description: 'Pengunggahan dokumen berkas fisik jamaah haji (BPJS, SPPH, Paspor, KTP, KK, dll) ke Google Drive' },
      { ModuleID: 'mod_view_jamaah_haji', ModuleName: 'View Data Jamaah Haji', Category: 'Jamaah', Status: 'Active', Icon: 'fa-solid fa-kaaba', AccessRole: 'Admin,Manager,Staff', Order: 28, Description: 'Menampilkan seluruh data Jamaah Haji dari sheet DataJamaahHaji (Group Tampilan)' },
      { ModuleID: 'mod_update_status_bipih', ModuleName: 'Update Status BIPIH', Category: 'Jamaah', Status: 'Active', Icon: 'fa-solid fa-file-invoice-dollar', AccessRole: 'Admin,Manager,Staff', Order: 29, Description: 'Form update pelunasan status BIPIH (C/F) & pencatatan riwayat transaksi ke sheet UpdateBIPIH' },
      { ModuleID: 'mod_kelengkapan_umrah', ModuleName: 'Input Kelengkapan Data Umrah', Category: 'Umrah', Status: 'Active', Icon: 'fa-solid fa-passport', AccessRole: 'Admin,Manager,Staff', Order: 30, Description: 'Input kelengkapan dokumen Umrah: Visa, Asuransi Polis, dan BPJS Jamaah' }
    ];

    if (!modules || modules.length === 0) {
      modules = defaultCoreModules;
      try {
        defaultCoreModules.forEach(m => registerNewModule(m));
      } catch (e) {
        Logger.log('Initial modules seed note: ' + e.message);
      }
    } else {
      const existingModIds = modules.map(m => getModProp(m, ['ModuleID', 'Module ID', 'module_id', 'id']).toLowerCase());
      const missingModules = [];
      defaultCoreModules.forEach(defMod => {
        if (!existingModIds.includes(defMod.ModuleID.toLowerCase())) {
          modules.push(defMod);
          missingModules.push(defMod);
        }
      });
      if (missingModules.length > 0) {
        try {
          missingModules.forEach(m => registerNewModule(m));
        } catch (e) {
          Logger.log('Auto-sync missing modules note: ' + e.message);
        }
      }
    }

    const cleanUserRole = String(userRole || '').trim().toLowerCase();

    // Filter modul aktif & yang sesuai dengan Role pengguna
    const allowedModules = modules.filter(mod => {
      const modIdClean = getModProp(mod, ['ModuleID', 'Module ID', 'module_id', 'id']).toLowerCase();

      if (!modIdClean) return false;

      // Dashboard utama selalu diizinkan sebagai modul navigasi inti
      if (modIdClean !== 'mod_dashboard') {
        const modStatus = getModProp(mod, ['Status', 'status'], 'Active').toLowerCase();
        if (modStatus !== 'active') return false;
      }

      const accessRole = getModProp(mod, ['AccessRole', 'Access Role', 'accessrole'], 'Admin,Manager,Staff');
      if (!accessRole) return true;
      const roles = String(accessRole).split(',').map(r => r.trim().toLowerCase());
      return roles.includes(cleanUserRole) || roles.includes('*') || cleanUserRole === 'admin' || cleanUserRole === '';
    });

    // Urutkan berdasarkan kolom 'Order'
    allowedModules.sort((a, b) => Number(getModProp(a, ['Order', 'order'], 99)) - Number(getModProp(b, ['Order', 'order'], 99)));

    // Kelompokkan berdasarkan Kategori Menu
    const groupedMenu = {};
    allowedModules.forEach(mod => {
      const category = getModProp(mod, ['Category', 'Kategori', 'category'], 'Utama');
      const modId = getModProp(mod, ['ModuleID', 'Module ID', 'module_id', 'id']);
      const modName = getModProp(mod, ['ModuleName', 'Module Name', 'modulename', 'name']);
      const modIcon = getModProp(mod, ['Icon', 'icon'], 'fa-solid fa-cube');
      const modDesc = getModProp(mod, ['Description', 'description', 'keterangan'], '');

      if (!modId) return;

      if (!groupedMenu[category]) {
        groupedMenu[category] = [];
      }
      groupedMenu[category].push({
        id: modId,
        name: modName || modId,
        icon: modIcon,
        description: modDesc
      });
    });

    return groupedMenu;

  } catch (e) {
    Logger.log('Error pada getActiveNavigationMenu: ' + e.message);
    return {};
  }
}

/**
 * Mengambil semua daftar modul (untuk Halaman Manajemen Modul oleh Admin)
 */
function getAllModulesList() {
  return getSheetData(CONFIG.SHEETS.MODULES);
}

/**
 * Mendaftarkan modul baru ke dalam database Google Sheet "Modules"
 * Fungsi ini dapat dipanggil via API atau secara opsional saat penambahan modul baru.
 */
function registerNewModule(moduleData) {
  try {
    const modId = getModProp(moduleData, ['ModuleID', 'Module ID', 'module_id', 'id']);
    const modName = getModProp(moduleData, ['ModuleName', 'Module Name', 'modulename', 'name']);
    if (!modId || !modName) {
      return { success: false, message: 'ModuleID dan ModuleName wajib diisi!' };
    }

    const existingModules = getSheetData(CONFIG.SHEETS.MODULES) || [];
    const isExist = existingModules.some(m => {
      const id = getModProp(m, ['ModuleID', 'Module ID', 'module_id', 'id']);
      return id && id.toLowerCase() === modId.toLowerCase();
    });

    const payload = {
      ModuleID: modId,
      ModuleName: modName,
      Category: getModProp(moduleData, ['Category', 'Kategori', 'category'], 'Jamaah'),
      Status: getModProp(moduleData, ['Status', 'status'], 'Active'),
      Icon: getModProp(moduleData, ['Icon', 'icon'], 'fa-solid fa-cube'),
      AccessRole: getModProp(moduleData, ['AccessRole', 'Access Role', 'accessrole'], 'Admin,Manager,Staff'),
      Order: Number(getModProp(moduleData, ['Order', 'order'], 10)),
      Description: getModProp(moduleData, ['Description', 'description', 'keterangan'], '')
    };

    if (isExist) {
      // Perbarui jika sudah ada
      updateRowWhere(CONFIG.SHEETS.MODULES, 'ModuleID', modId, payload);
      return { success: true, message: 'Modul ' + modName + ' berhasil diperbarui!' };
    } else {
      // Tambah modul baru
      insertRow(CONFIG.SHEETS.MODULES, payload);
      return { success: true, message: 'Modul baru ' + modName + ' berhasil terdaftar!' };
    }
  } catch (e) {
    return { success: false, message: 'Gagal meregistrasi modul: ' + e.message };
  }
}

/**
 * Mengubah Status Modul (Active / Inactive)
 */
function toggleModuleStatus(moduleId, status) {
  return updateRowWhere(CONFIG.SHEETS.MODULES, 'ModuleID', moduleId, { Status: status });
}
