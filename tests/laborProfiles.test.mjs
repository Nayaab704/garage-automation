import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  fetchSelectableLaborProfileById,
  fetchSelectableLaborProfiles,
  formatLaborProfileName,
  isLaborProfileSelectable,
  sortLaborProfiles,
} from "../src/lib/laborProfiles.js";

function createListClient(response) {
  const calls = [];
  const query = {
    eq(column, value) {
      calls.push(["eq", column, value]);
      return query;
    },
    from(table) {
      calls.push(["from", table]);
      return query;
    },
    is(column, value) {
      calls.push(["is", column, value]);
      return query;
    },
    order(column, options) {
      calls.push(["order", column, options]);
      return query;
    },
    select(columns) {
      calls.push(["select", columns]);
      return query;
    },
    then(onFulfilled, onRejected) {
      return Promise.resolve(response).then(onFulfilled, onRejected);
    },
  };

  return { calls, client: query };
}

test("labor profile eligibility requires active and non-removed state", () => {
  assert.equal(
    isLaborProfileSelectable({ id: "active", is_active: true, removed_at: null }),
    true
  );
  assert.equal(
    isLaborProfileSelectable({ id: "inactive", is_active: false, removed_at: null }),
    false
  );
  assert.equal(
    isLaborProfileSelectable({
      id: "removed",
      is_active: true,
      removed_at: "2026-08-13T12:00:00Z",
    }),
    false
  );
  assert.equal(
    isLaborProfileSelectable({
      id: "alternate-removed",
      is_active: true,
      removed_at: null,
      status: "removed",
    }),
    false
  );
});

test("labor profile names prefer full name and fall back to email username", () => {
  assert.equal(
    formatLaborProfileName({ full_name: "  Fareez Ahmed  ", email: "f@example.com" }),
    "Fareez Ahmed"
  );
  assert.equal(
    formatLaborProfileName({ full_name: "", email: "fareez@example.com" }),
    "fareez"
  );
});

test("labor profiles are filtered and sorted for selection", () => {
  const profiles = sortLaborProfiles([
    {
      id: "z",
      full_name: "Zara",
      is_active: true,
      removed_at: null,
    },
    {
      id: "inactive",
      full_name: "Inactive",
      is_active: false,
      removed_at: null,
    },
    {
      id: "a",
      full_name: "Ali",
      is_active: true,
      removed_at: null,
    },
  ]);

  assert.deepEqual(
    profiles.map((profile) => profile.id),
    ["a", "z"]
  );
});

test("selectable profile query applies active and non-removed filters", async () => {
  const activeProfile = {
    id: "active",
    full_name: "Active User",
    is_active: true,
    removed_at: null,
  };
  const { calls, client } = createListClient({ data: [activeProfile], error: null });

  const profiles = await fetchSelectableLaborProfiles(client);

  assert.deepEqual(profiles, [activeProfile]);
  assert.ok(calls.some((call) => call[0] === "eq" && call[1] === "is_active" && call[2] === true));
  assert.ok(calls.some((call) => call[0] === "is" && call[1] === "removed_at" && call[2] === null));
  assert.deepEqual(
    calls.filter((call) => call[0] === "order").map((call) => call[1]),
    ["full_name", "email"]
  );
});

test("save-time profile lookup returns only an eligible profile", async () => {
  const calls = [];
  const profile = {
    id: "active",
    is_active: true,
    removed_at: null,
  };
  const query = {
    eq(column, value) {
      calls.push(["eq", column, value]);
      return query;
    },
    from(table) {
      calls.push(["from", table]);
      return query;
    },
    is(column, value) {
      calls.push(["is", column, value]);
      return query;
    },
    maybeSingle: async () => ({ data: profile, error: null }),
    select(columns) {
      calls.push(["select", columns]);
      return query;
    },
  };

  assert.deepEqual(await fetchSelectableLaborProfileById(query, profile.id), profile);
  assert.ok(calls.some((call) => call[0] === "eq" && call[1] === "id" && call[2] === profile.id));
  assert.ok(calls.some((call) => call[0] === "eq" && call[1] === "is_active" && call[2] === true));
  assert.ok(calls.some((call) => call[0] === "is" && call[1] === "removed_at" && call[2] === null));
});

test("labor UI keeps picker data separate from historical display names", async () => {
  const workOrderFormSource = await readFile(
    new URL("../src/components/vehicle-detail/AddWorkOrderLaborForm.jsx", import.meta.url),
    "utf8"
  );
  const vehicleFileSource = await readFile(
    new URL("../src/pages/VehicleFilePage.jsx", import.meta.url),
    "utf8"
  );
  const migrationSource = await readFile(
    new URL(
      "../supabase/migrations/202608130002_profile_history_display_names.sql",
      import.meta.url
    ),
    "utf8"
  );

  assert.match(workOrderFormSource, /NO_ACTIVE_TEAM_MEMBERS_MESSAGE/);
  assert.match(workOrderFormSource, /fetchSelectableLaborProfileById/);
  assert.match(vehicleFileSource, /from\("profile_history_display_names"\)/);
  assert.match(migrationSource, /where public\.is_active_member\(\)/i);
  assert.doesNotMatch(
    migrationSource,
    /profiles\.removed_at\s+is\s+null/i
  );
});
