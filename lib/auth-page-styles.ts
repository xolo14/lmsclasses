/** Inline styles for auth routes — shown while assets load or when recovery fails. */
export const AUTH_PAGE_INLINE_STYLES = `
html.lms-auth-pending body { background: #F4F4F0; margin: 0; }
html.lms-auth-pending [data-auth-content] { display: none !important; }
[data-auth-loader],
[data-auth-recovery] { display: none; }
html.lms-auth-pending [data-auth-loader] {
  display: flex;
  min-height: 100vh;
  min-height: 100dvh;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  font-family: system-ui, -apple-system, Segoe UI, sans-serif;
  font-size: 0.9375rem;
  color: #0A0A0A;
  background: #F4F4F0;
}
html.lms-recovery-failed [data-auth-content] { display: none !important; }
html.lms-recovery-failed [data-auth-recovery] {
  display: flex;
  min-height: 100vh;
  min-height: 100dvh;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  font-family: system-ui, -apple-system, Segoe UI, sans-serif;
  background: #F4F4F0;
  color: #0A0A0A;
}
html.lms-recovery-failed [data-auth-recovery] > div {
  max-width: 28rem;
  border: 1px solid rgba(10, 10, 10, 0.12);
  background: #fff;
  padding: 1.5rem;
  border-top: 4px solid #FF0A18;
}
html.lms-recovery-failed [data-auth-recovery] h1 {
  margin: 0 0 0.5rem;
  font-size: 1.25rem;
  font-weight: 700;
}
html.lms-recovery-failed [data-auth-recovery] p {
  margin: 0 0 1rem;
  font-size: 0.875rem;
  line-height: 1.5;
  color: #5c5c5c;
}
html.lms-recovery-failed [data-auth-recovery] button {
  border: 1px solid rgba(10, 10, 10, 0.2);
  background: #FF0A18;
  color: #fff;
  font-weight: 600;
  padding: 0.625rem 1rem;
  cursor: pointer;
}
`.trim();
