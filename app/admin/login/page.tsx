import { permanentRedirect } from "next/navigation";

// Unified sign-in now lives at /account — admin credentials route privately to the admin console.
export default function AdminLoginRedirect() {
  permanentRedirect("/account");
}
