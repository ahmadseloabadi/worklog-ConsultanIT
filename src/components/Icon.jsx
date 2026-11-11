const iconContent = {
  workspace: (
    <>
      <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
      <path d="M3 10h18" />
    </>
  ),
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
    </>
  ),
  activity: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </>
  ),
  notes: (
    <>
      <path d="M5 3h11l4 4v14H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
      <path d="M15 3v5h5M8 12h8M8 16h6" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18m-13 4h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  reports: (
    <>
      <path d="M8 6h13M8 12h13M8 18h13" />
      <path d="M3 6h.01M3 12h.01M3 18h.01" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v12m-5-5 5 5 5-5" />
      <path d="M5 17v3h14v-3" />
    </>
  ),
  documents: (
    <>
      <path d="M7 3h7l5 5v13H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
      <path d="M14 3v5h5M9 13h6m-6 4h6" />
      <path d="M3 7v14a2 2 0 0 0 2 2h12" />
    </>
  ),
  mergePdf: (
    <>
      <path d="M5 4h8l4 4v5M5 4v16h6" />
      <path d="M13 4v4h4M9 10h4M9 13h2" />
      <path d="M15 13v8m-4-4h8" />
    </>
  ),
  splitPdf: (
    <>
      <path d="M5 3h8l4 4v4M5 3v18h6" />
      <path d="M13 3v4h4M8 11h3M8 14h2" />
      <path d="m14 13 3 3-3 3m6-6-3 3 3 3" />
    </>
  ),
  compressPdf: (
    <>
      <path d="M5 3h8l4 4v3M5 3v18h6M13 3v4h4" />
      <path d="M8 11h4m-4 3h3" />
      <path d="M15 13v6m-2-2 2 2 2-2m4-4v6m-2-2 2 2 2-2" />
    </>
  ),
  imageFile: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9" r="1.5" />
      <path d="m21 15-5-5L5 20" />
    </>
  ),
  pdfToWord: (
    <>
      <path d="M4 3h9l4 4v5M4 3v18h7M13 3v4h4" />
      <path d="M7 11h5M7 14h3" />
      <path d="M14 15h7m-6 0 2 6 2-6" />
    </>
  ),
  wordToPdf: (
    <>
      <path d="M4 3h9l4 4v5M4 3v18h7M13 3v4h4" />
      <path d="M7 11h5M7 14h3" />
      <path d="M14 16h7m-5-2-2 2 2 2" />
    </>
  ),
  gamepad: (
    <>
      <path d="M6.5 8h11a4.5 4.5 0 0 1 4.35 5.65l-.8 3A2.8 2.8 0 0 1 16 18l-2.5-2h-3L8 18a2.8 2.8 0 0 1-5.05-1.35l-.8-3A4.5 4.5 0 0 1 6.5 8Z" />
      <path d="M7 11v4m-2-2h4m6-1h.01M18 14h.01" />
    </>
  ),
  pause: (
    <>
      <path d="M9 5H6v14h3zM18 5h-3v14h3z" />
    </>
  ),
  play: <path d="m8 5 12 7-12 7V5Z" />,
  crown: (
    <>
      <path d="m3 8 5 4 4-7 4 7 5-4-2 12H5L3 8Z" />
      <path d="M5 17h14" />
      <circle cx="3" cy="7" r="1" />
      <circle cx="12" cy="4" r="1" />
      <circle cx="21" cy="7" r="1" />
    </>
  ),
  arrowLeft: <path d="m14 18-6-6 6-6M8 12h13" />,
  fullscreen: (
    <>
      <path d="M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3m13-5v3a2 2 0 0 1-2 2h-3" />
    </>
  ),
  fullscreenExit: (
    <>
      <path d="M8 3v3a2 2 0 0 1-2 2H3m13-5v3a2 2 0 0 0 2 2h3M3 16h3a2 2 0 0 1 2 2v3m13-5h-3a2 2 0 0 0-2 2v3" />
    </>
  ),
  volume: (
    <>
      <path d="M11 5 6 9H3v6h3l5 4V5Z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7m3-10a9 9 0 0 1 0 13" />
    </>
  ),
  volumeOff: (
    <>
      <path d="M11 5 6 9H3v6h3l5 4V5Z" />
      <path d="m17 9 5 6m0-6-5 6" />
    </>
  ),
  settings: (
    <>
      <path d="M9.5 3h5l.6 2.4a8 8 0 0 1 1.2.7l2.3-.8 2.5 4.3-1.8 1.7a8 8 0 0 1 0 1.4l1.8 1.7-2.5 4.3-2.3-.8a8 8 0 0 1-1.2.7l-.6 2.4h-5l-.6-2.4a8 8 0 0 1-1.2-.7l-2.3.8-2.5-4.3 1.8-1.7a8 8 0 0 1 0-1.4l-1.8-1.7 2.5-4.3 2.3.8a8 8 0 0 1 1.2-.7L9.5 3Z" />
      <circle cx="12" cy="12" r="2.7" />
    </>
  ),
  googleDrive: (
    <>
      <path d="M8.1 3h6.2L6.2 17H0L8.1 3Z" fill="#4285F4" stroke="none" />
      <path d="M6.2 17h17.3l-3.5 5H3.3l2.9-5Z" fill="#34A853" stroke="none" />
      <path d="M14.3 3h6.1L24 17h-6.1L14.3 3Z" fill="#FBBC04" stroke="none" />
    </>
  ),
  chevronDown: <path d="m7 10 5 5 5-5" />,
  panelClose: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16m7-11-3 3 3 3" />
    </>
  ),
  panelOpen: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16m4-8h4m-2-2 2 2-2 2" />
    </>
  ),
  close: <path d="m18 6-12 12M6 6l12 12" />,
  edit: <path d="m15 5 4 4M4 20l4.5-1 10.2-10.2a2.1 2.1 0 0 0-3-3L5.5 16 4 20Z" />,
  rotate: (
    <>
      <path d="M20 7v5h-5" />
      <path d="M20 12a8 8 0 1 1-2.34-5.66L20 9" />
    </>
  ),
  rotateClockwise: (
    <>
      <path d="M21 2v6h-6" />
      <path d="M21 8a9 9 0 1 0 2.1 5.9" />
    </>
  ),
  duplicate: (
    <>
      <rect x="8" y="8" width="13" height="13" rx="2" />
      <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16M10 11v6m4-6v6M5 7l1 14h12l1-14M9 7V4h6v3" />
    </>
  ),
  reset: (
    <>
      <path d="M3 12a9 9 0 1 0 2.64-6.36L3 8" />
      <path d="M3 3v5h5" />
    </>
  ),
  loader: <circle cx="12" cy="12" r="9" strokeDasharray="42 14" />,
  check: <path d="m5 12 4 4L19 6" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5m0-8h.01" />
    </>
  ),
  alert: (
    <>
      <path d="m10.3 3.9-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3.1l-8-14a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4m0 4h.01" />
    </>
  ),
  sort: (
    <>
      <path d="m8 7 4-4 4 4M12 3v12" />
      <path d="m16 17-4 4-4-4m4 4V9" />
    </>
  ),
  sortUp: <path d="m7 14 5-5 5 5" />,
  sortDown: <path d="m7 10 5 5 5-5" />,
  chevronRight: <path d="m9 18 6-6-6-6" />,
};

export default function Icon({ name, size = 18, strokeWidth = 1.8, className = "" }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {iconContent[name]}
    </svg>
  );
}