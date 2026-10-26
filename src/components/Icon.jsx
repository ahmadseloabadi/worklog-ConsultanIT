const iconContent = {
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