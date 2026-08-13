import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/202608120002_app_settings_po_shipping.sql",
    import.meta.url
  ),
  "utf8"
).replace(/\s+/g, " ").toLowerCase();
const appSettingsSource = readFileSync(
  new URL("../src/lib/appSettings.js", import.meta.url),
  "utf8"
);
const createPurchaseOrderSource = readFileSync(
  new URL(
    "../src/components/vehicle-detail/CreatePurchaseOrderForm.jsx",
    import.meta.url
  ),
  "utf8"
);
const teamManagementSource = readFileSync(
  new URL("../src/pages/TeamManagementPage.jsx", import.meta.url),
  "utf8"
);
const defaultsCardSource = readFileSync(
  new URL(
    "../src/components/settings/PurchaseOrderDefaultsCard.jsx",
    import.meta.url
  ),
  "utf8"
);

test("PO shipping setting starts at zero with active-member read and admin-only writes", () => {
  assert.match(migration, /create table if not exists public\.app_settings/);
  assert.match(
    migration,
    /values \('default_po_shipping_cost', '0'::jsonb\)/
  );
  assert.match(migration, /key = 'default_po_shipping_cost' and public\.is_active_member\(\)/);
  assert.match(
    migration,
    /for insert to authenticated with check \(public\.is_admin_or_manager\(\)\)/
  );
  assert.match(
    migration,
    /for update to authenticated using \(public\.is_admin_or_manager\(\)\) with check \(public\.is_admin_or_manager\(\)\)/
  );
  assert.doesNotMatch(migration, /update public\.purchase_order/);
});

test("new PO forms fetch the setting, fall back to zero, and keep every quick option", () => {
  assert.match(
    appSettingsSource,
    /DEFAULT_PO_SHIPPING_COST_FALLBACK = 0/
  );
  assert.match(
    appSettingsSource,
    /PO_SHIPPING_QUICK_OPTIONS = \[0, 50, 100, 150\]/
  );
  assert.match(createPurchaseOrderSource, /fetchDefaultPoShippingCost\(\)/);
  assert.match(
    createPurchaseOrderSource,
    /total: subtotal \+ shippingCost \+ tax/
  );
  assert.doesNotMatch(createPurchaseOrderSource, /shipping_cost:\s*["']100["']/);
});

test("Team Management exposes the compact admin PO default editor", () => {
  assert.match(teamManagementSource, /PurchaseOrderDefaultsCard/);
  assert.match(defaultsCardSource, /Purchase Order Defaults/);
  assert.match(defaultsCardSource, /Default Shipping Cost/);
  assert.match(defaultsCardSource, /Save Default/);
  assert.match(defaultsCardSource, /Default PO shipping updated\./);
  assert.match(defaultsCardSource, /isAdminOrManagerRole/);
  assert.match(defaultsCardSource, /if \(!canManageDefaults\) \{\s+return null;/);
});
