const baseUrl = (process.env.SMOKE_BASE_URL || process.env.URL || "http://127.0.0.1:3000").replace(/\/$/, "");

type Probe = {
  name: string;
  path: string;
  method?: "GET" | "POST";
  expectedStatuses: number[];
  body?: Record<string, unknown>;
};

const probes: Probe[] = [
  {
    name: "pricing page",
    path: "/pricing",
    expectedStatuses: [200],
  },
  {
    name: "home page",
    path: "/",
    expectedStatuses: [200],
  },
  {
    name: "feature access endpoint unauthenticated",
    path: "/api/subscriptions/features?feature=payments_online",
    expectedStatuses: [200, 401],
  },
  {
    name: "subscription checkout guarded",
    path: "/api/subscriptions/checkout",
    method: "POST",
    expectedStatuses: [400, 401],
    body: {},
  },
  {
    name: "rent checkout guarded",
    path: "/api/payments/checkout",
    method: "POST",
    expectedStatuses: [400, 401],
    body: {},
  },
];

async function runProbe(probe: Probe) {
  const response = await fetch(`${baseUrl}${probe.path}`, {
    method: probe.method || "GET",
    headers: probe.body ? { "Content-Type": "application/json" } : undefined,
    body: probe.body ? JSON.stringify(probe.body) : undefined,
    redirect: "manual",
  });

  if (!probe.expectedStatuses.includes(response.status)) {
    throw new Error(
      `${probe.name}: statut ${response.status} inattendu pour ${probe.path} (attendus: ${probe.expectedStatuses.join(", ")})`
    );
  }

  console.log(`OK ${probe.name} -> ${response.status}`);
}

async function main() {
  console.log(`Smoke Netlify sur ${baseUrl}`);
  for (const probe of probes) {
    await runProbe(probe);
  }
}

main().catch((error) => {
  console.error("Smoke Netlify en échec:", error);
  process.exitCode = 1;
});
