import LegalPageLayout from "@/components/LegalPageLayout";

export default function TermsOfServicePage() {
  return (
    <LegalPageLayout
      title={<>Ketentuan <em>Layanan.</em></>}
      description="Ketentuan penggunaan Daily Worklog."
    >
      <p>
        Dengan mengakses atau menggunakan Daily Worklog, Anda menyetujui ketentuan ini. Jika Anda
        tidak menyetujuinya, hentikan penggunaan aplikasi. Daily Worklog dikelola oleh AHMAD SELO
        ABADI dan disediakan sebagai alat bantu pencatatan aktivitas kerja.
      </p>

      <h2>Penggunaan aplikasi</h2>
      <ul>
        <li>Anda bertanggung jawab atas kebenaran, kelengkapan, dan kepatutan data yang dimasukkan.</li>
        <li>
          Anda hanya boleh menghubungkan spreadsheet dan folder Drive yang Anda miliki atau yang
          penggunaannya telah diizinkan kepada Anda.
        </li>
        <li>
          Jangan menggunakan aplikasi untuk melanggar hukum, mengganggu layanan, mengakses data
          tanpa izin, atau mengunggah konten yang melanggar hak orang lain.
        </li>
        <li>
          Anda bertanggung jawab memastikan bahwa Anda memiliki hak dan izin untuk menyimpan,
          memproses, atau membagikan setiap laporan dan file yang Anda unggah.
        </li>
      </ul>

      <h2>Akun Google dan konten pengguna</h2>
      <p>
        Fitur sinkronisasi memerlukan akun Google dan izin yang relevan untuk Google Sheets dan
        Google Drive. Anda bertanggung jawab menjaga keamanan akun dan perangkat. Konten yang Anda
        buat tetap berada di spreadsheet atau folder Drive yang Anda pilih, dengan izin akses yang
        diatur pada layanan Google tersebut.
      </p>
      <p>
        Gambar bukti yang dilampirkan pada laporan dapat diatur agar dapat dilihat oleh siapa pun
        yang memiliki tautannya. Pastikan Anda tidak mengunggah materi yang tidak boleh dibagikan
        dengan cara tersebut.
      </p>

      <h2>Dokumen dan konversi</h2>
      <p>
        Fitur Dokumen Tools memproses file di browser. Beberapa konversi hanya mempertahankan teks
        dan tidak mempertahankan tata letak, gambar, tabel, atau format asli. Kompres PDF dapat
        meraster halaman sehingga teks hasilnya tidak dapat dipilih. Selalu periksa hasil dan simpan
        salinan file asli sebelum memproses dokumen penting.
      </p>

      <h2>Leaderboard</h2>
      <p>
        Jika Anda masuk dan menyimpan skor mini game, skor, nama permainan, mode, waktu pembaruan,
        nama pengguna, dan alamat email Google akan disimpan pada spreadsheet leaderboard. Jangan
        menggunakan fitur ini jika Anda tidak setuju dengan penyimpanan tersebut.
      </p>

      <h2>Ketersediaan dan batas tanggung jawab</h2>
      <p>
        Layanan disediakan sebagaimana adanya dan dapat berubah, terganggu, atau tidak tersedia
        sewaktu-waktu, termasuk karena gangguan browser atau layanan Google. Kami tidak menjamin
        aplikasi selalu bebas kesalahan atau bahwa data dapat dipulihkan. Sejauh diizinkan oleh
        hukum yang berlaku, AHMAD SELO ABADI tidak bertanggung jawab atas kehilangan data, gangguan
        layanan pihak ketiga, atau kerugian yang timbul dari penggunaan aplikasi. Anda dianjurkan
        untuk menyimpan cadangan data penting.
      </p>

      <h2>Perubahan dan penghentian</h2>
      <p>
        Fitur atau ketentuan ini dapat diperbarui dari waktu ke waktu. Ketentuan terbaru akan
        dipublikasikan di halaman ini dan berlaku sejak diperbarui. Penggunaan berkelanjutan setelah
        perubahan berarti Anda menerima ketentuan yang diperbarui. Anda dapat berhenti menggunakan
        aplikasi dan mencabut izinnya kapan saja melalui pengaturan akun Google.
      </p>

      <h2>Hukum yang berlaku</h2>
      <p>
        Ketentuan ini ditafsirkan berdasarkan hukum yang berlaku. Jika ada bagian yang tidak dapat
        diberlakukan, bagian lainnya tetap berlaku sepanjang diperbolehkan oleh hukum.
      </p>
    </LegalPageLayout>
  );
}
