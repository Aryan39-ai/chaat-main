import { useState, useEffect } from 'react';

/**
 * InstallBanner — Shown to iOS Safari users who haven't installed the PWA.
 * Guides them through "Share → Add to Home Screen" for push notification support.
 */
export default function InstallBanner({ isIOS, isStandalone }) {
  const [dismissed, setDismissed] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const wasDismissed = localStorage.getItem('chaat_install_dismissed');
    if (wasDismissed) {
      setDismissed(true);
      return;
    }
    // Small delay before showing for smoother UX
    const timer = setTimeout(() => setVisible(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  // Only show for iOS users NOT already in standalone mode
  if (!isIOS || isStandalone || dismissed || !visible) return null;

  function handleDismiss() {
    setDismissed(true);
    localStorage.setItem('chaat_install_dismissed', 'true');
  }

  return (
    <div className="install-banner animate-slide-up">
      <div className="install-banner-content">
        <div className="install-banner-icon">📲</div>
        <div className="install-banner-text">
          <strong>Install Chaat</strong>
          <p>
            Get push notifications and a native app experience.
            Tap <span className="install-banner-share-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                <polyline points="16 6 12 2 8 6" />
                <line x1="12" y1="2" x2="12" y2="15" />
              </svg>
            </span> then <strong>"Add to Home Screen"</strong>
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="install-banner-close"
          aria-label="Dismiss install banner"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
