import { PrismaClient } from "@prisma/client";
import {
  PERMISSION_DESCRIPTIONS,
  PERMISSIONS,
  ROLE_DEFINITIONS,
  type PermissionCode,
  type RoleCode,
} from "../src/common/rbac";

const prisma = new PrismaClient();

/**
 * Idempotent seed of roles, permissions, and role→permission mappings.
 * Uses upserts so repeated runs never create duplicates, and prunes stale
 * mappings so the database always matches the RBAC definitions.
 */
async function main(): Promise<void> {
  // 1. Permissions
  const permissionCodes = Object.values(PERMISSIONS) as PermissionCode[];
  for (const code of permissionCodes) {
    await prisma.permission.upsert({
      where: { code },
      update: { description: PERMISSION_DESCRIPTIONS[code] },
      create: { code, description: PERMISSION_DESCRIPTIONS[code] },
    });
  }
  const permissions = await prisma.permission.findMany();
  const permissionIdByCode = new Map(permissions.map((p) => [p.code, p.id]));

  // 2. Roles + their permission mappings
  const roleCodes = Object.keys(ROLE_DEFINITIONS) as RoleCode[];
  for (const code of roleCodes) {
    const def = ROLE_DEFINITIONS[code];
    const role = await prisma.role.upsert({
      where: { code },
      update: { name: def.name, description: def.description, isSystem: true },
      create: { code, name: def.name, description: def.description, isSystem: true },
    });

    const wantedPermissionIds = def.permissions
      .map((c) => permissionIdByCode.get(c))
      .filter((id): id is string => Boolean(id));

    // Add/keep wanted mappings.
    for (const permissionId of wantedPermissionIds) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId } },
        update: {},
        create: { roleId: role.id, permissionId },
      });
    }

    // Prune mappings no longer in the definition (keeps system roles exact).
    await prisma.rolePermission.deleteMany({
      where: { roleId: role.id, permissionId: { notIn: wantedPermissionIds } },
    });
  }

  // 3. Reference catalogs (idempotent by code). These are admin-editable; the
  //    seed only ensures a sensible starting set exists and never deletes rows.
  const serviceCategories: Array<{ code: string; name: string; sortOrder: number }> = [
    { code: "HOME_HEALTH", name: "Home Health" },
    { code: "SKILLED_NURSING", name: "Skilled Nursing" },
    { code: "PHYSICAL_THERAPY", name: "Physical Therapy" },
    { code: "OCCUPATIONAL_THERAPY", name: "Occupational Therapy" },
    { code: "SPEECH_THERAPY", name: "Speech Therapy" },
    { code: "PERSONAL_CARE", name: "Personal Care" },
    { code: "HOMEMAKER", name: "Homemaker" },
    { code: "HOSPICE", name: "Hospice" },
    { code: "PALLIATIVE_CARE", name: "Palliative Care" },
    { code: "INFUSION", name: "Infusion" },
    { code: "WOUND_CARE", name: "Wound Care" },
    { code: "BEHAVIORAL_HEALTH", name: "Behavioral Health" },
    { code: "DURABLE_MEDICAL_EQUIPMENT", name: "Durable Medical Equipment" },
    { code: "TRANSPORTATION", name: "Transportation" },
    { code: "OTHER", name: "Other" },
  ].map((c, i) => ({ ...c, sortOrder: i }));
  for (const c of serviceCategories) {
    await prisma.serviceCategory.upsert({
      where: { code: c.code },
      update: { name: c.name, sortOrder: c.sortOrder },
      create: { code: c.code, name: c.name, sortOrder: c.sortOrder },
    });
  }

  const paymentTypes: Array<{ code: string; name: string }> = [
    { code: "PRIVATE_PAY", name: "Private Pay" },
    { code: "MEDICARE", name: "Medicare" },
    { code: "MEDICAID", name: "Medicaid" },
    { code: "MEDICAID_PENDING", name: "Medicaid Pending" },
    { code: "VA", name: "VA Benefits" },
    { code: "LONG_TERM_CARE_INSURANCE", name: "Long-Term Care Insurance" },
    { code: "COMMERCIAL_INSURANCE", name: "Commercial Insurance" },
    { code: "OTHER", name: "Other" },
  ];
  for (let i = 0; i < paymentTypes.length; i++) {
    const p = paymentTypes[i]!;
    await prisma.paymentType.upsert({
      where: { code: p.code },
      update: { name: p.name, sortOrder: i },
      create: { code: p.code, name: p.name, sortOrder: i },
    });
  }

  const languages: Array<{ code: string; name: string }> = [
    { code: "EN", name: "English" },
    { code: "ES", name: "Spanish" },
    { code: "ZH", name: "Chinese" },
    { code: "VI", name: "Vietnamese" },
    { code: "TL", name: "Tagalog" },
    { code: "KO", name: "Korean" },
    { code: "RU", name: "Russian" },
    { code: "AR", name: "Arabic" },
  ];
  for (let i = 0; i < languages.length; i++) {
    const l = languages[i]!;
    await prisma.language.upsert({
      where: { code: l.code },
      update: { name: l.name, sortOrder: i },
      create: { code: l.code, name: l.name, sortOrder: i },
    });
  }

  // 4. Demo public-website content (blog / short videos / testimonials).
  //    Idempotent: blog posts upsert by stable slug; videos/testimonials upsert
  //    by fixed demo UUIDs. Media reuses EXISTING website /public assets so demos
  //    actually render and play. Demo copy is original and clearly non-real.
  await seedContent();

  const [permissionCount, roleCount, mappingCount, categoryCount, paymentCount, languageCount, blogCount, videoCount, testimonialCount] = await Promise.all([
    prisma.permission.count(),
    prisma.role.count(),
    prisma.rolePermission.count(),
    prisma.serviceCategory.count(),
    prisma.paymentType.count(),
    prisma.language.count(),
    prisma.blogPost.count(),
    prisma.shortVideo.count(),
    prisma.testimonial.count(),
  ]);
  console.log(
    `Seed complete: ${permissionCount} permissions, ${roleCount} roles, ${mappingCount} role-permission mappings, ` +
      `${categoryCount} service categories, ${paymentCount} payment types, ${languageCount} languages, ` +
      `${blogCount} blog posts, ${videoCount} short videos, ${testimonialCount} testimonials.`,
  );
}

