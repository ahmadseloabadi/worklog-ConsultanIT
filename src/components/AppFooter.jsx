import { Link } from "react-router-dom";

export default function AppFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <p>© {new Date().getFullYear()} Worklog ConsultanIT by AHMAD SELO ABADI</p>
        <p>Catat kerja, kelola laporan, dan SEMANGAT PAGI.</p>
        <nav className="site-footer-legal" aria-label="Informasi hukum">
          <Link to="/privacy-policy">Kebijakan Privasi</Link>
          <Link to="/terms-of-service">Ketentuan Layanan</Link>
        </nav>
      </div>
    </footer>
  );
}
