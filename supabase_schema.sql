-- ============================================================================
-- SUPABASE COMPLETE SCHEMA FOR PT. FATH INDAH
-- Generated automatically from Google Sheets database
-- Project URL: https://utqexpkwtatwzknjftpx.supabase.co
--
-- CARA PENGGUNAAN:
-- 1. Buka Supabase Dashboard (https://supabase.com/dashboard/project/utqexpkwtatwzknjftpx)
-- 2. Klik menu "SQL Editor" di bilah navigasi kiri
-- 3. Klik "New Query", paste seluruh isi file ini
-- 4. Klik tombol "Run"
--
-- CATATAN:
-- Script ini akan melakukan DROP TABLE IF EXISTS sehingga seluruh data lama di-clear
-- dan semua 19 tabel baru terbentuk bersih & siap disinkronkan dengan Google Sheets.
-- ============================================================================

-- EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- Table: users (Source: Sheet "Users")
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS public.users CASCADE;

CREATE TABLE public.users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT,
  username TEXT,
  password TEXT,
  nama TEXT,
  full_name TEXT,
  jabatan TEXT,
  role TEXT,
  kanwil TEXT,
  kantor TEXT,
  status TEXT,
  foto_wajah TEXT,
  face_descriptor TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public all access on users" ON public.users
  FOR ALL USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- Table: activity_logs (Source: Sheet "ActivityLogs")
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS public.activity_logs CASCADE;

CREATE TABLE public.activity_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  logid TEXT,
  timestamp TEXT,
  username TEXT,
  ip_address TEXT,
  maps_url TEXT,
  location TEXT,
  action TEXT,
  module TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public all access on activity_logs" ON public.activity_logs
  FOR ALL USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- Table: modules (Source: Sheet "Modules")
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS public.modules CASCADE;

CREATE TABLE public.modules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  moduleid TEXT,
  modulename TEXT,
  category TEXT,
  status TEXT,
  icon TEXT,
  accessrole TEXT,
  order_num TEXT,
  description TEXT,
  col_9 TEXT,
  col_10 TEXT,
  col_11 TEXT,
  col_12 TEXT,
  col_13 TEXT,
  col_14 TEXT,
  col_15 TEXT,
  col_16 TEXT,
  col_17 TEXT,
  col_18 TEXT,
  col_19 TEXT,
  col_20 TEXT,
  col_21 TEXT,
  col_22 TEXT,
  col_23 TEXT,
  col_24 TEXT,
  col_25 TEXT,
  col_26 TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public all access on modules" ON public.modules
  FOR ALL USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- Table: upload_dok (Source: Sheet "UploadDok")
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS public.upload_dok CASCADE;

CREATE TABLE public.upload_dok (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  docid TEXT,
  timestamp TEXT,
  nama_karyawan TEXT,
  jenis_dokumen TEXT,
  nama_file TEXT,
  link_file TEXT,
  file_id TEXT,
  uploader TEXT,
  keterangan TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.upload_dok ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public all access on upload_dok" ON public.upload_dok
  FOR ALL USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- Table: hotel (Source: Sheet "Hotel")
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS public.hotel CASCADE;

CREATE TABLE public.hotel (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  id_hotel TEXT,
  nama_hotel TEXT,
  kota TEXT,
  tanggal_awal_from_ TEXT,
  tanggal_akhir_to_ TEXT,
  harga_beli_double_dbl_ TEXT,
  harga_beli_triple_trpl_ TEXT,
  harga_beli_quad_quad_ TEXT,
  harga_jual_double TEXT,
  harga_jual_triple TEXT,
  harga_jual_quad TEXT,
  harga_jual_per_jamah_double TEXT,
  harga_jual_per_jamah_triple TEXT,
  harga_jual_per_jamah_quad TEXT,
  meal_plan TEXT,
  provider TEXT,
  brochure TEXT,
  createdat TEXT,
  user_input TEXT,
  jarak TEXT,
  tanggal_input TEXT,
  google_maps TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.hotel ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public all access on hotel" ON public.hotel
  FOR ALL USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- Table: cost_structure (Source: Sheet "CostStructure")
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS public.cost_structure CASCADE;

CREATE TABLE public.cost_structure (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  id_1 TEXT,
  timestamp TEXT,
  kodeproduk TEXT,
  namaproduk TEXT,
  kategori TEXT,
  tglberangkat TEXT,
  tglberlaku TEXT,
  totalhpp TEXT,
  totalfaedah TEXT,
  hargajual TEXT,
  payloadjson TEXT,
  userinput TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.cost_structure ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public all access on cost_structure" ON public.cost_structure
  FOR ALL USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- Table: jamaah (Source: Sheet "Data Jamaah")
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS public.jamaah CASCADE;

CREATE TABLE public.jamaah (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  id_jamaah TEXT,
  timestamp TEXT,
  referensi TEXT,
  nama_lengkap TEXT,
  nama_ayah_kandung TEXT,
  tempat_lahir TEXT,
  tanggal_lahir TEXT,
  jenis_kelamin TEXT,
  alamat_ktp TEXT,
  kelurahan_desa TEXT,
  kecamatan TEXT,
  kabupaten_kota TEXT,
  provinsi TEXT,
  kode_pos TEXT,
  nomor_ktp TEXT,
  nomor_seluler TEXT,
  nomor_telepon_rumah TEXT,
  nomor_seluler_keluarga TEXT,
  email_address TEXT,
  pendidikan_terakhir TEXT,
  pekerjaan TEXT,
  nomor_passport TEXT,
  tempat_dikeluarkan_paspor TEXT,
  tanggal_dikeluarkan_paspor TEXT,
  tanggal_berakhir_paspor TEXT,
  jenis_paket_umrah TEXT,
  tanggal_keberangkatan TEXT,
  cara_pembayaran TEXT,
  ukuran_baju TEXT,
  kantor_cabang TEXT,
  upload_ktp TEXT,
  upload_pasport TEXT,
  buku_nikah TEXT,
  surat_nikah TEXT,
  foto_jamaah TEXT,
  kartu_keluarga TEXT,
  upload_bukti_transfer TEXT,
  tanggal_daftar TEXT,
  tipe_kamar TEXT,
  harga_paket TEXT,
  potongan TEXT,
  voucher TEXT,
  jumlah_harus_dibayar TEXT,
  hotel_makkah TEXT,
  no_kamar_makkah TEXT,
  hotel_madinah TEXT,
  no_kamar_madinah TEXT,
  status_jamaah TEXT,
  createdat TEXT,
  updatedat TEXT,
  user_input TEXT,
  namaagen TEXT,
  notelp TEXT,
  faedah TEXT,
  bank TEXT,
  norekening TEXT,
  tanggalkirim TEXT,
  nojurnalerahajj TEXT,
  catatan TEXT,
  status_pernikahan TEXT,
  titel TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.jamaah ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public all access on jamaah" ON public.jamaah
  FOR ALL USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- Table: history_pembayaran (Source: Sheet "History Pembayaran")
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS public.history_pembayaran CASCADE;

CREATE TABLE public.history_pembayaran (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  id_kwitansi TEXT,
  timestamp TEXT,
  id_jamaah TEXT,
  nama_jamaah TEXT,
  nomor_ktp TEXT,
  jenis_paket TEXT,
  jumlah_pembayaran TEXT,
  tipe_pembayaran TEXT,
  metode_pembayaran TEXT,
  nama_bank TEXT,
  nomor_referensi TEXT,
  keterangan TEXT,
  tanggal_bayar TEXT,
  user_input TEXT,
  status TEXT,
  linkbuktitransfer TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.history_pembayaran ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public all access on history_pembayaran" ON public.history_pembayaran
  FOR ALL USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- Table: data_paket (Source: Sheet "Data Paket")
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS public.data_paket CASCADE;

CREATE TABLE public.data_paket (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  id_jamaah TEXT,
  timestamp TEXT,
  referensi TEXT,
  nama_lengkap TEXT,
  nama_ayah_kandung TEXT,
  tempat_lahir TEXT,
  tanggal_lahir TEXT,
  jenis_kelamin TEXT,
  alamat_ktp TEXT,
  kelurahan_desa TEXT,
  kecamatan TEXT,
  kabupaten_kota TEXT,
  provinsi TEXT,
  kode_pos TEXT,
  nomor_ktp TEXT,
  nomor_seluler TEXT,
  nomor_telepon_rumah TEXT,
  nomor_seluler_keluarga TEXT,
  email_address TEXT,
  pendidikan_terakhir TEXT,
  pekerjaan TEXT,
  nomor_passport TEXT,
  tempat_dikeluarkan_paspor TEXT,
  tanggal_dikeluarkan_paspor TEXT,
  tanggal_berakhir_paspor TEXT,
  jenis_paket_umrah TEXT,
  tanggal_keberangkatan TEXT,
  cara_pembayaran TEXT,
  ukuran_baju TEXT,
  kantor_cabang TEXT,
  upload_ktp TEXT,
  upload_pasport TEXT,
  buku_nikah TEXT,
  surat_nikah TEXT,
  foto_jamaah TEXT,
  kartu_keluarga TEXT,
  upload_bukti_transfer TEXT,
  tanggal_daftar TEXT,
  tipe_kamar TEXT,
  harga_paket TEXT,
  potongan TEXT,
  voucher TEXT,
  jumlah_harus_dibayar TEXT,
  hotel_makkah TEXT,
  no_kamar_makkah TEXT,
  hotel_madinah TEXT,
  no_kamar_madinah TEXT,
  status_jamaah TEXT,
  createdat TEXT,
  updatedat TEXT,
  user_input TEXT,
  namaagen TEXT,
  notelp TEXT,
  faedah TEXT,
  bank TEXT,
  norekening TEXT,
  tanggalkirim TEXT,
  nojurnalerahajj TEXT,
  catatan TEXT,
  status_pernikahan TEXT,
  titel TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.data_paket ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public all access on data_paket" ON public.data_paket
  FOR ALL USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- Table: cuti_karyawan (Source: Sheet "CutiKaryawan")
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS public.cuti_karyawan CASCADE;

CREATE TABLE public.cuti_karyawan (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cutiid TEXT,
  tanggalpengajuan TEXT,
  nik TEXT,
  namakaryawan TEXT,
  jabatan TEXT,
  tipecuti TEXT,
  tanggalmulai TEXT,
  tanggalselesai TEXT,
  jumlahhari TEXT,
  keterangan TEXT,
  statusapproval TEXT,
  approvedby TEXT,
  approvedat TEXT,
  catatanapproval TEXT,
  createdat TEXT,
  linkdokumen TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.cuti_karyawan ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public all access on cuti_karyawan" ON public.cuti_karyawan
  FOR ALL USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- Table: cuti_bersama (Source: Sheet "CutiBersama")
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS public.cuti_bersama CASCADE;

CREATE TABLE public.cuti_bersama (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  id_1 TEXT,
  tahun TEXT,
  tanggal TEXT,
  namaharilibur TEXT,
  jumlahhari TEXT,
  potongcutitahunan TEXT,
  status TEXT,
  keterangan TEXT,
  createdat TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.cuti_bersama ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public all access on cuti_bersama" ON public.cuti_bersama
  FOR ALL USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- Table: entry_angsuran_haji (Source: Sheet "EntryAngsuranHaji")
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS public.entry_angsuran_haji CASCADE;

CREATE TABLE public.entry_angsuran_haji (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  timestamp TEXT,
  id_1 TEXT,
  nojurnal TEXT,
  idjamaah TEXT,
  nobpih TEXT,
  namanasabah TEXT,
  bank TEXT,
  uraian TEXT,
  jumlah TEXT,
  nilaikurs TEXT,
  user_entry TEXT,
  tanggal TEXT,
  metodepembayaran TEXT,
  status TEXT,
  createdat TEXT,
  typehaji TEXT,
  nohp TEXT,
  linkdokumen TEXT,
  nojurnalerahajj TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.entry_angsuran_haji ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public all access on entry_angsuran_haji" ON public.entry_angsuran_haji
  FOR ALL USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- Table: data_jamaah_haji (Source: Sheet "DataJamaahHaji")
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS public.data_jamaah_haji CASCADE;

CREATE TABLE public.data_jamaah_haji (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  timestamp TEXT,
  idjamaah TEXT,
  nobpih TEXT,
  nama TEXT,
  bulanpendaftaran TEXT,
  nohp TEXT,
  jenishaji TEXT,
  banksetorawal TEXT,
  createdat TEXT,
  updatedat TEXT,
  bpjs TEXT,
  buktiangsuran TEXT,
  buktisetor TEXT,
  buktitransfer TEXT,
  kartukeluarga TEXT,
  ktp TEXT,
  paspor TEXT,
  spph TEXT,
  foto TEXT,
  bukunikah TEXT,
  visa TEXT,
  tasreh TEXT,
  bpihlunas TEXT,
  doclain TEXT,
  noktp TEXT,
  namaortu TEXT,
  tempatlahir TEXT,
  tanggallahir TEXT,
  umur TEXT,
  jeniskelamin TEXT,
  kewarganegaraan TEXT,
  alamat TEXT,
  desakel TEXT,
  kecamatan TEXT,
  kabkot TEXT,
  kabkota TEXT,
  provinsi TEXT,
  nmprovinsi TEXT,
  kodepos TEXT,
  pendidikan TEXT,
  pekerjaan TEXT,
  pergihaji TEXT,
  mahram TEXT,
  hubmahram TEXT,
  nopendaftaran TEXT,
  goldarah TEXT,
  statusnikah TEXT,
  tglspph TEXT,
  pin TEXT,
  travel TEXT,
  telp TEXT,
  statusbpih TEXT,
  nospph TEXT,
  bank TEXT,
  tglinput TEXT,
  tgllunas TEXT,
  hargabpih TEXT,
  dpangsuran TEXT,
  blangsuran TEXT,
  tinggi TEXT,
  alis TEXT,
  hidung TEXT,
  berat TEXT,
  rw TEXT,
  muka TEXT,
  rt TEXT,
  kode_diagnosis TEXT,
  rambut TEXT,
  nodaftarmahram TEXT,
  nomor_jurnal_erahhajj TEXT,
  faedah_rupiah TEXT,
  diskon_usd TEXT,
  kurs_paket TEXT,
  tipe_kamar TEXT,
  tanggal_bayar_agen TEXT,
  nama_paket_haji TEXT,
  diskon_rupiah TEXT,
  harga_usd TEXT,
  catatan_paket TEXT,
  harga_rupiah TEXT,
  total_harga_usd TEXT,
  bank_agen TEXT,
  total_harga_rupiah TEXT,
  nama_agen TEXT,
  no_hp_agen TEXT,
  faedah_usd TEXT,
  catatan_agen TEXT,
  noporsi TEXT,
  namajamaah TEXT,
  statushaji TEXT,
  kanwil TEXT,
  downpayment TEXT,
  nomor_rekening_agent TEXT,
  estimasiberangkat TEXT,
  tglestimasi TEXT,
  doc TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.data_jamaah_haji ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public all access on data_jamaah_haji" ON public.data_jamaah_haji
  FOR ALL USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- Table: view_hajj_data (Source: Sheet "ViewHajjData")
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS public.view_hajj_data CASCADE;

CREATE TABLE public.view_hajj_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  id_jamaah TEXT,
  timestamp TEXT,
  referensi TEXT,
  nama_lengkap TEXT,
  nama_ayah_kandung TEXT,
  tempat_lahir TEXT,
  tanggal_lahir TEXT,
  jenis_kelamin TEXT,
  alamat_ktp TEXT,
  kelurahan_desa TEXT,
  kecamatan TEXT,
  kabupaten_kota TEXT,
  provinsi TEXT,
  kode_pos TEXT,
  nomor_ktp TEXT,
  nomor_seluler TEXT,
  nomor_telepon_rumah TEXT,
  nomor_seluler_keluarga TEXT,
  email_address TEXT,
  pendidikan_terakhir TEXT,
  pekerjaan TEXT,
  nomor_passport TEXT,
  tempat_dikeluarkan_paspor TEXT,
  tanggal_dikeluarkan_paspor TEXT,
  tanggal_berakhir_paspor TEXT,
  jenis_paket_umrah TEXT,
  tanggal_keberangkatan TEXT,
  cara_pembayaran TEXT,
  ukuran_baju TEXT,
  kantor_cabang TEXT,
  upload_ktp TEXT,
  upload_pasport TEXT,
  buku_nikah TEXT,
  surat_nikah TEXT,
  foto_jamaah TEXT,
  kartu_keluarga TEXT,
  upload_bukti_transfer TEXT,
  tanggal_daftar TEXT,
  tipe_kamar TEXT,
  harga_paket TEXT,
  potongan TEXT,
  voucher TEXT,
  jumlah_harus_dibayar TEXT,
  hotel_makkah TEXT,
  no_kamar_makkah TEXT,
  hotel_madinah TEXT,
  no_kamar_madinah TEXT,
  status_jamaah TEXT,
  createdat TEXT,
  updatedat TEXT,
  user_input TEXT,
  namaagen TEXT,
  notelp TEXT,
  faedah TEXT,
  bank TEXT,
  norekening TEXT,
  tanggalkirim TEXT,
  nojurnalerahajj TEXT,
  catatan TEXT,
  status_pernikahan TEXT,
  titel TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.view_hajj_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public all access on view_hajj_data" ON public.view_hajj_data
  FOR ALL USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- Table: upload_dok_haji (Source: Sheet "UploadDokHaji")
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS public.upload_dok_haji CASCADE;

CREATE TABLE public.upload_dok_haji (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  docid TEXT,
  timestamp TEXT,
  nobpih TEXT,
  nama TEXT,
  jenis_dokumen TEXT,
  nama_file TEXT,
  link_file TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.upload_dok_haji ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public all access on upload_dok_haji" ON public.upload_dok_haji
  FOR ALL USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- Table: update_bipih (Source: Sheet "UpdateBIPIH")
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS public.update_bipih CASCADE;

CREATE TABLE public.update_bipih (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nobpih TEXT,
  namajamaah TEXT,
  tanggalpelunasan TEXT,
  tahunlunashijriah TEXT,
  buktisetorlunas TEXT,
  statuspk TEXT,
  tanggalpk TEXT,
  statuspk2 TEXT,
  tanggalpk2 TEXT,
  bank TEXT,
  nojurnal TEXT,
  bankterimapk TEXT,
  uploaddokumenpk TEXT,
  tgltunda TEXT,
  buktitransfertunda TEXT,
  user_entry TEXT,
  timestamp TEXT,
  idtransaksi TEXT,
  hargapakethaji TEXT,
  kurs TEXT,
  tipekamar TEXT,
  tglterimanilaimanfaat TEXT,
  banknilaimanfaat TEXT,
  jumlahusdnilaimanfaat TEXT,
  kursnilaimanfaat TEXT,
  nojurnalnilaimanfaat TEXT,
  ketnilaimanfaat TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.update_bipih ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public all access on update_bipih" ON public.update_bipih
  FOR ALL USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- Table: mahram (Source: Sheet "Mahram")
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS public.mahram CASCADE;

CREATE TABLE public.mahram (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nobpih TEXT,
  nama TEXT,
  hubungan TEXT,
  kodemahram TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.mahram ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public all access on mahram" ON public.mahram
  FOR ALL USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- Table: kelengkapan_umrah (Source: Sheet "KelengkapanUmrah")
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS public.kelengkapan_umrah CASCADE;

CREATE TABLE public.kelengkapan_umrah (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  id_kelengkapan TEXT,
  id_jamaah TEXT,
  nama_jamaah TEXT,
  nama_paket TEXT,
  agent TEXT,
  no_visa TEXT,
  tanggal_berlaku_visa TEXT,
  tanggal_akhir_visa TEXT,
  no_polis TEXT,
  tanggal_input_polis TEXT,
  tanggal_awal_polis TEXT,
  tanggal_akhir_polis TEXT,
  nomor_bpjs TEXT,
  status_kelengkapan TEXT,
  tanggal_input TEXT,
  createdat TEXT,
  updatedat TEXT,
  user_input TEXT,
  upload_visa TEXT,
  upload_asuransi TEXT,
  upload_bpjs TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.kelengkapan_umrah ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public all access on kelengkapan_umrah" ON public.kelengkapan_umrah
  FOR ALL USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- Table: absensi 
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS public.absensi CASCADE;

CREATE TABLE public.absensi (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT,
  nama TEXT,
  tanggal DATE,
  jam TIME,
  status TEXT,
  lokasi TEXT,
  foto_wajah TEXT,
  catatan TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.absensi ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public all access on absensi" ON public.absensi
  FOR ALL USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- GLOBAL SCHEMA PERMISSIONS
-- ----------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

