# Daily Worklog (Vite)

Aplikasi web ringan untuk mencatat dan memantau laporan kerja harian/mingguan langsung ke Google Sheets,
dengan upload bukti gambar (paste dari clipboard) ke Google Drive.

Versi ini berjalan **sepenuhnya di browser** (React + Vite, tanpa server). Browser berbicara langsung ke
Google Sheets/Drive API memakai akun Google yang login, sehingga bisa di-hosting gratis di Vercel maupun GitHub Pages.

## Fitur

- Form catat aktivitas, draft & template lokal (IndexedDB), kirim batch sampai 100 laporan
- Sheet bulanan otomatis (`Oktober_2026`, dst., atau duplikat dari tab `CONTOH` bila ada), disisipkan kronologis
- Dashboard, Kelola Laporan (edit, hapus, filter), dan "Cari & rapikan data serupa"
- Tanggal pekerjaan otomatis mengikuti hari ini, dapat diubah, dan laporan tertunda dapat dipantau dari halaman catatan aktivitas
- Navigasi sidebar responsif yang dapat diringkas, dengan menu Aktivitas terpisah untuk input dan tindak lanjut; badge jumlah draft dan laporan tertunda di-cache singkat agar perpindahan halaman tetap ringan
- Upload bukti gambar ke Drive dan pratinjau di detail laporan
- Setup Google per akun (link spreadsheet + folder Drive) dan pemeriksa token

Kolom sheet (urutan tetap):
`No | Nama Aplikasi & Daerah | Menu | Tgl Mulai | Permasalahan yang Dihadapi | Solusi | Tgl Selesai | Keterangan`

Status laporan mengikuti kolom `Tgl Selesai`: tanggal terisi berarti **Selesai**, sedangkan tanggal kosong berarti **Tertunda**. Format spreadsheet tetap menggunakan delapan kolom.

## 1. Setup Google Cloud

1. Di [Google Cloud Console](https://console.cloud.google.com/) aktifkan **Google Sheets API** dan **Google Drive API**.
2. Google Auth Platform → Audience: bila status **Testing**, tambahkan akun Google Anda di **Test users**.
3. Buat/ubah **OAuth Client** bertipe **Web application**. Isi **Authorized JavaScript origins**:
   - `http://localhost:3000` (pengembangan lokal)
   - `https://nama-proyek.vercel.app` dan/atau `https://username.github.io` (produksi)

   Redirect URI dan Client Secret **tidak diperlukan** di versi ini. Client ID lama boleh dipakai ulang.
4. Salin Client ID.

## 2. Jalankan lokal

```bash
npm install
cp .env.example .env      # isi VITE_GOOGLE_CLIENT_ID
npm run dev               # http://localhost:3000
```

Lalu buka menu **Setup Google**, tempel link spreadsheet dan folder Drive, tekan **Simpan setup**.

## 3. Deploy gratis

**Vercel**: import repository, framework terdeteksi otomatis (Vite). Tambahkan Environment Variable
`VITE_GOOGLE_CLIENT_ID` (dan `VITE_ALLOWED_EMAIL_DOMAIN` bila perlu), lalu Deploy. `vercel.json` sudah mengatur
fallback SPA dan cache aset.

**GitHub Pages**: push ke branch `main`. Di repository: Settings → Pages → Source = **GitHub Actions**, lalu
Settings → Secrets and variables → Actions → **Variables** → tambah `VITE_GOOGLE_CLIENT_ID`. Workflow
`.github/workflows/deploy.yml` akan build dan publish. (Paket gratis GitHub Pages memerlukan repository publik.)

Tambahkan URL hasil deploy ke **Authorized JavaScript origins** (langkah 1).

## Catatan penting

- **Sesi Google ±1 jam.** Tanpa server tidak ada refresh token. Saat token habis, aplikasi mencoba memperbarui
  diam-diam setelah Anda mengklik sesuatu; bila gagal, tombol **Sambungkan ulang** muncul di header.
  Pengiriman otomatis terjadwal hanya berhasil selama token masih aktif; draft yang gagal tetap aman di antrean.
- **Data lokal terikat origin.** Draft, template, dan setup tersimpan di browser per alamat situs. Di alamat baru
  (mis. domain Vercel) semuanya mulai kosong. Kirim draft yang masih tertunda dari aplikasi lama lebih dulu.
- **Jangan commit kredensial.** `.gitignore` sudah memblokir `.env*` dan file kunci service account.
  Client ID bersifat publik; keamanan data dijaga oleh izin Google pada spreadsheet dan folder.
- Scope `drive` penuh dipakai agar folder dan spreadsheet yang sudah ada bisa diakses. Untuk pemakaian pribadi,
  biarkan status Testing dan daftarkan akun sebagai test user.

## Struktur

```
src/
  lib/auth.js           login Google (Identity Services) + useSession/signIn/signOut
  lib/googleClient.js   klien REST Sheets/Drive dengan Bearer token
  lib/googleSheets.js   logika sheet bulanan, sisip kronologis, edit, hapus, samakan data
  lib/googleDrive.js    upload bukti & pratinjau gambar
  lib/api.js            validasi + router (pengganti folder app/api Next.js)
  components/, pages/   UI (komponen asli, diadaptasi ke react-router)
```
