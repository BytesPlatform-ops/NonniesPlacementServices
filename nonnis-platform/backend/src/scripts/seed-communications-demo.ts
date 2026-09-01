/**
 * Idempotent DEMO seed for Communications (Phase 15A).
 *
 *   npm run seed:communications-demo            # (re)create demo contacts
 *   npm run seed:communications-demo -- --clean # remove them
 *
 * All contacts are clearly FICTIONAL (no real people, no patient/PHI data). Demo
 * records are grouped under lists named "Demo — …" so they are easy to remove.
 */
import { PrismaClient, type CommunicationConsentStatus } from "@prisma/client";
import { toEmailValue, toPhoneValue } from "../modules/communications/normalization";

const prisma = new PrismaClient();
const LIST_PREFIX = "Demo — ";

async function clean(): Promise<void> {
  const demoLists = await prisma.communicationList.findMany({ where: { name: { startsWith: LIST_PREFIX } }, select: { id: true } });
  const memberIds = (await prisma.communicationListMember.findMany({ where: { listId: { in: demoLists.map((l) => l.id) } }, select: { contactId: true } })).map((m) => m.contactId);
  const c = await prisma.communicationContact.deleteMany({ where: { id: { in: memberIds } } });
  await prisma.communicationList.deleteMany({ where: { name: { startsWith: LIST_PREFIX } } });
  await prisma.communicationTag.deleteMany({ where: { name: { startsWith: "demo-" } } });
  await prisma.communicationSuppression.deleteMany({ where: { source: "Demo seed" } });
  console.log(`Removed ${c.count} demo contact(s) and demo lists/tags/suppressions.`);
}

interface Spec {
  first?: string;
  last?: string;
  email?: string;
  phone?: string;
  org?: string;
  emailConsent?: CommunicationConsentStatus;
  smsConsent?: CommunicationConsentStatus;
  lists: number[]; // indexes into LISTS
  tags: string[];
}

const LISTS = ["Demo — Hospital Outreach", "Demo — Newsletter"];

const SPECS: Spec[] = [
  { first: "Ada", last: "Reyes", email: "ada.reyes@demo.test", phone: "+1 415 555 0161", org: "Demo Health Partners", emailConsent: "OPTED_IN", smsConsent: "OPTED_IN", lists: [0, 1], tags: ["demo-vip"] },
  { first: "Ben", last: "Okafor", email: "ben.okafor@demo.test", emailConsent: "OPTED_IN", lists: [1], tags: ["demo-partner"] },
  { first: "Cara", last: "Nguyen", phone: "+1 206 555 0132", smsConsent: "OPTED_IN", lists: [0], tags: [] },
  { first: "Dan", last: "Mostoller", email: "dan.m@demo.test", phone: "+1 312 555 0155", lists: [0], tags: ["demo-vip"] },
  { first: "Eve", last: "Larsson", email: "eve.larsson@demo.test", emailConsent: "OPTED_OUT", lists: [1], tags: [] },
  { first: "Finn", last: "Doyle", phone: "+1 503 555 0176", smsConsent: "OPTED_OUT", lists: [0], tags: [] },
  { first: "Gia", last: "Romano", email: "gia.romano@demo.test", emailConsent: "UNKNOWN", lists: [1], tags: ["demo-partner"] },
  { first: "Hugo", last: "Weiss", email: "hugo.weiss@demo.test", phone: "+1 617 555 0188", org: "Demo Senior Care", emailConsent: "OPTED_IN", smsConsent: "UNKNOWN", lists: [0, 1], tags: [] },
  { first: "Ivy", last: "Park", email: "ivy.park@demo.test", org: "Demo Rehab Group", lists: [1], tags: ["demo-vip"] },
  { first: "Jon", last: "Feld", phone: "+1 646 555 0110", org: "Demo Home Care", lists: [0], tags: [] },
  { first: "Kai", last: "Winters", email: "kai.winters@demo.test", emailConsent: "OPTED_IN", lists: [1], tags: [] },
  { first: "Lena", last: "Sato", email: "lena.sato@demo.test", phone: "+1 213 555 0143", emailConsent: "OPTED_IN", smsConsent: "OPTED_IN", lists: [0], tags: ["demo-partner"] },
  { first: "Mara", last: "Costa", email: "mara.costa@demo.test", org: "Demo Placement Co", emailConsent: "UNKNOWN", lists: [1], tags: [] },
  { first: "Nate", last: "Boone", phone: "+1 305 555 0129", smsConsent: "UNKNOWN", lists: [0], tags: [] },
  // These two are also seeded into suppression below.
  { first: "Opal", last: "Frank", email: "opal.frank@demo.test", emailConsent: "OPTED_OUT", lists: [1], tags: [] },
  { first: "Pax", last: "Ryan", phone: "+1 425 555 0117", smsConsent: "OPTED_OUT", lists: [0], tags: [] },
];

async function main(): Promise<void> {
  if (process.argv.includes("--clean")) {
    await clean();
    return;
  }
  await clean(); // idempotent refresh

  const lists = await Promise.all(LISTS.map((name) => prisma.communicationList.create({ data: { name } })));

  let created = 0;
  const now = new Date();
  for (const s of SPECS) {
    const email = s.email ? toEmailValue(s.email) : null;
    const phone = s.phone ? toPhoneValue(s.phone, "US") : null;
    if (!email && !phone) {
      console.warn(`Skipped ${s.first} ${s.last}: no valid channel (phone parse failed?)`);
      continue;
    }
    const contact = await prisma.communicationContact.create({
      data: {
        firstName: s.first ?? null,
        lastName: s.last ?? null,
        email: email?.display ?? null,
        normalizedEmail: email?.normalized ?? null,
        phone: phone?.display ?? null,
        normalizedPhoneE164: phone?.e164 ?? null,
        organizationName: s.org ?? null,
        source: "MANUAL",
        preferences: {
          create: [
            ...(email ? [{ channel: "EMAIL" as const, consentStatus: s.emailConsent ?? "UNKNOWN", consentAt: s.emailConsent === "OPTED_IN" ? now : null, optOutAt: s.emailConsent === "OPTED_OUT" ? now : null }] : []),
            ...(phone ? [{ channel: "SMS" as const, consentStatus: s.smsConsent ?? "UNKNOWN", consentAt: s.smsConsent === "OPTED_IN" ? now : null, optOutAt: s.smsConsent === "OPTED_OUT" ? now : null }] : []),
          ],
        },
        listMemberships: { create: s.lists.map((i) => ({ listId: lists[i].id })) },
        tagAssignments: {
          create: await Promise.all(
            s.tags.map(async (name) => ({ tag: { connectOrCreate: { where: { name }, create: { name } } } })),
          ),
        },
      },
    });
    created++;
    // Suppress the two designated demo addresses.
    if (s.email === "opal.frank@demo.test" && email) {
      await prisma.communicationSuppression.create({ data: { channel: "EMAIL", normalizedAddress: email.normalized, reason: "USER_OPT_OUT", source: "Demo seed" } });
    }
    if (s.phone === "+1 425 555 0117" && phone) {
      await prisma.communicationSuppression.create({ data: { channel: "SMS", normalizedAddress: phone.e164, reason: "USER_OPT_OUT", source: "Demo seed" } });
    }
    void contact;
  }
  console.log(`Seeded ${created} demo contact(s), ${lists.length} lists, tags, and 2 suppressions.`);
}

main()
  .catch((e) => {
    console.error("Demo seed failed:", e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
