import "./LoadingScreen.css";

export default function LoadingScreen() {
  return (
    <main className="loading-screen" role="status" aria-live="polite" aria-label="Sedang menyiapkan halaman">
      <div className="loading-screen-orb loading-screen-orb-top" aria-hidden="true" />
      <div className="loading-screen-orb loading-screen-orb-bottom" aria-hidden="true" />

      <section className="loading-screen-content">
        <div className="loading-screen-brand">
          <img
            className="loading-screen-logo"
            src={`${import.meta.env.BASE_URL}favicon.svg`}
            alt=""
            width="64"
            height="64"
          />
          <span>Daily Worklog</span>
        </div>

        <div className="loading-screen-indicator" aria-hidden="true">
          <span />
        </div>
        <p>Sedang menyiapkan halaman...</p>
      </section>
    </main>
  );
}
