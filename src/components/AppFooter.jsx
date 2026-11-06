export default function AppFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <p>© {new Date().getFullYear()} Worklog ConsultanIT by AHMAD SELO ABADI</p>
        <p>Catat kerja, kelola laporan, dan SEMANGAT PAGI.</p>
        <nav className="site-footer-legal" aria-label="Informasi hukum">
          <a href="/privacy-policy">Kebijakan Privasi</a>
          <a href="/terms-of-service">Ketentuan Layanan</a>
        </nav>
      </div>
    </footer>
  );
}
