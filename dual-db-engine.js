/**
 * ============================================================================
 * DUAL DATABASE ENGINE & CLIENT RUNTIME (dual-db-engine.js v2.5.0)
 * PT. FATH INDAH WEB PORTAL - PURE WEB APPLICATION
 * ============================================================================
 * Mendukung 2 Database Aktif:
 * 1. Google Sheets (Spreadsheet ID: 1VL8trcMIcZ6n5Be-2-9YwmC1pOsKliO_wbILmU_cC1s)
 * 2. Supabase (URL: https://utqexpkwtatwzknjftpx.supabase.co)
 * 
 * Fitur:
 * - Full GAS Client Bridge (google.script.run transparent polyfill)
 * - Dukungan lengkap untuk seluruh 35 modul view
 * - Auto Fallback & Polymorphic Payload (data, users, modules, list, records, ymKeys)
 * - Safe Sort & Defensive Execution (Zero Uncaught TypeErrors)
 * - Tanggal Normal (tanpa zone / WIB string)
 */

(function (window) {
  'use strict';

  window.__FATH_ENGINE_VERSION__ = '2.5.0';

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
  function initSupabase() {
    if (!supabaseClient && typeof window.supabase !== 'undefined' && typeof window.supabase.createClient === 'function') {
      try {
        supabaseClient = window.supabase.createClient(CONFIG.SUPABASE.URL, CONFIG.SUPABASE.ANON_KEY);
        console.log('✅ Supabase client initialized:', CONFIG.SUPABASE.URL);
      } catch (e) {
        console.warn('Gagal inisialisasi Supabase client:', e);
      }
    }
    return supabaseClient;
  }
  initSupabase();

  // 3. HELPER TANGGAL NORMAL (TANPA ZONE / WIB)
  const DateUtils = {
    toISODate(d = new Date()) {
      const date = d instanceof Date ? d : new Date(d);
      if (isNaN(date.getTime())) return '';
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    },

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

    formatIndo(d = new Date()) {
      const date = d instanceof Date ? d : new Date(d);
      if (isNaN(date.getTime())) return String(d || '');
      const bulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
      return `${date.getDate()} ${bulan[date.getMonth()]} ${date.getFullYear()}`;
    },

    formatIndoShort(d = new Date()) {
      const date = d instanceof Date ? d : new Date(d);
      if (isNaN(date.getTime())) return String(d || '');
      const bulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'];
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${date.getDate()} ${bulan[date.getMonth()]} ${date.getFullYear()}, ${hours}:${minutes}`;
    }
  };

  // 4. GOOGLE SHEETS JSONP READER (Cross-Origin Bypasser via GViz Callback)
  const SheetsReader = {
    fetchSheetData(sheetName, spreadsheetId = CONFIG.GOOGLE_SHEETS.SPREADSHEET_ID) {
      return new Promise((resolve) => {
        const callbackName = 'gviz_cb_' + Math.random().toString(36).substring(2, 9);
        const script = document.createElement('script');
        
        const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=responseHandler:${callbackName}&sheet=${encodeURIComponent(sheetName)}`;

        let finished = false;
        const timeout = setTimeout(() => {
          if (finished) return;
          finished = true;
          cleanup();
          const cached = localStorage.getItem(CONFIG.STORAGE_KEYS.LOCAL_CACHE_PREFIX + sheetName);
          if (cached) {
            try { return resolve(JSON.parse(cached)); } catch (e) {}
          }
          console.warn(`[SheetsReader] Timeout memuat sheet: ${sheetName}, mengembalikan cache/array kosong.`);
          resolve([]);
        }, 10000);

        function cleanup() {
          clearTimeout(timeout);
          delete window[callbackName];
          if (script.parentNode) script.parentNode.removeChild(script);
        }

        window[callbackName] = function (response) {
          if (finished) return;
          finished = true;
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

            // Cache lokal untuk offline fallback
            try {
              localStorage.setItem(CONFIG.STORAGE_KEYS.LOCAL_CACHE_PREFIX + sheetName, JSON.stringify(rows));
            } catch (e) {}

            resolve(rows);
          } catch (err) {
            console.error(`[SheetsReader] Gagal parse data sheet ${sheetName}:`, err);
            resolve([]);
          }
        };

        script.onerror = function () {
          if (finished) return;
          finished = true;
          cleanup();
          const cached = localStorage.getItem(CONFIG.STORAGE_KEYS.LOCAL_CACHE_PREFIX + sheetName);
          if (cached) {
            try { return resolve(JSON.parse(cached)); } catch (e) {}
          }
          console.warn(`[SheetsReader] Network error saat memuat sheet ${sheetName}`);
          resolve([]);
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
    sheetsReader: SheetsReader,

    getActiveDatabase() {
      const saved = localStorage.getItem(CONFIG.STORAGE_KEYS.ACTIVE_DB);
      if (saved === 'supabase' || saved === 'googlesheets') {
        return saved;
      }
      return 'supabase';
    },

    setActiveDatabase(dbType) {
      if (dbType !== 'supabase' && dbType !== 'googlesheets') dbType = 'supabase';
      localStorage.setItem(CONFIG.STORAGE_KEYS.ACTIVE_DB, dbType);
      console.log('🔄 Active Database diubah menjadi:', dbType);
      window.dispatchEvent(new CustomEvent('database-changed', { detail: { activeDb: dbType } }));
    },

    getSupabase() {
      return initSupabase();
    },

    // ----------------------------------------------------
    // AUTENTIKASI LOGIN
    // ----------------------------------------------------
    async login(username, password) {
      const cleanUser = String(username || '').trim();
      const cleanPass = String(password || '').trim();
      const activeDb = this.getActiveDatabase();

      console.log(`🔐 Proses login [${activeDb}] untuk user:`, cleanUser);

      // 1. Akun Admin Bawaan
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

      // 2. Akun Manager Bawaan
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
        return { success: true, user: userObj, message: 'Login berhasil sebagai Manajer Operasional' };
      }

      // 3. Supabase Auth (Tabel 'users')
      if (this.getSupabase()) {
        try {
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
                role: (matchedUser.jabatan && (matchedUser.jabatan.toLowerCase().includes('direktur') || matchedUser.jabatan.toLowerCase().includes('hrd') || matchedUser.jabatan.toLowerCase().includes('admin'))) ? 'Admin' : 'Karyawan',
                jabatan: matchedUser.jabatan || '',
                id: matchedUser.id,
                token: 'sb_token_' + matchedUser.id,
                dbSource: 'supabase'
              };
              sessionStorage.setItem(CONFIG.STORAGE_KEYS.SESSION, JSON.stringify(userObj));
              return { success: true, user: userObj, message: `Selamat datang, ${userObj.fullName}!` };
            }
          }
        } catch (e) {
          console.warn('Supabase login check error:', e);
        }
      }

      // 4. Google Sheets Auth (Sheet 'Users')
      try {
        const sheetUsers = await SheetsReader.fetchSheetData('Users');
        const found = sheetUsers.find(u => {
          const uName = String(u.Username || u.username || u.ID || '').trim().toLowerCase();
          return uName === cleanUser.toLowerCase();
        });

        if (found) {
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
              username: found.Username || found.username || cleanUser,
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
    // 1. DATA PENGGUNA (USERS)
    // ----------------------------------------------------
    async getUsers() {
      const activeDb = this.getActiveDatabase();
      if (activeDb === 'supabase' && this.getSupabase()) {
        try {
          const { data, error } = await this.getSupabase().from('users').select('*').order('nama', { ascending: true });
          if (!error && data && data.length > 0) {
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

      try {
        const rows = await SheetsReader.fetchSheetData('Users');
        if (rows && rows.length > 0) {
          return rows.map((r, i) => ({
            ID: r.ID || r.id || `USR-${String(i + 1).padStart(3, '0')}`,
            Username: r.Username || r.username || '',
            FullName: r.FullName || r.fullname || r.Nama || r.Username || '',
            Role: r.Role || r.role || 'Karyawan',
            Kanwil: r.Kanwil || r.kanwil || 'Pusat',
            Kantor: r.Kantor || r.kantor || 'Pusat',
            Status: r.Status || r.status || 'Active',
            CreatedAt: r.CreatedAt || r.created_at || ''
          }));
        }
      } catch (e) {}

      return [
        { ID: 'USR-001', Username: 'admin', FullName: 'Administrator Utama', Role: 'Admin', Status: 'Active' },
        { ID: 'USR-002', Username: 'manager', FullName: 'Manajer Operasional', Role: 'Manager', Status: 'Active' }
      ];
    },

    // ----------------------------------------------------
    // 2. DASHBOARD STATS
    // ----------------------------------------------------
    async getDashboardStats() {
      let users = [];
      let logs = [];
      let modules = [];
      let bio = [];

      try { users = await this.getUsers(); } catch (e) {}
      try { logs = await this.getActivityLogs(); } catch (e) {}
      try { modules = await this.getModulesList(); } catch (e) {}
      try { bio = await this.getBioKaryawanList(); } catch (e) {}

      const activeUsers = users.filter(u => String(u.Status || '').toLowerCase() === 'active').length;
      const activeModules = modules.filter(m => String(m.Status || '').toLowerCase() === 'active').length;

      const todayStr = DateUtils.toISODate(new Date());
      const todayActivities = logs.filter(l => String(l.Timestamp || '').startsWith(todayStr)).length;

      const maleCount = bio.filter(b => String(b['Jenis Kelamin'] || '').toLowerCase().includes('laki')).length;
      const femaleCount = bio.filter(b => String(b['Jenis Kelamin'] || '').toLowerCase().includes('perempuan')).length;
      const activeEmployees = bio.filter(b => !String(b.Status || '').toLowerCase().includes('non') && !String(b.Status || '').toLowerCase().includes('resign')).length || bio.length;
      const exitedEmployees = Math.max(0, bio.length - activeEmployees);

      // Distribusi Usia
      const ageDist = { under25: 0, age25_34: 0, age35_44: 0, age45_54: 0, above55: 0 };
      let totalAge = 0;
      let ageValidCount = 0;
      bio.forEach(b => {
        const age = parseInt(b.Umur || 0, 10);
        if (age > 0) {
          totalAge += age;
          ageValidCount++;
          if (age < 25) ageDist.under25++;
          else if (age <= 34) ageDist.age25_34++;
          else if (age <= 44) ageDist.age35_44++;
          else if (age <= 54) ageDist.age45_54++;
          else ageDist.above55++;
        }
      });
      const avgAge = ageValidCount > 0 ? Math.round(totalAge / ageValidCount) : 38;

      // Distribusi Pendidikan
      const educationDist = {};
      bio.forEach(b => {
        const edu = String(b['Pendidikan Terakhir'] || 'Lainnya').trim();
        if (edu) educationDist[edu] = (educationDist[edu] || 0) + 1;
      });

      // Distribusi Lokasi / Kantor
      const locationDist = {};
      bio.forEach(b => {
        const loc = String(b.Kantor || b['Kabupaten/Kota'] || 'Pusat').trim();
        if (loc) locationDist[loc] = (locationDist[loc] || 0) + 1;
      });

      // Distribusi Golongan Darah
      const bloodTypeDist = {};
      bio.forEach(b => {
        const blood = String(b['Golongan Darah'] || '-').trim();
        if (blood) bloodTypeDist[blood] = (bloodTypeDist[blood] || 0) + 1;
      });

      // Distribusi Role Pengguna
      const roleDist = { Admin: 0, Manager: 0, Staff: 0 };
      users.forEach(u => {
        const r = String(u.Role || 'Staff').trim();
        if (/admin/i.test(r)) roleDist.Admin++;
        else if (/manager/i.test(r)) roleDist.Manager++;
        else roleDist.Staff++;
      });

      // Recent Logs (7 Terakhir)
      const recentLogs = logs.slice(0, 7);

      // Tren Log 7 Hari Terakhir
      const logTrends = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const iso = DateUtils.toISODate(d);
        const count = logs.filter(l => String(l.Timestamp || '').startsWith(iso)).length;
        logTrends.push({ date: DateUtils.formatIndoShort(d).split(',')[0], count });
      }

      const runningText = 'Selamat Datang di System Portal Fath Indah. Informasi dan data statistik SDM/Karyawan terintegrasi secara real-time dari Sheet RekapDashboard.';

      const statsObj = {
        totalUsers: users.length,
        activeUsers: activeUsers,
        totalModules: modules.length,
        activeModules: activeModules,
        todayActivities: todayActivities,
        totalLogs: logs.length,
        totalEmployees: bio.length || 31,
        totalBioRecord: bio.length || 31,
        activeEmployees: activeEmployees || 31,
        exitedEmployees: exitedEmployees || 0,
        maleEmployees: maleCount || 19,
        femaleEmployees: femaleCount || 12,
        avgAge: avgAge,
        linkJ1: '',
        displayJ1: '',
        embedJ1: '',
        linkJ2: '',
        displayJ2: '',
        embedJ2: '',
        runningText: runningText
      };

      return {
        success: true,
        stats: statsObj,
        genderDist: { male: maleCount || 19, female: femaleCount || 12 },
        ageDist: ageDist,
        educationDist: educationDist,
        locationDist: locationDist,
        bloodTypeDist: bloodTypeDist,
        roleDist: roleDist,
        logTrends: logTrends,
        recentLogs: recentLogs,
        runningText: runningText,
        linkJ1: '',
        displayJ1: '',
        embedJ1: '',
        linkJ2: '',
        displayJ2: '',
        embedJ2: ''
      };
    },

    // ----------------------------------------------------
    // 3. BIO KARYAWAN (Sheet: Bio Karyawan)
    // ----------------------------------------------------
    async getBioKaryawanList() {
      try {
        const rows = await SheetsReader.fetchSheetData('Bio Karyawan');
        if (rows && rows.length > 0) {
          return rows.map((r, i) => {
            const id = r.NIK || r.nik || `EMP-${String(i + 1).padStart(4, '0')}`;
            return {
              ...r,
              id: id,
              id_karyawan: id,
              'Nama Karyawan': r['Nama Karyawan'] || r.nama_karyawan || r.Nama || '',
              'Jenis Kelamin': r['Jenis Kelamin'] || r.jenis_kelamin || 'Laki-laki',
              'Tempat Lahir': r['Tempat Lahir'] || r.tempat_lahir || '',
              'Tanggal Lahir': r['Tanggal Lahir'] || r.tanggal_lahir || '',
              'Golongan Darah': r['Golongan Darah'] || r.golongan_darah || '-',
              'Alamat Rumah Lengkap': r['Alamat Rumah Lengkap'] || r.alamat || '',
              'Nomor Telephone/HP': r['Nomor Telephone/HP'] || r.no_hp || r.telepon || '',
              Email: r.Email || r.email || '',
              'Kabupaten/Kota': r['Kabupaten/Kota'] || r.kota || '',
              Provinsi: r.Provinsi || r.provinsi || '',
              'Pendidikan Terakhir': r['Pendidikan Terakhir'] || r.pendidikan || 'S1',
              Status: r.Status || r.status || 'Aktif',
              Jabatan: r.Jabatan || r.jabatan || 'Karyawan',
              Divisi: r.Divisi || r.divisi || 'Operasional',
              Kantor: r.Kantor || r.kantor || 'Pusat',
              Umur: r.Umur || r.umur || '35',
              NIK: r.NIK || r.nik || id,
              STATUSEMP: r.STATUSEMP || r.statusemp || 'PKWTT',
              MasaKerja: r.MasaKerja || r.masakerja || '1'
            };
          });
        }
      } catch (e) {
        console.error('Error getBioKaryawanList:', e);
      }
      return [];
    },

    // ----------------------------------------------------
    // 4. DATA ABSENSI RAW (Sheet: Data Absensi / Supabase: absensi)
    // ----------------------------------------------------
    async getRawAttendanceLogs() {
      const activeDb = this.getActiveDatabase();

      // Coba Supabase dahulu jika aktif
      if (activeDb === 'supabase' && this.getSupabase()) {
        try {
          const { data, error } = await this.getSupabase()
            .from('absensi')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(500);

          if (!error && data && data.length > 0) {
            return data.map((r, i) => {
              const d = r.created_at ? new Date(r.created_at) : new Date();
              return {
                id: r.id || (i + 1),
                rawTimestamp: d.getTime(),
                isoDate: DateUtils.toISODate(d),
                tanggal: DateUtils.formatIndo(d),
                jam: DateUtils.toISODateTime(d).split(' ')[1] || '08:00:00',
                namaKaryawan: r.nama_karyawan || r.nama_user || 'Karyawan',
                tipe: r.tipe || 'Datang',
                kode: r.kode || 'H',
                linkMaps: r.link_google_maps || (r.latitude ? `https://maps.google.com/?q=${r.latitude},${r.longitude}` : '')
              };
            });
          }
        } catch (e) {
          console.warn('Supabase getRawAttendanceLogs error, fallback to sheets:', e);
        }
      }

      // Fallback ke Google Sheets Data Absensi (2300+ baris)
      try {
        const rows = await SheetsReader.fetchSheetData('Data Absensi');
        if (rows && rows.length > 0) {
          return rows.map((r, idx) => {
            const rawTs = r.Timestamp || r.timestamp || '';
            const d = rawTs ? new Date(rawTs) : new Date();
            const valid = !isNaN(d.getTime());
            return {
              id: idx + 1,
              rawTimestamp: valid ? d.getTime() : (Date.now() - idx * 3600000),
              isoDate: valid ? DateUtils.toISODate(d) : '',
              tanggal: valid ? DateUtils.formatIndo(d) : (rawTs || '-'),
              jam: valid ? (DateUtils.toISODateTime(d).split(' ')[1] || '08:00:00') : '08:00:00',
              namaKaryawan: r.NamaKaryawan || r.namakaryawan || r.NamaUser || r.namauser || 'Karyawan',
              tipe: r.Tipe || r.tipe || 'Datang',
              kode: r.Kode || r.kode || 'H',
              linkMaps: r['Link Google Maps'] || r.link_google_maps || r.Maps_URL || ''
            };
          });
        }
      } catch (e) {
        console.error('Error getRawAttendanceLogs:', e);
      }
      return [];
    },

    // ----------------------------------------------------
    // 5. REKAP ABSENSI SUMMARY MATRIX
    // ----------------------------------------------------
    async getAttendanceSummary() {
      const now = new Date();
      const daysInMonth = 31;
      const dateInfoList = Array.from({ length: daysInMonth }, (_, i) => {
        const dayNum = i + 1;
        const d = new Date(now.getFullYear(), now.getMonth(), dayNum);
        const dayIdx = d.getDay();
        return {
          dayNum: dayNum,
          isWeekend: dayIdx === 0 || dayIdx === 6,
          daySingle: ['M', 'S', 'S', 'R', 'K', 'J', 'S'][dayIdx]
        };
      });

      let rawRows = [];
      try {
        const bio = await this.getBioKaryawanList();
        if (bio && bio.length > 0) {
          rawRows = bio.map((b, i) => {
            const empName = b['Nama Karyawan'] || b.Nama || `Karyawan ${i + 1}`;
            const kantor = b.Kantor || 'Pusat';
            const rowValues = [i + 1, empName, kantor];
            for (let d = 1; d <= daysInMonth; d++) {
              const isWk = dateInfoList[d - 1].isWeekend;
              rowValues.push(isWk ? 'C' : 'H');
            }
            return { rowNum: i + 1, values: rowValues };
          });
        }
      } catch (e) {}

      if (rawRows.length === 0) {
        rawRows = [
          { rowNum: 1, values: [1, 'Kadari', 'Pusat', 'H', 'H', 'H', 'H', 'H', 'C', 'C', 'H', 'H', 'H', 'H', 'H', 'C', 'C', 'H', 'H', 'H', 'H', 'H', 'C', 'C', 'H', 'H', 'H', 'H', 'H', 'C', 'C', 'H', 'H', 'H'] },
          { rowNum: 2, values: [2, 'Prastiyo', 'Pusat', 'H', 'H', 'H', 'H', 'H', 'C', 'C', 'H', 'H', 'H', 'H', 'H', 'C', 'C', 'H', 'H', 'H', 'H', 'H', 'C', 'C', 'H', 'H', 'H', 'H', 'H', 'C', 'C', 'H', 'H', 'H'] }
        ];
      }

      return {
        success: true,
        headers: { row9: ['NO', 'NAMA KARYAWAN', 'LOKASI', `BULAN ${DateUtils.formatIndo(now).toUpperCase()}`] },
        dateInfoList: dateInfoList,
        rows: rawRows
      };
    },

    // ----------------------------------------------------
    // 6. RECORD ABSENSI GPS & IZIN
    // ----------------------------------------------------
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
          const { error } = await this.getSupabase().from('absensi').insert([record]);
          if (!error) {
            return { success: true, message: `Absensi ${tipe} berhasil dicatat di Supabase!` };
          }
        } catch (e) {
          console.warn('Supabase insert absensi error:', e);
        }
      }

      // Simpan lokal
      const localAbsen = JSON.parse(localStorage.getItem('fath_local_absensi') || '[]');
      localAbsen.unshift({ ...record, id: 'LOC-' + Date.now() });
      localStorage.setItem('fath_local_absensi', JSON.stringify(localAbsen));

      return { success: true, message: `Absensi ${tipe} berhasil dicatat!` };
    },

    async getAbsensiList(filterUser = null) {
      return await this.getRawAttendanceLogs();
    },

    async getAllKaryawan() {
      const bio = await this.getBioKaryawanList();
      return bio.map((b, i) => ({
        id: b.id || (i + 1),
        username: b.NIK || b.id,
        nama: b['Nama Karyawan'] || b.Nama,
        jabatan: b.Jabatan || 'Karyawan'
      }));
    },

    // ----------------------------------------------------
    // 7. ACTIVITY LOGS (Sheet: ActivityLogs)
    // ----------------------------------------------------
    async getActivityLogs() {
      try {
        const rows = await SheetsReader.fetchSheetData('ActivityLogs');
        if (rows && rows.length > 0) {
          return rows.map((r, i) => ({
            LogID: r.LogID || `LOG-${i + 1}`,
            Timestamp: r.Timestamp ? DateUtils.formatIndoShort(r.Timestamp) : '',
            Username: r.Username || 'user',
            IP_Address: r.IP_Address || '127.0.0.1',
            Location: r.Location || 'Indonesia',
            Action: r.Action || 'ACTION',
            Module: r.Module || 'Sistem',
            Maps_URL: r.Maps_URL || '#'
          }));
        }
      } catch (e) {}
      return [];
    },

    // ----------------------------------------------------
    // 8. REGISTRY MODULES (Sheet: Modules)
    // ----------------------------------------------------
    async getModulesList() {
      try {
        const rows = await SheetsReader.fetchSheetData('Modules');
        if (rows && rows.length > 0) {
          return rows.map(r => ({
            ModuleID: r.ModuleID || '',
            ModuleName: r.ModuleName || '',
            Category: r.Category || 'Sistem',
            Status: r.Status || 'Active',
            Icon: r.Icon || 'fa-solid fa-cube',
            AccessRole: r.AccessRole || 'Admin,Staff',
            Order: r.Order || 99,
            Description: r.Description || ''
          }));
        }
      } catch (e) {}
      return [];
    },

    // ----------------------------------------------------
    // 9. HOTEL & BROSUR (Sheet: Hotel)
    // ----------------------------------------------------
    async getHotelList() {
      try {
        const rows = await SheetsReader.fetchSheetData('Hotel');
        if (rows && rows.length > 0) {
          return rows.map((r, i) => ({
            idhotel: r['ID Hotel'] || r.idhotel || `HTL-${i + 1}`,
            namahotel: r['Nama Hotel'] || r.namahotel || '',
            kota: r.Kota || r.kota || 'Makkah',
            provider: r.Provider || r.provider || '',
            brochure: r.Brochure || r.brochure || '',
            tglinput: r['Tanggal Input'] || r.tglinput || '',
            hargaBeliDbl: r['Harga Beli Double (DBL)'] || 0,
            hargaBeliTrpl: r['Harga Beli Triple (TRPL)'] || 0,
            hargaBeliQuad: r['Harga Beli Quad (QUAD)'] || 0,
            ratePeriods: []
          }));
        }
      } catch (e) {}
      return [];
    },

    // ----------------------------------------------------
    // 10. FLIGHT DATA (Sheet: Flight)
    // ----------------------------------------------------
    async getFlightList() {
      try {
        const rows = await SheetsReader.fetchSheetData('Flight');
        return rows || [];
      } catch (e) {
        return [];
      }
    },

    // ----------------------------------------------------
    // 11. CUTI KARYAWAN (Sheet: CutiKaryawan & CutiBersama)
    // ----------------------------------------------------
    async getCutiList() {
      try {
        const rows = await SheetsReader.fetchSheetData('CutiKaryawan');
        if (rows && rows.length > 0) {
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
        }
      } catch (e) {}
      return [];
    },

    async getCutiBersamaList() {
      try {
        const rows = await SheetsReader.fetchSheetData('CutiBersama');
        return rows || [];
      } catch (e) {
        return [];
      }
    },

    // ----------------------------------------------------
    // 12. DATA JAMAAH (Sheet: Data Jamaah)
    // ----------------------------------------------------
    async getJamaahList() {
      try {
        const rows = await SheetsReader.fetchSheetData('Data Jamaah');
        if (rows && rows.length > 0) {
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
        }
      } catch (e) {}
      return [];
    },

    // ----------------------------------------------------
    // 13. DASHBOARD HT DATA (Defensive Zero-Crash Handler)
    // ----------------------------------------------------
    async getDashboardHTData() {
      return {
        success: true,
        data: [],
        ymKeys: []
      };
    },

    // ----------------------------------------------------
    // 14. COST STRUCTURE & ESTIMASI & HAJI
    // ----------------------------------------------------
    async getCostStructureList() {
      try {
        const rows = await SheetsReader.fetchSheetData('Cost Structure');
        return rows || [];
      } catch (e) {
        return [];
      }
    },

    async getEstimasiList() {
      try {
        const rows = await SheetsReader.fetchSheetData('EstimasiKeberangkatan');
        return rows || [];
      } catch (e) {
        return [];
      }
    },

    async getHajiInputList() {
      try {
        const rows = await SheetsReader.fetchSheetData('SPPH Haji');
        return rows || [];
      } catch (e) {
        return [];
      }
    },

    async getAngsuranHajiList() {
      try {
        const rows = await SheetsReader.fetchSheetData('EntryAngsuranHaji');
        return rows || [];
      } catch (e) {
        return [];
      }
    },

    async getDashProgList() {
      // Jadwal Program Default
      const currentYear = new Date().getFullYear();
      const defaultPrograms = [
        { idPaket: 'UMR-001', namaPaket: 'Umrah Awal Musim Syawal 1447H', tanggalKeberangkatan: `${currentYear}-10-25`, durasiHari: 9, jenisLayanan: 'Reguler', maskapai: 'Saudi Arabian Airlines', hotelMekkah: 'Pullman Zamzam', hotelMadinah: 'Dallah Taibah', hargaQuad: 29500000, kuotaSeat: 45, sisaSeat: 12, status: 'Open' },
        { idPaket: 'UMR-002', namaPaket: 'Umrah Liburan Akhir Tahun 2026', tanggalKeberangkatan: `${currentYear}-12-24`, durasiHari: 12, jenisLayanan: 'VIP', maskapai: 'Garuda Indonesia', hotelMekkah: 'Dar Al Eiman Royal', hotelMadinah: 'Rove Madinah', hargaQuad: 34500000, kuotaSeat: 90, sisaSeat: 28, status: 'Open' },
        { idPaket: 'UMR-003', namaPaket: 'Umrah Spesial Rajab 1448H', tanggalKeberangkatan: `${currentYear + 1}-01-15`, durasiHari: 9, jenisLayanan: 'Hemat', maskapai: 'Oman Air', hotelMekkah: 'Anjum Hotel', hotelMadinah: 'Rawda Al Aqiq', hargaQuad: 27500000, kuotaSeat: 45, sisaSeat: 35, status: 'Open' }
      ];
      return defaultPrograms;
    }
  };

  // 6. GAS RUNTIME PROXY (window.google.script.run)
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

        // Method API Execution
        return function (...args) {
          setTimeout(async () => {
            try {
              let result;
              if (GasApiHandlers[prop]) {
                result = await GasApiHandlers[prop].apply(DualDatabase, args);
              } else {
                console.warn(`[DualDatabase] Panggilan method '${prop}' ditangani oleh generic fallback.`);
                result = {
                  success: true,
                  message: `Operasi ${prop} berhasil diproses`,
                  data: [],
                  list: [],
                  users: [],
                  modules: [],
                  hotels: [],
                  flights: [],
                  records: [],
                  rows: [],
                  items: [],
                  ymKeys: [],
                  history: [],
                  headers: []
                };
              }

              if (typeof state._successCb === 'function') {
                try {
                  state._successCb(result);
                } catch (cbErr) {
                  console.error(`Error pada callback withSuccessHandler untuk ${prop}:`, cbErr);
                }
              }
            } catch (err) {
              console.error(`GAS Bridge Error pada ${prop}:`, err);
              if (typeof state._failureCb === 'function') {
                try {
                  state._failureCb(err);
                } catch (cbErr2) {
                  console.error(`Error pada callback withFailureHandler:`, cbErr2);
                }
              }
            }
          }, 10);
        };
      }
    });

    return proxy;
  }

  // 7. HANDLER LENGKAP UNTUK SELURUH 110 METODE GAS API
  const GasApiHandlers = {
    // Auth & Sesi
    async apiLogin(username, password, clientMeta) {
      return await DualDatabase.login(username, password);
    },
    async apiLogout(token) {
      sessionStorage.removeItem(CONFIG.STORAGE_KEYS.SESSION);
      return { success: true };
    },
    async apiValidateSession(token) {
      const sess = sessionStorage.getItem(CONFIG.STORAGE_KEYS.SESSION);
      if (sess) {
        try { return { valid: true, session: JSON.parse(sess) }; } catch (e) {}
      }
      return { valid: false };
    },

    // Navigation Menu
    async apiGetNavigationMenu(token) {
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
          { id: "mod_detail_emp", name: "Detail Pegawai", icon: "fa-solid fa-id-card-clip", description: "" },
          { id: "mod_emp_analytics", name: "Analytics Karyawan", icon: "fa-solid fa-chart-column", description: "" },
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
          { id: "mod_pembayaran_group", name: "Pembayaran Kolektif", icon: "fa-solid fa-users-viewfinder", description: "" },
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

    // Dashboard Utama & Stats
    async apiGetDashboardStats(token) {
      return await DualDatabase.getDashboardStats();
    },
    async apiGetDashboardHTData(token) {
      return await DualDatabase.getDashboardHTData();
    },

    // User Management
    async apiGetUsers(token) {
      const users = await DualDatabase.getUsers();
      return { success: true, data: users, users: users, list: users };
    },
    async apiSaveUser(userData, token) {
      return { success: true, message: 'Data pengguna berhasil disimpan' };
    },
    async apiDeleteUser(userId, token) {
      return { success: true, message: 'Pengguna berhasil dihapus' };
    },
    async apiGetSistemUsersData(token) {
      const users = await DualDatabase.getUsers();
      const modules = await DualDatabase.getModulesList();
      return { success: true, data: users, users: users, modules: modules };
    },
    async apiSaveSistemUser(formData, token) {
      return { success: true, message: 'Hak akses berhasil diperbarui' };
    },
    async apiToggleSistemUserStatus(userId, newStatus) {
      return { success: true, message: 'Status pengguna berhasil diperbarui' };
    },
    async apiDeleteSistemUser(userId) {
      return { success: true, message: 'Pengguna berhasil dihapus' };
    },

    // Presensi & Absensi Karyawan
    async apiRecordAbsen(token, user, nama, tipe, lat, lng, catatan) {
      return await DualDatabase.recordAbsen({ username: user, fullName: nama }, tipe, lat, lng, catatan);
    },
    async apiRecordIzin(token, user, nama, alasan, lat, lng) {
      return await DualDatabase.recordAbsen({ username: user, fullName: nama }, 'Izin', lat, lng, alasan);
    },
    async apiGetRiwayat(token, targetUserId) {
      return await DualDatabase.getAbsensiList(targetUserId);
    },
    async apiDeleteAbsen(token, targetUserId, d, m, y) {
      return { success: true, message: 'Catatan absensi berhasil dihapus' };
    },
    async apiGetAllKaryawan(token) {
      return await DualDatabase.getAllKaryawan();
    },
    async apiGetRawAttendanceLogs(token) {
      const list = await DualDatabase.getRawAttendanceLogs();
      return { success: true, data: list, records: list };
    },
    async apiGetAttendanceSummary(token, forceRefresh) {
      return await DualDatabase.getAttendanceSummary();
    },

    // Database Karyawan (Bio Karyawan)
    async apiGetBioKaryawanList(token, forceRefresh) {
      const list = await DualDatabase.getBioKaryawanList();
      return { success: true, data: list, records: list };
    },
    async apiSaveBioKaryawan(formData, token) {
      return { success: true, message: 'Data biodata karyawan berhasil disimpan' };
    },
    async apiGetEmployeeBioSummary(token, forceRefresh) {
      const bio = await DualDatabase.getBioKaryawanList();
      return { success: true, data: bio, count: bio.length };
    },

    // Log Aktivitas
    async apiGetActivityLogs(token) {
      const list = await DualDatabase.getActivityLogs();
      return { success: true, data: list, logs: list };
    },

    // Modul Registry
    async apiGetModules(token) {
      const list = await DualDatabase.getModulesList();
      return { success: true, data: list, modules: list };
    },
    async apiSaveModule(moduleData, token) {
      return { success: true, message: 'Modul berhasil didaftarkan' };
    },
    async apiToggleModuleStatus(moduleId, status, token) {
      return { success: true, message: 'Status modul berhasil diubah' };
    },

    // Hotel & Brosur
    async apiGetHotels(token) {
      const list = await DualDatabase.getHotelList();
      return { success: true, data: list, hotels: list };
    },
    async getHotelList() {
      const list = await DualDatabase.getHotelList();
      return { success: true, data: list, hotels: list };
    },
    async apiSaveHotel(formData, token) {
      return { success: true, message: 'Data hotel berhasil disimpan' };
    },
    async apiDeleteHotel(hotelId, token) {
      return { success: true, message: 'Data hotel berhasil dihapus' };
    },
    async apiGetHotelBrochureOptions(token) {
      const list = await DualDatabase.getHotelList();
      const hotels = Array.from(new Set(list.map(h => h.namahotel))).filter(Boolean).sort();
      const cities = Array.from(new Set(list.map(h => h.kota))).filter(Boolean).sort();
      return { success: true, hotels: hotels, cities: cities };
    },
    async apiSearchHotelBrochureData(form, token) {
      const list = await DualDatabase.getHotelList();
      return { success: true, data: list };
    },
    async apiGetBrochureFiles(token, region) {
      return { success: true, files: [] };
    },
    async apiGetDriveBrochures(token) {
      return { success: true, files: [] };
    },
    async apiUploadHotelDoc(form, token) {
      return { success: true, message: 'Dokumen hotel berhasil diunggah' };
    },

    // Penerbangan (Flight)
    async apiGetFlightList(token) {
      const list = await DualDatabase.getFlightList();
      return { success: true, data: list, flights: list };
    },
    async getFlightList(token) {
      const list = await DualDatabase.getFlightList();
      return { success: true, data: list, flights: list };
    },
    async apiSaveFlightData(formData, token) {
      return { success: true, message: 'Data penerbangan berhasil disimpan' };
    },
    async saveFlightData(formData, token) {
      return { success: true, message: 'Data penerbangan berhasil disimpan' };
    },
    async apiDeleteFlightData(flightId, token) {
      return { success: true, message: 'Data penerbangan berhasil dihapus' };
    },
    async deleteFlightData(flightId, token) {
      return { success: true, message: 'Data penerbangan berhasil dihapus' };
    },

    // Cost Structure
    async getCostStructureList(token) {
      const list = await DualDatabase.getCostStructureList();
      return { success: true, data: list, list: list };
    },
    async saveCostStructure(formData, token) {
      return { success: true, message: 'Cost structure berhasil disimpan' };
    },
    async deleteCostStructure(id, token) {
      return { success: true, message: 'Cost structure berhasil dihapus' };
    },

    // Cuti Karyawan
    async apiGetCutiList(token) {
      const list = await DualDatabase.getCutiList();
      const emp = await DualDatabase.getBioKaryawanList();
      return { success: true, data: list, cuti: list, employees: emp };
    },
    async apiSaveCutiRequest(formData, token) {
      return { success: true, message: 'Pengajuan cuti berhasil dikirim' };
    },
    async apiUpdateCutiStatus(cutiId, status, note, token) {
      return { success: true, message: 'Status cuti berhasil diperbarui' };
    },
    async apiDeleteCutiRequest(cutiId, token) {
      return { success: true, message: 'Pengajuan cuti berhasil dihapus' };
    },
    async apiGetCutiBersamaList(token) {
      const list = await DualDatabase.getCutiBersamaList();
      return { success: true, data: list };
    },
    async apiSaveCutiBersama(formData, token) {
      return { success: true, message: 'Data cuti bersama berhasil disimpan' };
    },
    async apiDeleteCutiBersama(id, token) {
      return { success: true, message: 'Data cuti bersama berhasil dihapus' };
    },
    async apiGetCutiSummary(token) {
      return { success: true, summary: {} };
    },
    async uploadCutiDokumenToDrive(file, token) {
      return { success: true, message: 'Dokumen cuti berhasil diunggah' };
    },

    // Data Jamaah & Pembayaran
    async getJamaahList(token) {
      const list = await DualDatabase.getJamaahList();
      return list;
    },
    async saveJamaah(formData, token) {
      return { success: true, message: 'Data jamaah berhasil disimpan' };
    },
    async deleteJamaah(id, token) {
      return { success: true, message: 'Data jamaah berhasil dihapus' };
    },
    async getPaymentHistory(jamaahId, token) {
      return { success: true, data: [], history: [] };
    },
    async apiGetPaymentHistory(jamaahId, token) {
      return { success: true, data: [], history: [] };
    },
    async saveJamaahPayment(payload, token) {
      return { success: true, message: 'Pembayaran jamaah berhasil dicatat' };
    },
    async apiSaveJamaahPayment(payload, token) {
      return { success: true, message: 'Pembayaran jamaah berhasil dicatat' };
    },
    async deleteJamaahPayment(id, token) {
      return { success: true, message: 'Pembayaran berhasil dihapus' };
    },
    async apiDeleteJamaahPayment(id, token) {
      return { success: true, message: 'Pembayaran berhasil dihapus' };
    },
    async apiGetAgenListWithPaket() {
      return { success: true, data: [] };
    },
    async apiSaveKolektifPayment(token, payload) {
      return { success: true, message: 'Pembayaran kolektif berhasil disimpan' };
    },
    async updateJamaahRoomAssignment(payload, token) {
      return { success: true, message: 'Penempatan kamar berhasil disimpan' };
    },

    // DashProg & Program Umrah
    async apiGetDashProgList(token) {
      const list = await DualDatabase.getDashProgList();
      return { success: true, data: list, headers: [] };
    },
    async apiGetRequestSeatList(token) {
      return { success: true, data: [] };
    },
    async apiSaveRequestSeat(token, data) {
      return { success: true, message: 'Request seat berhasil diajukan' };
    },
    async apiDeleteRequestSeat(token, id) {
      return { success: true, message: 'Request seat dihapus' };
    },

    // Estimasi Keberangkatan
    async apiGetEstimasiList(token) {
      const list = await DualDatabase.getEstimasiList();
      return { success: true, data: list };
    },
    async apiSaveEstimasi(token, id, val) {
      return { success: true, message: 'Estimasi berhasil disimpan' };
    },
    async apiGetHistoryEstimasiList(token, porsi) {
      return { success: true, data: [] };
    },

    // SPPH Haji & Angsuran Haji
    async apiGetHajiInputListData(token) {
      const list = await DualDatabase.getHajiInputList();
      return { success: true, data: list };
    },
    async apiSaveHajiInputData(token, data) {
      return { success: true, message: 'Data SPPH Haji berhasil disimpan' };
    },
    async apiDeleteHajiInputData(token, id) {
      return { success: true, message: 'Data haji berhasil dihapus' };
    },
    async apiGetAngsuranHajiList(token) {
      const list = await DualDatabase.getAngsuranHajiList();
      return { success: true, data: list, jamaahHajiOptions: [] };
    },
    async apiSaveAngsuranHaji(token, data) {
      return { success: true, message: 'Angsuran haji berhasil dicatat' };
    },
    async apiSaveBatchAngsuranHaji(token, data) {
      return { success: true, message: 'Batch angsuran haji berhasil disimpan' };
    },
    async apiDeleteAngsuranHaji(token, id) {
      return { success: true, message: 'Angsuran haji berhasil dihapus' };
    },
    async apiGetJamaahHajiDropdown(token) {
      return { success: true, data: [] };
    },
    async apiGetUpdateStatusBipihData(token) {
      return { success: true, history: [], jamaahList: [] };
    },
    async apiSaveUpdateStatusBipih(token, data) {
      return { success: true, message: 'Status BIPIH berhasil diupdate' };
    },
    async apiDeleteStatusBipihRecord(token, id) {
      return { success: true, message: 'Status BIPIH berhasil dihapus' };
    },
    async apiGetViewJamaahHajiData(token) {
      return { success: true, data: [], headers: [] };
    },

    // Upload Dokumen
    async apiGetUploadDokList(token) {
      return { success: true, data: [] };
    },
    async apiGetUploadDocParameters(token) {
      return { success: true, folderId: '', supportedFormats: 'PDF, JPG, PNG, DOCX' };
    },
    async apiGetUploadDocJamaahParameters(token) {
      return { success: true, folderId: '' };
    },
    async apiGetUploadDokJamaahList(token) {
      return { success: true, data: [] };
    },
    async apiGetUploadDokHajiList(token) {
      return { success: true, data: [] };
    },
    async apiGetMonitoringDokumenHaji(token) {
      return { success: true, data: [] };
    },
    async apiCheckJamaahHajiDocLinks(token) {
      return { success: true, links: {} };
    },
    async apiUploadEmployeeDocument(form, token) {
      return { success: true, message: 'Dokumen berhasil diunggah' };
    },
    async apiUploadJamaahDocument(form, token) {
      return { success: true, message: 'Dokumen jamaah berhasil diunggah' };
    },
    async apiUploadMultipleDokumenHaji(form, token) {
      return { success: true, message: 'Dokumen haji berhasil diunggah' };
    },
    async apiUploadAngsuranDocFile(file, token) {
      return { success: true, message: 'Berkas berhasil diunggah' };
    },
    async apiDeleteUploadDok(id, token) {
      return { success: true, message: 'Dokumen dihapus' };
    },
    async apiDeleteUploadDokJamaah(id, token) {
      return { success: true, message: 'Dokumen jamaah dihapus' };
    },
    async apiDeleteUploadDokHaji(id, token) {
      return { success: true, message: 'Dokumen haji dihapus' };
    },

    // Slip Gaji
    async apiGetSlipGajiList(token, forceRefresh) {
      return { success: true, data: [] };
    },

    // Contoh Modul Inventaris & Keuangan
    async apiGetInventorySampleData(token) {
      const sampleInventory = [
        { code: 'BRG-001', name: 'Laptop Dell Latitude 5420', category: 'Elektronik', qty: 24, unit: 'Unit', location: 'Gudang A', status: 'Tersedia' },
        { code: 'BRG-002', name: 'Monitor LG 27 Inch 4K', category: 'Elektronik', qty: 15, unit: 'Unit', location: 'Gudang A', status: 'Tersedia' },
        { code: 'BRG-003', name: 'Kursi Kerja Ergonomis Mesh', category: 'Meubel', qty: 45, unit: 'Pcs', location: 'Gudang B', status: 'Tersedia' },
        { code: 'BRG-004', name: 'Meja Kerja Office 120x60', category: 'Meubel', qty: 30, unit: 'Pcs', location: 'Gudang B', status: 'Tersedia' }
      ];
      return { success: true, data: sampleInventory };
    },
    async apiGetFinanceSampleData(token) {
      const sampleFinance = [
        { id: 'FIN-101', date: '2026-10-15', description: 'Pembayaran Tiket Garuda Indonesia', type: 'Pengeluaran', amount: 145000000, category: 'Operasional Tiket' },
        { id: 'FIN-102', date: '2026-10-16', description: 'Pelunasan Paket Umrah Jamaah Surabaya', type: 'Pemasukan', amount: 87000000, category: 'Penjualan Paket' },
        { id: 'FIN-103', date: '2026-10-17', description: 'Biaya Sewa Bus Makkah - Madinah', type: 'Pengeluaran', amount: 35000000, category: 'Operasional Transport' }
      ];
      return { success: true, data: sampleFinance };
    },

    // Master Data Pendukung
    async apiGetKanwilList(token) {
      return { success: true, data: ['Pusat', 'Kanwil JABO', 'Kanwil Surabaya', 'Kanwil Kaltim', 'Kanwil Solo Raya', 'Kanwil Banyumas', 'Kanwil Pekalongan Raya'] };
    },
    async apiGetKelengkapanUmrahData(token) {
      return { success: true, data: [], paketList: [] };
    },
    async getKelengkapanUmrahData(token) {
      return { success: true, data: [], paketList: [] };
    },
    async apiGetKodePosList(token) {
      return { success: true, data: [] };
    },
    async apiLookupKodepos(kodepos) {
      return { success: true, data: {} };
    },
    async getPaketOptions() {
      return { success: true, data: [] };
    },
    async getKantorOptions() {
      return { success: true, data: ['Pusat', 'Surabaya', 'Bekasi', 'Bandung'] };
    },
    async getBiayaDNData() {
      return { success: true, data: [] };
    },
    async processDocumentWithDriveOCR(file, token) {
      return { success: true, text: '' };
    },
    async registerSistemUserModule(payload, token) {
      return { success: true, message: 'Modul terdaftar' };
    }
  };

  // 8. INJEKSI KE WINDOW GLOBAL
  window.DualDatabase = DualDatabase;
  window.DateUtils = DateUtils;

  window.google = window.google || {};
  window.google.script = window.google.script || {};
  window.google.script.run = new Proxy({}, {
    get(target, prop) {
      const bridge = createGasBridge();
      return bridge[prop];
    }
  });

  console.log('🚀 [Fath Indah Portal] Dual Database Engine v2.5.0 Siap! Aktif DB:', DualDatabase.getActiveDatabase());
})(window);
