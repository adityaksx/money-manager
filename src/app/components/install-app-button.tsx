"use client";

import { useEffect, useState } from "react";
import { Download, Plus, Share2, Smartphone, X } from "lucide-react";

type InstallChoice = { outcome: "accepted" | "dismissed"; platform: string };
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<InstallChoice>;
};

export default function InstallAppButton() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setInstalled(standalone);
    setIsIOS(/iPhone|iPad|iPod/i.test(navigator.userAgent)
      || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
    setIsAndroid(/Android/i.test(navigator.userAgent));

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
      setShowInstructions(false);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((error: unknown) => {
        console.warn("RupeeTrail offline support could not be registered:", error);
      });
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function handleInstall() {
    if (!installPrompt) {
      setShowInstructions(true);
      return;
    }
    const deferredPrompt = installPrompt;
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      setInstallPrompt(null);
      if (choice.outcome === "accepted") setInstalled(true);
      else setShowInstructions(true);
    } catch (error) {
      console.warn("The browser install prompt could not be opened:", error);
      setInstallPrompt(null);
      setShowInstructions(true);
    }
  }

  if (installed) return null;

  return (
    <>
      <button type="button" className="btn primary pwa-install-floating" onClick={handleInstall}>
        <Download size={15} />
        <span>Install app</span>
      </button>

      {showInstructions && (
        <div className="form-overlay" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setShowInstructions(false);
        }}>
          <section className="form-modal pwa-install-modal" role="dialog" aria-modal="true" aria-labelledby="pwa-install-title">
            <div className="modal-head">
              <div className="pwa-modal-brand">
                <span className="pwa-modal-icon"><Smartphone size={20} /></span>
                <div>
                  <h2 id="pwa-install-title" className="panel-title" style={{ fontSize: 16 }}>Install RupeeTrail</h2>
                  <div className="panel-subtitle">Open it from your home screen like a regular app.</div>
                </div>
              </div>
              <button type="button" className="icon-btn" onClick={() => setShowInstructions(false)} aria-label="Close install instructions"><X size={16} /></button>
            </div>
            <div className="modal-body">
              {isIOS ? (
                <div className="pwa-instructions">
                  <p>On your iPhone or iPad, open this website in <strong>Safari</strong>, then:</p>
                  <div className="pwa-step"><span>1</span><div><strong>Tap Share</strong><p>Use the Share icon in the Safari toolbar.</p><span className="pwa-symbol"><Share2 size={17} /> Share</span></div></div>
                  <div className="pwa-step"><span>2</span><div><strong>Choose “Add to Home Screen”</strong><p>You may need to scroll the Share menu to find it.</p><span className="pwa-symbol"><Plus size={17} /> Add to Home Screen</span></div></div>
                  <div className="pwa-step"><span>3</span><div><strong>Tap Add</strong><p>The RupeeTrail icon will appear on your home screen.</p></div></div>
                </div>
              ) : (
                <div className="pwa-instructions">
                  <p>{isAndroid ? "On Android, use Chrome or another supported browser." : "In a supported browser, open the browser menu."}</p>
                  <div className="pwa-step"><span>1</span><div><strong>Open the browser menu</strong><p>{isAndroid ? "Tap the three-dot menu (⋮) in Chrome." : "Look for Install app, Install page, or Add to Home Screen."}</p></div></div>
                  <div className="pwa-step"><span>2</span><div><strong>Choose “Install app” or “Add to Home screen”</strong><p>The exact wording varies by browser. If Chrome offers an install prompt, use that option.</p></div></div>
                  <div className="pwa-step"><span>3</span><div><strong>Confirm installation</strong><p>Launch RupeeTrail from the new home-screen icon.</p></div></div>
                </div>
              )}
              <div className="pwa-security-note">Your financial data still uses your existing secure sign-in. Installing the app does not copy your data onto the home screen.</div>
              <div className="modal-actions"><button type="button" className="btn primary" onClick={() => setShowInstructions(false)}>Got it</button></div>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
