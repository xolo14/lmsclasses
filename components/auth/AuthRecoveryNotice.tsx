"use client";

export function AuthRecoveryNotice() {
  return (
    <div data-auth-recovery>
      <div>
        <h1>Sign-in page needs a refresh</h1>
        <p>
          Your browser is showing an outdated version of this page after a site update. Hard refresh
          (Ctrl+F5) or use the button below to load the current sign-in screen.
        </p>
        <button type="button" onClick={() => window.location.reload()}>
          Reload sign-in
        </button>
      </div>
    </div>
  );
}