/** Idempotent demo content for the public website CMS. */
async function seedContent(): Promise<void> {
  const publishedAt = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000);

  const blogPosts: Array<{ slug: string; title: string; category: string; excerpt: string; displayAuthor: string; featuredImageUrl: string; metaDescription: string; daysAgo: number; body: string }> = [
    {
      slug: "planning-a-safe-hospital-discharge",
      title: "Planning a Safe Hospital Discharge",
      category: "Hospital Discharge",
      excerpt: "A calm, well-coordinated discharge starts long before the day itself. Here is how families and care teams can prepare together.",
      displayAuthor: "Nonnis Care Team",
      featuredImageUrl: "/assets/images/nurse-tablet-care-plan.jpg",
      metaDescription: "How families and discharge teams can prepare for a calm, well-coordinated hospital discharge.",
      daysAgo: 3,
      body: [
        "Leaving the hospital is a milestone — but the hours around a discharge can feel rushed and uncertain. A little preparation turns a stressful hand-off into a confident next step.",
        "## Start the conversation early",
        "Ask the care team what recovery will realistically require at home: mobility support, wound care, therapy visits, or new equipment. The earlier these needs are named, the more time there is to arrange the right support.",
        "## Build a simple checklist",
        "A short, shared checklist keeps everyone aligned. Consider:",
        "- Who will be at home for the first 48 hours",
        "- Which services need to be scheduled before discharge",
        "- How medications and follow-up appointments will be tracked",
        "## Confirm the details in writing",
        "Before the day arrives, confirm the destination, transportation, and any provider placements. When the plan is written down and agreed, the discharge itself becomes the easy part.",
      ].join("\n\n"),
    },
    {
      slug: "questions-families-should-ask-before-placement",
      title: "Questions Families Should Ask Before Placement",
      category: "Family Resources",
      excerpt: "Choosing care is deeply personal. These questions help families compare options with clarity and confidence.",
      displayAuthor: "Nonnis Care Team",
      featuredImageUrl: "/assets/images/family-portrait.jpg",
      metaDescription: "Practical questions to help families compare care options with clarity and confidence.",
      daysAgo: 8,
      body: [
        "When a loved one needs additional support, families are often asked to make big decisions quickly. The right questions bring the important details into focus.",
        "## About daily life",
        "Ask how a typical day is structured, how staff get to know each resident, and how families stay involved. The answers reveal a provider's real culture.",
        "## About care and safety",
        "Understand staffing levels, how changes in condition are handled, and how the team coordinates with physicians and hospitals.",
        "## About fit",
        "Every family has priorities that matter most to them:",
        "- Proximity to family and familiar community",
        "- Language, cultural, and dietary preferences",
        "- Activities and social connection",
        "There are no wrong questions. A provider that welcomes them is usually a provider worth considering.",
      ].join("\n\n"),
    },
    {
      slug: "understanding-levels-of-care",
      title: "Understanding Levels of Care",
      category: "Care Planning",
      excerpt: "From independent support to skilled nursing, understanding the levels of care makes planning far less overwhelming.",
      displayAuthor: "Nonnis Care Team",
      featuredImageUrl: "/assets/images/caregiver-resident-room.jpg",
      metaDescription: "A plain-language guide to the common levels of care, from independent support to skilled nursing.",
      daysAgo: 15,
      body: [
        "\"Level of care\" is one of those phrases that gets used often and explained rarely. Here is a plain-language overview.",
        "## Supportive and personal care",
        "Help with everyday activities — meals, bathing, mobility, and companionship — while preserving as much independence as possible.",
        "## Skilled and intermediate care",
        "When recovery or a condition calls for licensed clinical support, skilled care brings nursing and therapy into the plan.",
        "## Matching needs to setting",
        "The goal is never simply *more* care — it is the *right* care. A thoughtful assessment looks at:",
        "1. Current clinical needs",
        "2. How those needs may change",
        "3. The setting where a person will feel most at home",
        "Understanding these levels turns an overwhelming decision into a series of manageable ones.",
      ].join("\n\n"),
    },
    {
      slug: "what-makes-a-great-care-provider",
      title: "What Makes a Great Care Provider",
      category: "Provider Insights",
      excerpt: "Beyond credentials, the best providers share a few qualities that families notice immediately.",
      displayAuthor: "Nonnis Care Team",
      featuredImageUrl: "/assets/images/provider-facility-care.jpg",
      metaDescription: "The qualities — beyond credentials — that distinguish an exceptional care provider.",
      daysAgo: 22,
      body: [
        "Credentials and licensing matter, but they are the starting line, not the finish. The providers families trust most tend to share a few traits.",
        "## Communication that respects the family",
        "Great providers explain clearly, respond promptly, and treat families as partners in care rather than bystanders.",
        "## Consistency and follow-through",
        "A plan is only as good as its execution. The best teams do what they said they would, and say so when something changes.",
        "## Genuine warmth",
        "Skilled, reliable, and kind is a rare combination — and it is exactly what makes a placement feel like the right one.",
      ].join("\n\n"),
    },
    {
      slug: "transitioning-to-senior-living-with-confidence",
      title: "Transitioning to Senior Living with Confidence",
      category: "Senior Living",
      excerpt: "A move to senior living is a new chapter, not an ending. Thoughtful planning helps everyone embrace it.",
      displayAuthor: "Nonnis Care Team",
      featuredImageUrl: "/assets/images/assisted-living-community.jpg",
      metaDescription: "How thoughtful planning helps families embrace a move to senior living with confidence.",
      daysAgo: 30,
      body: [
        "For many families, a move to senior living carries mixed emotions. With preparation, it can become a genuinely positive transition.",
        "## Involve your loved one",
        "Whenever possible, include the person moving in every decision. Choice and dignity make all the difference.",
        "## Make the new space feel like home",
        "Familiar photos, a favorite chair, and cherished routines help a new place feel personal quickly.",
        "## Stay connected",
        "Regular visits, shared meals, and community activities keep relationships strong. A new chapter is best written together.",
      ].join("\n\n"),
    },
  ];

  for (const p of blogPosts) {
    await prisma.blogPost.upsert({
      where: { slug: p.slug },
      // NOTE: `update` deliberately omits featuredImageUrl so re-running this seed
      // never clobbers the Supabase URLs set by `npm run content:seed-media`.
      update: { title: p.title, category: p.category, excerpt: p.excerpt, body: p.body, displayAuthor: p.displayAuthor, metaDescription: p.metaDescription, status: "PUBLISHED", publishedAt: publishedAt(p.daysAgo) },
      create: { slug: p.slug, title: p.title, category: p.category, excerpt: p.excerpt, body: p.body, displayAuthor: p.displayAuthor, featuredImageUrl: p.featuredImageUrl, metaDescription: p.metaDescription, status: "PUBLISHED", publishedAt: publishedAt(p.daysAgo) },
    });
  }

  const videos: Array<{ id: string; title: string; caption: string; videoUrl: string; posterImageUrl: string; sourceLabel: string; sortOrder: number }> = [
    { id: "51de0000-0000-4000-8000-000000000001", title: "A Day of Coordinated Care", caption: "How a Nonnis placement comes together, start to finish.", videoUrl: "/assets/videos/hero-care-loop.mp4", posterImageUrl: "/assets/images/senior-wellness.jpg", sourceLabel: "Nonnis Stories", sortOrder: 0 },
    { id: "51de0000-0000-4000-8000-000000000002", title: "Meet a Care Provider", caption: "A look at the people behind exceptional care.", videoUrl: "/assets/videos/provider-care-loop.mp4", posterImageUrl: "/assets/images/provider-staff.jpg", sourceLabel: "Provider Spotlight", sortOrder: 1 },
    { id: "51de0000-0000-4000-8000-000000000003", title: "Home Care Check-In", caption: "Support that fits comfortably into everyday life.", videoUrl: "/assets/videos/home-care-checkup.mp4", posterImageUrl: "/assets/images/nurse-tablet-care-plan.jpg", sourceLabel: "Nonnis Stories", sortOrder: 2 },
    { id: "51de0000-0000-4000-8000-000000000004", title: "The Care Loop", caption: "Assessment, matching, and follow-through — in motion.", videoUrl: "/assets/videos/care-loop-2.mp4", posterImageUrl: "/assets/images/caregiver-resident-room.jpg", sourceLabel: "How It Works", sortOrder: 3 },
    { id: "51de0000-0000-4000-8000-000000000005", title: "Families, Supported", caption: "Guidance at every step of the journey.", videoUrl: "/assets/videos/care-loop-3.mp4", posterImageUrl: "/assets/images/family-laptop.jpg", sourceLabel: "Family Resources", sortOrder: 4 },
  ];

  for (const v of videos) {
    await prisma.shortVideo.upsert({
      where: { id: v.id },
      // `update` omits videoUrl/posterImageUrl so re-seeding never clobbers the
      // Supabase URLs set by `npm run content:seed-media`.
      update: { title: v.title, caption: v.caption, sourceLabel: v.sourceLabel, sortOrder: v.sortOrder, active: true },
      create: { id: v.id, title: v.title, caption: v.caption, videoUrl: v.videoUrl, posterImageUrl: v.posterImageUrl, sourceLabel: v.sourceLabel, sortOrder: v.sortOrder, active: true, publishedAt: new Date() },
    });
  }

  const testimonials: Array<{ id: string; quote: string; clientName: string; clientTitle: string; organization: string; location: string; featured: boolean; sortOrder: number }> = [
    { id: "7e5710a1-0000-4000-8000-000000000001", quote: "They turned an overwhelming week into a clear, calm plan. We always knew the next step.", clientName: "Demo Family Testimonial", clientTitle: "Daughter of a client", organization: "", location: "Sacramento, CA", featured: true, sortOrder: 0 },
    { id: "7e5710a1-0000-4000-8000-000000000002", quote: "Coordination with our discharge team was seamless. The placement was ready before the patient left our floor.", clientName: "Demo Hospital Partner", clientTitle: "Case Manager", organization: "Demo Regional Medical Center", location: "", featured: true, sortOrder: 1 },
    { id: "7e5710a1-0000-4000-8000-000000000003", quote: "As a provider, the referrals we receive are thoughtful and well-matched. It makes our work easier.", clientName: "Demo Provider Partner", clientTitle: "Director of Admissions", organization: "Demo Home Health Agency", location: "", featured: false, sortOrder: 2 },
    { id: "7e5710a1-0000-4000-8000-000000000004", quote: "Every question was answered with patience. We never felt like just another case.", clientName: "Demo Family Testimonial", clientTitle: "Son of a client", organization: "", location: "Roseville, CA", featured: false, sortOrder: 3 },
    { id: "7e5710a1-0000-4000-8000-000000000005", quote: "The team understood our mother's needs and her personality. The match felt genuinely personal.", clientName: "Demo Family Testimonial", clientTitle: "Family member", organization: "", location: "Elk Grove, CA", featured: false, sortOrder: 4 },
    { id: "7e5710a1-0000-4000-8000-000000000006", quote: "Reliable, responsive, and kind. That combination is rarer than it should be.", clientName: "Demo Discharge Professional", clientTitle: "Discharge Planner", organization: "Demo Rehabilitation Center", location: "", featured: false, sortOrder: 5 },
    { id: "7e5710a1-0000-4000-8000-000000000007", quote: "We had a placement arranged within a day, and the follow-up afterward was just as strong.", clientName: "Demo Hospital Partner", clientTitle: "Social Worker", organization: "Demo Community Hospital", location: "", featured: false, sortOrder: 6 },
    { id: "7e5710a1-0000-4000-8000-000000000008", quote: "They treated our family with dignity and made a hard decision feel manageable.", clientName: "Demo Family Testimonial", clientTitle: "Spouse of a client", organization: "", location: "Folsom, CA", featured: false, sortOrder: 7 },
  ];

  for (const t of testimonials) {
    await prisma.testimonial.upsert({
      where: { id: t.id },
      update: { quote: t.quote, clientName: t.clientName || null, clientTitle: t.clientTitle || null, organization: t.organization || null, location: t.location || null, featured: t.featured, sortOrder: t.sortOrder, active: true },
      create: { id: t.id, quote: t.quote, clientName: t.clientName || null, clientTitle: t.clientTitle || null, organization: t.organization || null, location: t.location || null, featured: t.featured, sortOrder: t.sortOrder, active: true },
    });
  }
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
