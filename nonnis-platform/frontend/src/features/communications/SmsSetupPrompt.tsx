"use client";

import Link from "next/link";
import { AlertTriangle, MessageSquare, MessageSquareOff, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useAsync } from "@/hooks/use-async";
import { getSeekerCommunicationPreferences } from "@/services/seeker.service";

const DISMISS_KEY = "nonnis.seeker.sms-prompt.dismissed";

/**
 * A quiet nudge to finish SMS setup, shown above the family's messages.
 *
 * Three states, and the difference between them matters:
 *
 *  - nothing on file          → invite them to add a number
 *  - number but no answer yet → ask the SMS question, without pre-answering it
 *  - deliberately turned off  → say so plainly and leave it alone
 *
 * It is never a modal and never blocks the page. Someone who has answered the
 * question is never asked again, and someone who has not can still dismiss the
 * nudge for this browser — an unanswered question is not a reason to badger
 * somebody every time they open their messages.
 *
 * `href` exists because each portal keeps its own URL space: the family portal
 * links within /seeker, the staff app within its own routes. Same screen either
 * way, same caller's-own-row endpoint behind it.
 */
export function SmsSetupPrompt({ href = "/communication-preferences" }: { href?: string } = {}) {
  const { data, error } = useAsync(() => getSeekerCommunicationPreferences(), []);
  const [dismissed, setDismissed] = useState(true); // assume dismissed until storage is read

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false); // storage blocked: showing the nudge is the safer default
    }
  }, []);

  const dismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* per-browser convenience only — nothing depends on it persisting */
    }
  };

  // A failure here used to render nothing at all, which looks identical to
  // "already set up" and hides a broken endpoint completely. Say it plainly
  // instead — the person can still reach the page and set their number there.
  if (error) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
        <span>We could not load your SMS preferences just now.</span>
        <Link href={href} className="ml-auto font-medium underline">
          Open preferences
        </Link>
      </div>
    );
  }

  if (!data) return null;

  // Turned off on purpose: a settled decision, so only a quiet way back.
  if (data.smsConsent === "OPTED_OUT") {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-sage bg-ivory px-3 py-2 text-sm text-slate-600">
        <MessageSquareOff className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        <span>SMS notifications are currently off.</span>
        <Link href={href} className="ml-auto font-medium text-brand-700 hover:underline">
          Manage SMS preferences
        </Link>
      </div>
    );
  }

  if (!data.setupRequired || dismissed) return null;

  const hasPhone = !!data.phone;

  return (
    <div className="flex items-start gap-3 rounded-md border border-brand-200 bg-brand-50 px-3 py-3">
      <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-umber">{hasPhone ? "SMS notifications are not enabled" : "Set up SMS notifications"}</p>
        <p className="mt-0.5 text-sm text-slate-600">
          {hasPhone ? (
            <>
              We have your number on file as <span className="font-medium text-slate-700">{data.phone}</span>, but you have not chosen whether
              to receive SMS updates yet.
            </>
          ) : (
            "Add your mobile number and choose whether you'd like to receive SMS updates from Nonni's."
          )}
        </p>
        <Link
          href={href}
          className="mt-2 inline-flex items-center rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
        >
          {hasPhone ? "Enable SMS" : "Add phone & SMS preferences"}
        </Link>
      </div>
      <button type="button" onClick={dismiss} className="-mr-1 rounded p-1 text-slate-400 hover:bg-sage/40 hover:text-umber" aria-label="Dismiss">
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
