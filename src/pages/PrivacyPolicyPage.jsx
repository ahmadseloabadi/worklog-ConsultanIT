import LegalPageLayout from "@/components/LegalPageLayout";

export default function PrivacyPolicyPage() {
  return (
    <LegalPageLayout
      title={<>Kebijakan <em>Privasi.</em></>}
      description="Informasi tentang data yang digunakan Daily Worklog dan pilihan yang Anda miliki."
    >
      <p>
        Kebijakan ini menjelaskan cara Daily Worklog, yang dikelola oleh AHMAD SELO ABADI,
        menggunakan informasi ketika Anda memakai aplikasi. Aplikasi berjalan di browser dan
        menghubungkan akun Google Anda langsung ke layanan Google yang diperlukan untuk fitur
        yang Anda pilih. Daily Worklog tidak mengoperasikan server untuk menyimpan data laporan.
      </p>

      <h2>Informasi yang digunakan</h2>
      <ul>
        <li>
          <strong>Informasi akun Google:</strong> nama, alamat email, dan foto profil untuk
          menampilkan status akun serta mengaitkan aktivitas dengan akun yang sedang masuk.
        </li>
        <li>
          <strong>Laporan kerja dan template:</strong> isi laporan yang Anda buat, seperti nama
          aplikasi, menu, tanggal, permasalahan, solusi, keterangan, serta template yang Anda simpan.
        </li>
        <li>
          <strong>File bukti:</strong> gambar yang Anda pilih untuk dilampirkan pada laporan.
          Aplikasi mengunggahnya ke folder Google Drive yang Anda konfigurasi.
        </li>
        <li>
          <strong>Skor mini game:</strong> nama pengguna, alamat email Google, skor, nama permainan,
          mode, dan waktu pembaruan untuk menyimpan serta menampilkan leaderboard.
        </li>
        <li>
          <strong>Pengaturan dan draft lokal:</strong> pengaturan koneksi Google dan draft laporan
          yang belum dikirim disimpan di penyimpanan browser pada perangkat Anda.
        </li>
      </ul>

      <h2>Tempat data disimpan dan dibagikan</h2>
      <p>
        Laporan dan template disimpan pada spreadsheet Google Sheets yang Anda pilih. File bukti
        disimpan di folder Google Drive yang Anda pilih. Untuk menampilkan tautan bukti pada laporan,
        aplikasi mengatur file gambar tersebut agar dapat dilihat oleh siapa pun yang memiliki
        tautannya. Jangan unggah gambar rahasia atau sensitif ke fitur ini, dan tinjau pengaturan
        berbagi Drive Anda.
      </p>
      <p>
        Skor mini game disimpan pada spreadsheet leaderboard yang digunakan aplikasi. Alamat email
        dipakai untuk mengenali skor milik pemain; tampilan leaderboard menggunakan bagian nama
        pengguna sebelum tanda @. Data pada spreadsheet mengikuti izin akses Google yang berlaku
        untuk spreadsheet tersebut.
      </p>
      <p>
        Daily Worklog tidak menjual atau menggunakan data Google untuk iklan. Data Google hanya
        digunakan untuk menyediakan fitur yang Anda minta, dan tidak digunakan untuk menentukan
        kelayakan kredit, pinjaman, atau tujuan yang dilarang oleh kebijakan Google. Data tersebut
        tidak digunakan untuk melatih model kecerdasan buatan.
      </p>

      <h2>Akses Google dan penyimpanan pada browser</h2>
      <p>
        Saat Anda masuk, Google meminta izin untuk identitas dasar akun, Google Sheets, dan Google
        Drive. Izin ini digunakan untuk memeriksa akses ke spreadsheet atau folder yang Anda
        konfigurasi, membaca dan memperbarui data yang dipakai aplikasi, serta mengelola file bukti.
        Aplikasi mengakses Google API dari browser Anda menggunakan sesi Google dan tidak menerima
        kata sandi akun Google Anda.
      </p>
      <p>
        Draft dan template tersimpan di IndexedDB browser. Pengaturan dan informasi profil disimpan
        di penyimpanan lokal browser, sedangkan token akses sementara disimpan di penyimpanan sesi.
        Data lokal tetap ada sampai Anda menghapusnya melalui aplikasi atau pengaturan browser.
        Keluar dari akun menghapus sesi lokal, tetapi tidak menghapus draft, pengaturan, laporan,
        file Drive, atau skor yang sudah tersimpan.
      </p>

      <h2>Penyedia layanan dan keamanan</h2>
      <p>
        Google menyediakan proses masuk serta layanan Sheets dan Drive. Penggunaan layanan Google
        tunduk pada kebijakan privasi Google. Karena pemrosesan dilakukan di browser dan layanan
        Google, keamanan dan pembagian data juga bergantung pada keamanan perangkat, akun Google,
        spreadsheet, dan folder Drive Anda. Gunakan perangkat tepercaya dan jangan membagikan tautan
        file atau spreadsheet kepada pihak yang tidak Anda kehendaki.
      </p>

      <h2>Retensi dan penghapusan</h2>
      <p>
        Data di Google Sheets dan Google Drive tetap tersimpan sampai Anda menghapus atau mengubahnya
        di layanan tersebut. Draft dan pengaturan lokal dapat dihapus dari browser atau melalui
        pengaturan penyimpanan browser. Untuk mencabut akses aplikasi, hapus akses Daily Worklog dari
        pengaturan keamanan akun Google Anda. Pencabutan akses tidak otomatis menghapus data yang
        telah tersimpan di Sheets atau Drive.
      </p>

      <h2>Privasi anak dan perubahan kebijakan</h2>
      <p>
        Aplikasi ini ditujukan untuk pencatatan kerja dan tidak dirancang khusus untuk anak-anak.
        Kebijakan ini dapat diperbarui apabila fitur atau praktik data berubah. Versi terbaru selalu
        tersedia pada halaman ini.
      </p>
    </LegalPageLayout>
  );
}
