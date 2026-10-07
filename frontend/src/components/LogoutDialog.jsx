import { useEffect, useRef } from "react";
import { LogOut, X } from "lucide-react";

export default function LogoutDialog({ onCancel, onConfirm }) {
  const dialogRef = useRef(null);
  const cancelRef = useRef(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    cancelRef.current?.focus();
    return () => dialog.close();
  }, []);
  return <dialog ref={dialogRef} className="console-logout-dialog" aria-labelledby="logout-title" aria-describedby="logout-description" onCancel={event => { event.preventDefault(); onCancel(); }}>
    <button className="console-dialog-close console-icon-button" aria-label="Close sign-out confirmation" onClick={onCancel}><X size={19} /></button>
    <span className="console-dialog-icon"><LogOut size={24} /></span>
    <h2 id="logout-title">Sign out of LEVELBLUE?</h2>
    <p id="logout-description">You’ll need to sign in again to access your workspace. Any unsaved changes on this page may be lost.</p>
    <div className="console-dialog-actions"><button ref={cancelRef} className="dash-button" onClick={onCancel}>Stay signed in</button><button className="dash-primary-action" onClick={onConfirm}>Sign out</button></div>
  </dialog>;
}
