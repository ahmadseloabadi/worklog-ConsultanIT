import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import AppFooter from "@/components/AppFooter";
import AppHeader from "@/components/AppHeader";

export default function LegalPageLayout({ title, description, children }) {
  const { pathname } = useLocation();
  const documentTitle = pathname === "/privacy-policy" ? "Kebijakan Privasi" : "Ketentuan Layanan";

  useEffect(() => {
    document.title = `${documentTitle} | Daily Worklog`;
  }, [documentTitle]);

  return (
    <main className="app-shell">
      <AppHeader />
      <div className="page-content legal-page">
        <section className="page-intro">
          <div>
            <p className="page-eyebrow"><span />Daily Worklog</p>
            <h1>{title}</h1>
            <p className="page-subtitle">{description}</p>
          </div>
        </section>
        <article className="legal-document">
          <p className="legal-updated">Terakhir diperbarui: 6 November 2026</p>
          {children}
          <p className="legal-contact">
            Pertanyaan? Hubungi <a href="mailto:ahmadseloabadi.work@gmail.com">ahmadseloabadi.work@gmail.com</a>.
          </p>
          <nav className="legal-related-links" aria-label="Dokumen hukum lainnya">
            <Link to="/privacy-policy">Kebijakan Privasi</Link>
            <Link to="/terms-of-service">Ketentuan Layanan</Link>
          </nav>
        </article>
      </div>
      <AppFooter />
    </main>
  );
}
