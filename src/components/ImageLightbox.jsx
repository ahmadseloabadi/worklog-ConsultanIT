
import { useEffect } from "react";
import Icon from "@/components/Icon";

export default function ImageLightbox({ src, alt, onClose }) {
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div className="image-lightbox-backdrop" onClick={onClose}>
      <div
        className="image-lightbox-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={alt || "Pratinjau gambar"}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="image-lightbox-close"
          onClick={onClose}
          aria-label="Tutup pratinjau gambar"
        >
          <Icon name="close" size={20} />
        </button>
        <img className="image-lightbox-image" src={src} alt={alt || "Pratinjau gambar"} />
      </div>
    </div>
  );
}
