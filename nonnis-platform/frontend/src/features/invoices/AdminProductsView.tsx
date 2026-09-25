"use client";

import { useEffect, useState } from "react";
import { useAsync } from "@/hooks/use-async";
import { useToast } from "@/providers/toast-provider";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import { PERMISSIONS } from "@/lib/permissions";
import { PageHeading } from "@/components/ui/PageHeading";
import { Panel } from "@/components/ui/Panel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { listProducts, updateProductPricing } from "@/services/invoices.service";
import type { ProductView } from "@/types/invoices";

const inputCls =
  "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600";

const CATEGORY_LABEL: Record<string, string> = {
  PLATFORM_SUBSCRIPTION: "Platform subscription",
  PLACEMENT_SERVICE: "Placement service",
};

/**
 * What Nonni's bills for.
 *
 * The price field here is a SUGGESTION, and the page says so plainly. It is
 * what an admin is offered when writing a new invoice; the charged amount is
 * always entered per provider and approved separately. Leaving it blank is a
 * perfectly valid state — the subscription price is not settled yet, and a
 * placement fee is whatever the signed agreement says.
 */
export function AdminProductsView() {
  const { hasPermission } = useAuth();
  const canPrice = hasPermission(PERMISSIONS.INVOICES_APPROVE);
  const { data, loading, error, reload } = useAsync(() => listProducts(), []);

  if (loading && !data) return <LoadingState label="Loading products…" />;
  if (error) return <ErrorState message={error.message} onRetry={reload} />;

  return (
    <div className="space-y-4">
      <PageHeading
        title="Products"
        description="What Nonni's bills for. Prices here are only a starting figure — every invoice amount is entered per provider and approved."
      />
      {(data ?? []).map((product) => (
        <ProductCard key={product.id} product={product} canPrice={canPrice} onSaved={reload} />
      ))}
    </div>
  );
}

function ProductCard({ product, canPrice, onSaved }: { product: ProductView; canPrice: boolean; onSaved: () => void }) {
  const toast = useToast();
  const [price, setPrice] = useState(product.suggestedUnitPrice ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => setPrice(product.suggestedUnitPrice ?? ""), [product.suggestedUnitPrice]);

  const save = async (patch: { suggestedUnitPrice?: string | null; active?: boolean }) => {
    setSaving(true);
    try {
      await updateProductPricing(product.id, patch);
      toast.success("Product updated");
      onSaved();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not update the product.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel
      title={product.name}
      description={product.description ?? undefined}
      actions={
        <div className="flex items-center gap-2">
          <StatusBadge label={CATEGORY_LABEL[product.category] ?? product.category} tone="neutral" />
          <StatusBadge label={product.recurring ? "Monthly" : "One-time"} tone="neutral" />
          <StatusBadge label={product.active ? "Available" : "Retired"} tone={product.active ? "positive" : "neutral"} />
        </div>
      }
    >
      <div className="flex flex-wrap items-end gap-3">
        <label className="block max-w-[14rem]">
          <span className="text-xs font-medium text-slate-600">Suggested price ({product.currency})</span>
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            inputMode="decimal"
            placeholder="Not set"
            disabled={!canPrice}
            className={`${inputCls} disabled:bg-slate-50`}
          />
        </label>
        {canPrice ? (
          <>
            <button
              type="button"
              onClick={() => void save({ suggestedUnitPrice: price.trim() || null })}
              disabled={saving}
              className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save price"}
            </button>
            {product.suggestedUnitPrice ? (
              <button
                type="button"
                onClick={() => void save({ suggestedUnitPrice: null })}
                disabled={saving}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Clear
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void save({ active: !product.active })}
              disabled={saving}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {product.active ? "Retire" : "Make available"}
            </button>
          </>
        ) : (
          <p className="text-xs text-slate-500">Only an authorized approver can change pricing.</p>
        )}
      </div>
      <p className="mt-2 max-w-prose text-xs text-slate-500">
        Offered as a starting figure when an admin writes an invoice, and overwritable. Leave it blank while a price is undecided — it is never
        the amount charged.
      </p>
    </Panel>
  );
}
