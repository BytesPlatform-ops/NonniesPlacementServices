"use client";

import { useState } from "react";
import { Panel } from "@/components/ui/Panel";
import type { ListingInput, MarketplaceListing } from "@/types/marketplace";

const inputCls =
  "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600";

const TYPES = [
  { value: "BED", label: "Bed" },
  { value: "PRIVATE_ROOM", label: "Private room" },
  { value: "SHARED_ROOM", label: "Shared room" },
  { value: "UNIT", label: "Unit" },
  { value: "OTHER", label: "Other" },
];

const PERIODS = [
  { value: "MONTHLY", label: "Per month" },
  { value: "WEEKLY", label: "Per week" },
  { value: "DAILY", label: "Per day" },
];

export interface ListingFormState {
  title: string;
  listingType: string;
  transactionType: "RENT" | "SALE";
  price: string;
  billingPeriod: "DAILY" | "WEEKLY" | "MONTHLY";
  depositAmount: string;
  availableQuantity: string;
  description: string;
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
  availableFrom: string;
  amenities: string;
  restrictions: string;
}

export function emptyListingForm(listing?: MarketplaceListing): ListingFormState {
  return {
    title: listing?.title ?? "",
    listingType: listing?.listingType ?? "BED",
    transactionType: listing?.transactionType ?? "RENT",
    price: listing?.price ?? "",
    billingPeriod: listing?.billingPeriod ?? "MONTHLY",
    depositAmount: listing?.depositAmount ?? "",
    availableQuantity: String(listing?.availableQuantity ?? 1),
    description: listing?.description ?? "",
    addressLine1: listing?.addressLine1 ?? "",
    city: listing?.city ?? "",
    state: listing?.state ?? "",
    postalCode: listing?.postalCode ?? "",
    availableFrom: listing?.availableFrom ? listing.availableFrom.slice(0, 10) : "",
    amenities: (listing?.amenities ?? []).join(", "),
    restrictions: listing?.restrictions ?? "",
  };
}

/**
 * Client-side validation mirrors the server's rules so a mistake is caught
 * before a round trip — the server re-checks every one of them regardless.
 */
export function validateListingForm(form: ListingFormState): string | null {
  if (!form.title.trim()) return "A title is required.";
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(form.price)) return "Enter a price such as 1200 or 1200.50.";
  if (Number(form.price) <= 0) return "The price must be greater than zero.";
  if (form.depositAmount && !/^\d{1,10}(\.\d{1,2})?$/.test(form.depositAmount)) {
    return "Enter a deposit such as 500 or 500.00.";
  }
  const quantity = Number(form.availableQuantity);
  if (!Number.isInteger(quantity) || quantity < 0) return "Quantity must be a whole number of 0 or more.";
  if (form.transactionType === "RENT" && !form.billingPeriod) return "Choose how the rent is charged.";
  return null;
}

export function toListingInput(form: ListingFormState): ListingInput {
  return {
    title: form.title.trim(),
    listingType: form.listingType,
    transactionType: form.transactionType,
    price: form.price,
    // Always sent so switching a listing to a sale clears the stale period.
    billingPeriod: form.transactionType === "RENT" ? form.billingPeriod : undefined,
    depositAmount: form.depositAmount || undefined,
    availableQuantity: Number(form.availableQuantity),
    description: form.description.trim() || undefined,
    addressLine1: form.addressLine1.trim() || undefined,
    city: form.city.trim() || undefined,
    state: form.state.trim() || undefined,
    postalCode: form.postalCode.trim() || undefined,
    availableFrom: form.availableFrom || undefined,
    amenities: form.amenities
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean),
    restrictions: form.restrictions.trim() || undefined,
  };
}

export function ListingFormFields({
  form,
  onChange,
}: {
  form: ListingFormState;
  onChange: (next: ListingFormState) => void;
}) {
  const set = <K extends keyof ListingFormState>(key: K, value: ListingFormState[K]) =>
    onChange({ ...form, [key]: value });

  return (
    <div className="space-y-4">
      <Panel title="What are you listing?">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="text-xs font-medium text-slate-600">Title</span>
            <input
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="e.g. Private room with ensuite, ground floor"
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Type</span>
            <select value={form.listingType} onChange={(e) => set("listingType", e.target.value)} className={inputCls}>
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Rent or sale</span>
            <select
              value={form.transactionType}
              onChange={(e) => set("transactionType", e.target.value as "RENT" | "SALE")}
              className={inputCls}
            >
              <option value="RENT">For rent</option>
              <option value="SALE">For sale</option>
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs font-medium text-slate-600">Description</span>
            <textarea
              rows={4}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              className={inputCls}
            />
          </label>
        </div>
      </Panel>

      <Panel title="Price and availability">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Price</span>
            <input
              inputMode="decimal"
              value={form.price}
              onChange={(e) => set("price", e.target.value)}
              placeholder="1200"
              className={inputCls}
            />
          </label>
          {form.transactionType === "RENT" ? (
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Charged</span>
              <select
                value={form.billingPeriod}
                onChange={(e) => set("billingPeriod", e.target.value as ListingFormState["billingPeriod"])}
                className={inputCls}
              >
                {PERIODS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Deposit (optional)</span>
              <input
                inputMode="decimal"
                value={form.depositAmount}
                onChange={(e) => set("depositAmount", e.target.value)}
                className={inputCls}
              />
            </label>
          )}
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Quantity available</span>
            <input
              inputMode="numeric"
              value={form.availableQuantity}
              onChange={(e) => set("availableQuantity", e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Available from</span>
            <input
              type="date"
              value={form.availableFrom}
              onChange={(e) => set("availableFrom", e.target.value)}
              className={inputCls}
            />
          </label>
          {form.transactionType === "RENT" ? (
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Deposit (optional)</span>
              <input
                inputMode="decimal"
                value={form.depositAmount}
                onChange={(e) => set("depositAmount", e.target.value)}
                className={inputCls}
              />
            </label>
          ) : null}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Payment is handled offline in cash for now. Nothing is charged through the platform.
        </p>
      </Panel>

      <Panel title="Where it is">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="text-xs font-medium text-slate-600">Address</span>
            <input value={form.addressLine1} onChange={(e) => set("addressLine1", e.target.value)} className={inputCls} />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">City</span>
            <input value={form.city} onChange={(e) => set("city", e.target.value)} className={inputCls} />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">State</span>
            <input value={form.state} onChange={(e) => set("state", e.target.value)} className={inputCls} />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs font-medium text-slate-600">Features (comma separated)</span>
            <input
              value={form.amenities}
              onChange={(e) => set("amenities", e.target.value)}
              placeholder="Ensuite, Ground floor, Garden access"
              className={inputCls}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs font-medium text-slate-600">Restrictions (optional)</span>
            <input
              value={form.restrictions}
              onChange={(e) => set("restrictions", e.target.value)}
              placeholder="e.g. Female residents only"
              className={inputCls}
            />
          </label>
        </div>
      </Panel>
    </div>
  );
}

export function useListingForm(listing?: MarketplaceListing) {
  return useState<ListingFormState>(() => emptyListingForm(listing));
}
