"use client";

import type { ReactNode } from "react";
import { PageHeading } from "@/components/ui/PageHeading";
import type { ProviderDetailView } from "@/types/providers";
import {
  CapacityTab,
  CoverageTab,
  HoursTab,
  LanguagesTab,
  PaymentTab,
  ServicesTab,
} from "@/features/providers/provider-tabs";
import { PortalContent } from "./portal-context";

function Section({
  title,
  description,
  render,
}: {
  title: string;
  description: string;
  render: (provider: ProviderDetailView, reload: () => void) => ReactNode;
}) {
  return (
    <div className="space-y-6">
      <PageHeading title={title} description={description} />
      <PortalContent>{(provider, reload) => render(provider, reload)}</PortalContent>
    </div>
  );
}

export function PortalServices() {
  return (
    <Section
      title="Services"
      description="The services your organization offers, chosen from Nonnis service categories."
      render={(provider, reload) => <ServicesTab provider={provider} reload={reload} />}
    />
  );
}

export function PortalCoverage() {
  return (
    <Section
      title="Coverage"
      description="The geographic areas your organization serves."
      render={(provider, reload) => <CoverageTab provider={provider} reload={reload} />}
    />
  );
}

export function PortalPayment() {
  return (
    <Section
      title="Payment / Insurance"
      description="The payment and insurance types your organization accepts."
      render={(provider, reload) => <PaymentTab provider={provider} reload={reload} />}
    />
  );
}

export function PortalLanguages() {
  return (
    <Section
      title="Languages"
      description="The languages your organization supports."
      render={(provider, reload) => <LanguagesTab provider={provider} reload={reload} />}
    />
  );
}

export function PortalHours() {
  return (
    <Section
      title="Operating hours"
      description="Your weekly operating hours."
      render={(provider, reload) => <HoursTab provider={provider} reload={reload} />}
    />
  );
}

export function PortalCapacity() {
  return (
    <Section
      title="Capacity & availability"
      description="Keep your current availability up to date so Nonnis staff can coordinate."
      render={(provider, reload) => <CapacityTab provider={provider} reload={reload} />}
    />
  );
}
