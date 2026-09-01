/**
 * Idempotent DEMO seed for the public residential-provider directory.
 *
 *   npm run seed:public-directory-demo          # (re)create the demo listings
 *   npm run seed:public-directory-demo -- --clean  # remove them
 *
 * All records are clearly fictional and tagged with organization.externalRef =
 * "PUBLIC_DIR_DEMO" so they are easy to identify and remove. Re-running replaces
 * the demo set (delete + recreate) so it never accumulates duplicates. It reuses
 * existing Supabase-hosted CMS images so every public image returns HTTP 200.
 */
import { PrismaClient, type DayOfWeek } from "@prisma/client";
import { slugify } from "../modules/providers/public-listing";

const prisma = new PrismaClient();
const MARK = "PUBLIC_DIR_DEMO";
const WEEKDAYS: DayOfWeek[] = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"];

async function clean(): Promise<number> {
  // Deleting the demo organizations cascades to their providers + provider children.
  const res = await prisma.organization.deleteMany({ where: { externalRef: MARK } });
  return res.count;
}

interface Spec {
  name: string;
  city: string;
  state: string;
  desc: string;
  services: string[]; // service category codes
  residential: boolean;
  published: boolean;
  status: "ACTIVE" | "PAUSED" | "INACTIVE";
}

const SPECS: Spec[] = [
  { name: "Willowbrook Adult Family Home", city: "Tacoma", state: "WA", desc: "A cozy six-bed adult family home offering personalized daily support in a real neighborhood setting.", services: ["PERSONAL_CARE", "HOMEMAKER"], residential: true, published: true, status: "ACTIVE" },
  { name: "Cedar Grove Assisted Living", city: "Seattle", state: "WA", desc: "Warm assisted living with chef-prepared meals, gardens, and an engaged activities calendar.", services: ["PERSONAL_CARE", "SKILLED_NURSING"], residential: true, published: true, status: "ACTIVE" },
  { name: "Harborview Memory Care", city: "Bellevue", state: "WA", desc: "Secure, purpose-built memory care with specially trained caregivers and calming shared spaces.", services: ["PERSONAL_CARE", "BEHAVIORAL_HEALTH"], residential: true, published: true, status: "ACTIVE" },
  { name: "Maplewood Senior Living", city: "Spokane", state: "WA", desc: "Independent and assisted living apartments with on-site therapy and transportation.", services: ["PERSONAL_CARE", "PHYSICAL_THERAPY", "TRANSPORTATION"], residential: true, published: true, status: "ACTIVE" },
  { name: "Sunrise Cottage Home", city: "Olympia", state: "WA", desc: "A family-run care cottage focused on gentle, attentive support and home-cooked meals.", services: ["PERSONAL_CARE"], residential: true, published: true, status: "ACTIVE" },
  { name: "Evergreen Care Home", city: "Portland", state: "OR", desc: "Comfortable residential care with hospice-supportive services and 24-hour caregiving.", services: ["PERSONAL_CARE", "HOSPICE"], residential: true, published: true, status: "ACTIVE" },
  { name: "Lakeside Residential Care", city: "Vancouver", state: "WA", desc: "Lakeside setting with skilled nursing support, wound care, and rehabilitation therapy.", services: ["SKILLED_NURSING", "WOUND_CARE", "OCCUPATIONAL_THERAPY"], residential: true, published: true, status: "ACTIVE" },
  { name: "Rose Garden Assisted Living", city: "Renton", state: "WA", desc: "Boutique assisted living with bilingual staff and flexible funding options.", services: ["PERSONAL_CARE", "HOMEMAKER"], residential: true, published: true, status: "ACTIVE" },
  // Exclusion cases — must NOT appear publicly.
  { name: "Draftwood Home (Unpublished Demo)", city: "Kent", state: "WA", desc: "Not yet published.", services: ["PERSONAL_CARE"], residential: true, published: false, status: "ACTIVE" },
  { name: "Midtown Day Clinic (Non-Residential Demo)", city: "Seattle", state: "WA", desc: "Outpatient clinic — not a residential provider.", services: ["PHYSICAL_THERAPY"], residential: false, published: true, status: "ACTIVE" },
  { name: "Paused Villa (Paused Demo)", city: "Tacoma", state: "WA", desc: "Temporarily paused.", services: ["PERSONAL_CARE"], residential: true, published: true, status: "PAUSED" },
];

async function main(): Promise<void> {
  if (process.argv.includes("--clean")) {
    const removed = await clean();
    console.log(`Removed ${removed} demo organization(s) tagged ${MARK}.`);
    return;
  }

  await clean(); // idempotent: start fresh

  const [images, cats, langs, pays] = await Promise.all([
    prisma.blogPost.findMany({ where: { featuredImageUrl: { not: null } }, select: { featuredImageUrl: true } }),
    prisma.serviceCategory.findMany({ where: { active: true }, select: { id: true, code: true } }),
    prisma.language.findMany({ where: { active: true }, select: { id: true, name: true } }),
    prisma.paymentType.findMany({ where: { active: true }, select: { id: true } }),
  ]);
  const imageUrls = images.map((i) => i.featuredImageUrl!).filter(Boolean);
  const catByCode = new Map(cats.map((c) => [c.code, c.id]));
  const english = langs.find((l) => /english/i.test(l.name))?.id;
  const spanish = langs.find((l) => /spanish/i.test(l.name))?.id;

  let created = 0;
  for (let i = 0; i < SPECS.length; i++) {
    const s = SPECS[i];
    const org = await prisma.organization.create({ data: { type: "PROVIDER", name: s.name, externalRef: MARK } });
    const serviceIds = s.services.map((code) => catByCode.get(code)).filter((id): id is string => Boolean(id));

    await prisma.provider.create({
      data: {
        organizationId: org.id,
        status: s.status,
        displayName: s.name,
        description: s.desc,
        phone: `(253) 555-01${String(i).padStart(2, "0")}`,
        email: `hello@${slugify(s.name).slice(0, 24)}.example`,
        website: `https://${slugify(s.name).slice(0, 24)}.example`,
        addressLine1: `${100 + i} Main St`,
        city: s.city,
        state: s.state,
        postalCode: "98000",
        isResidentialProvider: s.residential,
        publicListingEnabled: s.published,
        publicSlug: s.published ? slugify(s.name) : null,
        publicDescription: s.desc,
        publicFeaturedImageUrl: s.published && imageUrls.length ? imageUrls[i % imageUrls.length] : null,
        publicSortOrder: i,
        publicPublishedAt: s.published ? new Date() : null,
        services: { create: serviceIds.map((serviceCategoryId) => ({ serviceCategoryId, active: true })) },
        languages: {
          create: [english ? { languageId: english, active: true } : null, i % 2 === 0 && spanish ? { languageId: spanish, active: true } : null].filter(
            (x): x is { languageId: string; active: boolean } => x !== null,
          ),
        },
        paymentTypes: { create: pays.slice(0, 2).map((p) => ({ paymentTypeId: p.id, active: true })) },
        hours: { create: WEEKDAYS.map((dayOfWeek) => ({ dayOfWeek, opensAt: "08:00", closesAt: "18:00" })) },
      },
    });
    created++;
  }
  console.log(`Seeded ${created} demo provider(s) (${SPECS.filter((s) => s.published && s.residential && s.status === "ACTIVE").length} publicly visible). Tag: ${MARK}.`);
}

main()
  .catch((e) => {
    console.error("Demo seed failed:", e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
