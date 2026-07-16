/**
 * Off-screen anti-spam honeypot input. Real users never see or fill it; bots
 * that auto-fill inputs will. Forms read its value from the submit event via
 * `readHoneypot(event)` and pass it to the endpoint, which silently rejects
 * any submission where it is non-empty.
 */
export function Honeypot() {
  return (
    <input
      type="text"
      name="company"
      tabIndex={-1}
      autoComplete="off"
      aria-hidden="true"
      className="absolute left-[-9999px] top-0 h-px w-px opacity-0"
    />
  );
}
