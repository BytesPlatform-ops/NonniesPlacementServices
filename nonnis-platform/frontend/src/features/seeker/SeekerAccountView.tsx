"use client";

import { useEffect, useState } from "react";
import { useAsync } from "@/hooks/use-async";
import { useToast } from "@/providers/toast-provider";
import { PageHeading } from "@/components/ui/PageHeading";
import { Panel } from "@/components/ui/Panel";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { getSeekerAccount, updateSeekerAccount } from "@/services/seeker.service";

const inputCls =
  "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400";

/**
 * The family member's own profile.
 *
 * Editable fields are display fields only. Email, role and which cases they may
 * see are all authorization, and none of them can be changed from here — those
 * are staff actions, on purpose.
 */
export function SeekerAccountView() {
  const toast = useToast();
  const state = useAsync(() => getSeekerAccount(), []);
  const [form, setForm] = useState({ firstName: "", lastName: "", displayName: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (state.data) {
      setForm({
        firstName: state.data.firstName ?? "",
        lastName: state.data.lastName ?? "",
        displayName: state.data.displayName ?? "",
      });
    }
  }, [state.data]);

  if (state.loading) return <LoadingState label="Loading your account…" />;
  if (state.error) return <ErrorState message={state.error.message} onRetry={state.reload} />;
  if (!state.data) return null;

  const save = async () => {
    setSaving(true);
    try {
      await updateSeekerAccount({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        displayName: form.displayName.trim(),
      });
      toast.success("Your details were saved");
      state.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Your details could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeading title="Account" description="Your own contact details and the cases you have access to." />

      <Panel title="Your details">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium text-slate-600">First name</span>
            <input
              value={form.firstName}
              onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Last name</span>
            <input
              value={form.lastName}
              onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
              className={inputCls}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs font-medium text-slate-600">Preferred name</span>
            <input
              value={form.displayName}
              onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
              placeholder="How you would like us to address you"
              className={inputCls}
            />
          </label>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </Panel>

      <Panel title="Sign-in" description="Your email address is how you sign in. Contact us to change it.">
        <p className="text-sm font-medium text-slate-800">{state.data.email}</p>
        <p className="mt-2 text-xs text-slate-500">
          To change your password, sign out and use the &ldquo;Forgot password&rdquo; link on the sign-in page.
        </p>
      </Panel>

      <Panel title="Your access" description="The care recipients you are authorized to see.">
        <ul className="divide-y divide-sage/70">
          {state.data.cases.map((c) => (
            <li key={c.caseId} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
              <div>
                <p className="text-sm font-medium text-umber">{c.careRecipientName}</p>
                <p className="text-xs text-slate-500">
                  Case {c.caseNumber}
                  {c.relationship ? ` · you are recorded as: ${c.relationship}` : ""}
                </p>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-slate-400">
          Access is granted by the Nonnis team. Contact us if this looks wrong.
        </p>
      </Panel>
    </div>
  );
}
