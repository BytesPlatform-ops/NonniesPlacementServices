"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, MessageSquare, ShieldCheck } from "lucide-react";
import { useAsync } from "@/hooks/use-async";
import { useToast } from "@/providers/toast-provider";
import { ApiError } from "@/lib/api-client";
import { PageHeading } from "@/components/ui/PageHeading";
import { Panel } from "@/components/ui/Panel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { formatDateTime } from "@/lib/format";
import { getSeekerCommunicationPreferences, updateSeekerCommunicationPreferences } from "@/services/seeker.service";

const inputCls =
  "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600";

const CONSENT_TEXT =
  "I agree to receive SMS messages from Nonni's and participating providers about relevant updates, coordination, and communications. Message and data rates may apply. Reply STOP at any time to opt out.";

/**
 * Phone number and SMS consent, owned by the person they describe.
 *
 * The two answers are kept deliberately separate: giving a number is how we
 * reach someone, agreeing to SMS is permission to do so, and the second is never
 * inferred from the first. Consent is also tied to the number it was given for,
 * so changing the number asks the question again rather than carrying an old
 * "yes" onto a handset whose owner never agreed to anything.
 */
export function CommunicationPreferencesView() {
  const toast = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const onboarding = params.get("onboarding") === "1";

  const { data, loading, error, reload } = useAsync(() => getSeekerCommunicationPreferences(), []);
  const [phone, setPhone] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!data) return;
    setPhone(data.phone ?? "");
    setAgreed(data.smsConsent === "OPTED_IN");
  }, [data]);

  if (loading && !data) return <LoadingState label="Loading your preferences…" />;
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (!data) return null;

  const numberChanged = touched && phone.trim() !== (data.phone ?? "").trim();

  const save = async (consent: boolean | undefined) => {
    if (!phone.trim()) {
      toast.error("Enter your mobile number first.");
      return;
    }
    setSaving(true);
    try {
      const next = await updateSeekerCommunicationPreferences({ phone: phone.trim(), smsConsent: consent });
      toast.success(next.smsEnabled ? "SMS updates are on" : "Preferences saved");
      setTouched(false);
      reload();
      if (onboarding) router.push("/home");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not save your preferences.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeading
        title={onboarding ? "How can we reach you?" : "Communication preferences"}
        description={
          onboarding
            ? "Add your mobile number so your care team can reach you. You choose whether we send SMS updates — it is entirely optional."
            : "Your mobile number and whether Nonni's may send you SMS updates."
        }
      />

      {!onboarding ? (
        <Panel title="Current status">
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-slate-500">Mobile number</dt>
              <dd className="mt-0.5 text-slate-700">{data.phone ?? <span className="text-slate-400">Not provided</span>}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">SMS updates</dt>
              <dd className="mt-0.5">
                {data.smsConsent === "OPTED_IN" ? (
                  <StatusBadge label="on" tone="positive" />
                ) : data.smsConsent === "OPTED_OUT" ? (
                  <StatusBadge label="off" tone="neutral" />
                ) : (
                  <StatusBadge label="not set" tone="warning" />
                )}
              </dd>
            </div>
            {data.consentAt ? (
              <div>
                <dt className="text-xs text-slate-500">Agreed on</dt>
                <dd className="mt-0.5 text-slate-700">{formatDateTime(data.consentAt)}</dd>
              </div>
            ) : null}
            {data.optOutAt ? (
              <div>
                <dt className="text-xs text-slate-500">Turned off on</dt>
                <dd className="mt-0.5 text-slate-700">{formatDateTime(data.optOutAt)}</dd>
              </div>
            ) : null}
          </dl>
        </Panel>
      ) : null}

      <Panel title="Mobile number" description="Used for SMS updates and so your care team can reach you.">
        <label className="block max-w-sm">
          <span className="text-xs font-medium text-slate-600">Mobile number</span>
          <input
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setTouched(true);
            }}
            inputMode="tel"
            autoComplete="tel"
            placeholder="+1 415 555 0100"
            className={inputCls}
          />
        </label>
        {numberChanged && data.smsConsent === "OPTED_IN" ? (
          <p className="mt-2 max-w-prose text-xs text-amber-700">
            You are changing your number. SMS updates will be turned off for the new number until you agree again below — we never carry a
            previous agreement onto a different handset.
          </p>
        ) : null}
      </Panel>

      <Panel title="SMS updates" description="Optional. Your account works exactly the same either way.">
        <label className="flex max-w-prose cursor-pointer items-start gap-3 rounded-md border border-slate-200 p-3 hover:border-brand-400">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => {
              setAgreed(e.target.checked);
              setTouched(true);
            }}
            className="mt-0.5 h-4 w-4 rounded text-brand-600"
          />
          <span className="text-sm text-slate-700">{CONSENT_TEXT}</span>
        </label>

        <p className="mt-3 flex max-w-prose items-start gap-2 text-xs text-slate-500">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
          We never share your number for advertising. You can turn SMS off here at any time, or reply STOP to any message.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={saving || !phone.trim()}
            onClick={() => void save(agreed)}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {agreed ? <MessageSquare className="h-4 w-4" aria-hidden /> : <CheckCircle2 className="h-4 w-4" aria-hidden />}
            {saving ? "Saving…" : agreed ? "Save and turn on SMS" : "Save preferences"}
          </button>

          {onboarding ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => router.push("/home")}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Skip for now
            </button>
          ) : null}
        </div>
      </Panel>
    </div>
  );
}
