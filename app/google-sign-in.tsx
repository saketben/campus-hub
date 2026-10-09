"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// The minimal part of Google's sign-in library that we use.
type GoogleIdentity = {
  initialize(options: {
    client_id: string;
    callback: (response: { credential: string }) => void;
    nonce: string;
    use_fedcm_for_button?: boolean;
  }): void;
  renderButton(parent: HTMLElement, options: Record<string, string | number>): void;
};
declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdentity } };
  }
}

// Google's official "Sign in with Google" button. Google's screen then names our
// own website instead of the Supabase address. Only name and email are shared (D1).
export function GoogleSignIn() {
  const router = useRouter();
  const buttonRef = useRef<HTMLDivElement>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // Runs again once Google's script has loaded (scriptReady), if it wasn't ready yet.
    const google = window.google;
    if (!google || !buttonRef.current) return;
    const button = buttonRef.current;

    let cancelled = false;
    (async () => {
      // A one-time random value that stops a stolen Google token from being replayed.
      // Google gets a scrambled copy; Supabase checks it against the original.
      const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(nonce));
      const hashedNonce = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
      if (cancelled) return;

      google.accounts.id.initialize({
        client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
        nonce: hashedNonce,
        use_fedcm_for_button: true,
        callback: async ({ credential }) => {
          const { error } = await createClient().auth.signInWithIdToken({ provider: "google", token: credential, nonce });
          if (error) setFailed(true);
          else router.refresh();
        },
      });
      google.accounts.id.renderButton(button, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "signin_with",
        shape: "rectangular",
        width: Math.min(button.clientWidth || 320, 400),
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [scriptReady, router]);

  return (
    <div className="flex flex-col gap-3">
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onReady={() => setScriptReady(true)} />
      <div ref={buttonRef} className="min-h-11 w-full" />
      {failed && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
          Sign-in didn&apos;t work. Please try again.
        </p>
      )}
    </div>
  );
}
