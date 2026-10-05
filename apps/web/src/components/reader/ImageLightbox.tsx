import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type TouchEvent as ReactTouchEvent } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, X, ZoomIn, ZoomOut } from "lucide-react";

export type LightboxImage = {
  id: string;
  src: string;
  alt?: string;
  proxiedSrc: string;
};

type ImageLightboxProps = {
  images: LightboxImage[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
};

export function ImageLightbox({ images, currentIndex, onClose, onNavigate }: ImageLightboxProps) {
  const currentImage = images[currentIndex];

  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const hasMovedRef = useRef(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  // Reset zoom and pan whenever navigating to another image
  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, [currentIndex]);

  // Lock document body scroll while lightbox is active
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowLeft" && images.length > 1) {
        e.preventDefault();
        onNavigate((currentIndex - 1 + images.length) % images.length);
      } else if (e.key === "ArrowRight" && images.length > 1) {
        e.preventDefault();
        onNavigate((currentIndex + 1) % images.length);
      } else if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        setScale((prev) => Math.min(prev + 0.5, 3));
      } else if (e.key === "-") {
        e.preventDefault();
        setScale((prev) => {
          const next = Math.max(prev - 0.5, 1);
          if (next === 1) setPosition({ x: 0, y: 0 });
          return next;
        });
      } else if (e.key === "0") {
        e.preventDefault();
        setScale(1);
        setPosition({ x: 0, y: 0 });
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, images.length, onClose, onNavigate]);

  if (!currentImage) return null;

  function toggleZoom() {
    if (scale > 1) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    } else {
      setScale(2);
      setPosition({ x: 0, y: 0 });
    }
  }

  function handleMouseDown(e: ReactMouseEvent) {
    if (scale > 1) {
      setIsDragging(true);
      hasMovedRef.current = false;
      dragStartRef.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    }
  }

  function handleMouseMove(e: ReactMouseEvent) {
    if (isDragging && scale > 1) {
      hasMovedRef.current = true;
      setPosition({
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y
      });
    }
  }

  function handleMouseUp() {
    if (isDragging) {
      setIsDragging(false);
    }
  }

  function handleImageClick(e: ReactMouseEvent) {
    e.stopPropagation();
    if (!hasMovedRef.current) {
      toggleZoom();
    }
  }

  // Mobile swipe support
  function handleTouchStart(e: ReactTouchEvent) {
    const touch = e.touches[0];
    if (e.touches.length === 1 && scale === 1 && touch) {
      touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    }
  }

  function handleTouchEnd(e: ReactTouchEvent) {
    const touch = e.changedTouches[0];
    if (!touchStartRef.current || scale > 1 || !touch) return;
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    touchStartRef.current = null;

    if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5 && images.length > 1) {
      if (deltaX > 0) {
        onNavigate((currentIndex - 1 + images.length) % images.length);
      } else {
        onNavigate((currentIndex + 1) % images.length);
      }
    }
  }

  const hasMultiple = images.length > 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="圖片檢視器"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md select-none transition-opacity duration-200"
    >
      {/* Top Toolbar (Fancybox Style) */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="absolute top-0 inset-x-0 h-14 px-4 sm:px-6 flex items-center justify-between z-20 pointer-events-auto bg-gradient-to-b from-black/60 to-transparent"
      >
        {/* Left: Index Counter */}
        <div className="flex items-center gap-3">
          {hasMultiple && (
            <span className="font-mono text-xs text-white/80 px-2.5 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 tracking-wider">
              {currentIndex + 1} / {images.length}
            </span>
          )}
          {currentImage.alt && (
            <span className="hidden md:inline-block text-xs text-white/60 truncate max-w-md">
              {currentImage.alt}
            </span>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Zoom Toggle */}
          <button
            type="button"
            onClick={toggleZoom}
            className="p-2 rounded-full text-white/75 hover:text-white hover:bg-white/15 transition-colors cursor-pointer"
            title={scale > 1 ? "還原原始比例" : "放大檢視 (雙擊或點擊圖片)"}
          >
            {scale > 1 ? <ZoomOut className="w-4 h-4" /> : <ZoomIn className="w-4 h-4" />}
          </button>

          {/* Open Original in New Tab */}
          <a
            href={currentImage.src}
            target="_blank"
            rel="noreferrer"
            className="p-2 rounded-full text-white/75 hover:text-white hover:bg-white/15 transition-colors cursor-pointer"
            title="在新分頁開啟原始檔案"
          >
            <ExternalLink className="w-4 h-4" />
          </a>

          {/* Close Lightbox */}
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-white/75 hover:text-white hover:bg-white/15 transition-colors cursor-pointer ml-1"
            title="關閉 (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Image Stage */}
      <div
        className="relative w-full h-full flex items-center justify-center p-4 sm:p-10 overflow-hidden"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <img
          key={currentImage.src}
          src={currentImage.proxiedSrc}
          alt={currentImage.alt ?? ""}
          draggable={false}
          onClick={handleImageClick}
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transition: isDragging ? "none" : "transform 0.22s cubic-bezier(0.2, 0, 0.2, 1)"
          }}
          onError={(e) => {
            if (currentImage.src && e.currentTarget.src !== currentImage.src) {
              e.currentTarget.src = currentImage.src;
            }
          }}
          className={`max-w-[92vw] max-h-[82vh] object-contain shadow-2xl rounded-sm ${
            scale > 1 ? (isDragging ? "cursor-grabbing" : "cursor-grab") : "cursor-zoom-in"
          }`}
        />
      </div>

      {/* Navigation Arrows (when multiple images) */}
      {hasMultiple && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onNavigate((currentIndex - 1 + images.length) % images.length);
            }}
            className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 p-2.5 sm:p-3 rounded-full text-white/80 hover:text-white bg-black/40 hover:bg-black/70 backdrop-blur-md border border-white/15 transition-all shadow-lg hover:scale-105 cursor-pointer z-30"
            title="上一張 (←)"
          >
            <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2} />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onNavigate((currentIndex + 1) % images.length);
            }}
            className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 p-2.5 sm:p-3 rounded-full text-white/80 hover:text-white bg-black/40 hover:bg-black/70 backdrop-blur-md border border-white/15 transition-all shadow-lg hover:scale-105 cursor-pointer z-30"
            title="下一張 (→)"
          >
            <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2} />
          </button>
        </>
      )}

      {/* Bottom Caption Pill */}
      {currentImage.alt && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-4 sm:bottom-6 inset-x-4 flex justify-center pointer-events-none z-20"
        >
          <div className="max-w-xl px-4 py-2 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-white/90 text-xs text-center shadow-lg pointer-events-auto">
            {currentImage.alt}
          </div>
        </div>
      )}
    </div>
  );
}
