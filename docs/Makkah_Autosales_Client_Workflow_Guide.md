# Makkah Autosales App - Client Workflow Guide

This guide explains how to use the Makkah Autosales Garage Automation app from the time a vehicle arrives until its warranty has expired and its old operational record is removed.

The guide uses simple steps and follows the screens and actions in the current app. Some screens or buttons are hidden when a user does not have permission to use them.

## 1. Purpose of the app

The app keeps the garage's vehicle work in one connected flow:

**Intake -> Inspection -> Repair -> Parts / Purchase Orders -> Quality Check -> Ready for Sale -> Sold -> Warranty -> Expired Warranty Cleanup**

Use it to:

- add vehicles and give each one a stock number;
- record inspections, work orders, photos, parts, labor, outside repairs, documents, and extra costs;
- order parts from vendors and record when they arrive or are returned;
- check the full cost and work history of a vehicle;
- complete the final quality checklist;
- record a sale and warranty;
- export a compact record when a warranty expires, then remove old vehicle-specific data to save storage; and
- keep reusable business information, such as vendors and previous vendor prices.

Owner/Admin users can use all main features. Managers can manage the day-to-day app and financial areas, although a few protected actions are reserved for Owner/Admin. Technicians can work on operational tasks without seeing sensitive admin, sales, warranty, or full-finance areas.

(The app is designed for phones and tablets. It can be installed from the browser and opened from the home screen.)

## 2. Installing the app on a phone

The app still needs an internet connection for login and live garage data.

### iPhone or iPad

1. Open the app link in **Safari**.
2. Tap the **Share** button.
3. Tap **Add to Home Screen**.
4. Tap **Add**.
5. Open the app from the new home-screen icon.

(Use Safari for the normal iPhone installation option.)

### Android phone or tablet

1. Open the app link in **Chrome**.
2. Tap the **three dots** menu.
3. Tap **Install App** or **Add to Home Screen**.
4. Tap **Install** or **Add**.
5. Open the app from the new home-screen icon.

(The wording can be slightly different on different Android phones.)

### App updates

After a new version is deployed, refresh the app or close and reopen it to load the latest version.

(There is no separate app-store update. The installed icon opens the current web app.)

## 3. Login and user roles

### Login

1. Open the app.
2. Enter the account email and password.
3. Tap **Login**.

(A new account starts inactive and must be approved before it can enter the app.)

### Main roles

| Role | Normal access |
| --- | --- |
| **Owner / Admin** | Full operational, financial, sale, warranty, report, vendor, and team access. |
| **Manager** | Broad day-to-day and financial access, including Dashboard, Intake, Reports, Warranties, and Team. Some protected actions, such as ordinary vehicle deletion, vendor maintenance, part approval, and final-check ticking, are not the same as Owner/Admin access. |
| **Technician** | My Work, Vehicles, Repairs, Parts, Purchase Orders, Vendors, vehicle work, photos, labor, and work status actions. Sensitive dashboard finance, sales, warranties, reports, extra costs, Team, and general deletion are hidden. |

(The normal Team role choices are Admin, Manager, and Technician. Older or specialized Ordering/Sales roles may also exist, but they are not normal new role choices.)

There is no separate main-menu **Sales** page. A sale is recorded inside **Vehicle Detail** or **Vehicle File**. Sale results appear on the Dashboard, Reports, and Warranty Register.

The **Team** page lets an authorized manager of users:

- approve or reactivate an account;
- deactivate an account;
- change another user's name or role;
- set hourly labor rates;
- soft-remove a team member; and
- restore a removed team member.

(Removed and inactive users cannot use the app. Their old work history remains connected to their name.)

## 4. Main workflow: from intake to sold and cleanup

### Quick flow

**Intake -> Inspection -> Repair -> Parts Needed -> Waiting Parts -> In Progress -> Completed -> Quality Check -> Ready for Sale -> Sold -> Warranty -> Expired Cleanup**

### Step 1: Start Intake

Go to **Intake**, enter the vehicle's full 17-character VIN, and tap **Continue**.

(The VIN is changed to uppercase, spaces are removed, and the box allows up to 17 characters. The app checks the current Vehicles table for a duplicate VIN. Staff should not continue with a partial VIN.)

### Step 2: Complete Vehicle Details

Enter the available information:

- year;
- make and model;
- trim;
- color;
- mileage;
- purchase price;
- target sale price;
- title status;
- vehicle origin; and
- notes.

Take or upload the required clear main vehicle photo.

(Make, model, and a main photo are required. The photo becomes the vehicle's main profile photo.)

The page shows **Next Stock Number: STK-...** before saving. If there are no current vehicle rows, it starts at **STK-1**. If current vehicles include STK-1 and STK-2, it shows STK-3.

(The preview and Create Vehicle use the same stock-number service. Only current vehicles are counted. Deleted old vehicles and vendor quote snapshots do not continue the number. If a second user takes the previewed number first, Intake asks the user to review the refreshed number and try again.)

Optional: turn on **Prebooked** and add customer, phone, deposit, payment method, or notes.

(Prebooking records a reservation without changing the vehicle's workflow status. More prebooking details can be edited later from the vehicle.)

### Step 3: Create the Vehicle

Tap **Create Vehicle**.

(The success screen shows the VIN and stock number. Tap **View Vehicles** to open the list. The vehicle is available immediately.)

(If the vehicle row is created but the photo upload fails, the vehicle remains saved and the app shows a warning. Open Vehicle Detail and add the main photo again.)

### Step 4: Vehicle Starts in Inspection

Every new vehicle starts with **Inspection** status.

(Inspection means the vehicle is newly entered and needs its first review.)

### Step 5: Open the Vehicle

Go to **Vehicles** and tap the vehicle card.

(This opens **Vehicle Detail**, the main working page for that vehicle. The file icon on the card opens **Vehicle File** directly.)

### Step 6: Add a Work Order

In **Service Work**, choose the correct service category and tap **Add Work Order**. Enter:

- repair or issue title;
- priority: Low, Medium, High, or Urgent; and
- optional notes.

Example: **Mechanical -> Brake pads need replacement**.

(A new work order starts as **Needed**. If a technician creates it, it is assigned to that technician. Adding the first work order moves a vehicle from Inspection to Repair.)

### Step 7: Follow the Work Order Status

The normal automatic path is:

- **Needed** - the work order was created;
- **Parts Needed** - a needs-to-buy part was added;
- **Waiting Parts** - a purchase order was created;
- **In Progress** - work started or all required purchased parts were received; and
- **Completed** - the repair was manually marked complete.

(The app changes several statuses automatically. Users do not need to manage every status by hand.)

(Approved, Ordered, Blocked, and Cancelled can also appear when a different situation needs to be recorded.)

### Step 8: Add a Part to the Work Order

Open the work order and tap **Add Part**. Enter:

- part name;
- quantity;
- part source;
- unit cost, if known; and
- notes, if needed.

Choose one part source:

- **In-House** when the part is already at the shop; or
- **Needs to Buy** when it must be purchased.

(In-House is the default. It is recorded as received and does not need approval. Needs to Buy is recorded as requested/pending and appears in both **Needs PO** and **Pending Review** until the workflow changes.)

(The basic part fields do not have a separate vendor box. Select a previous vendor quote, save a new vendor quote, or choose the vendor while creating the PO.)

### Step 9: Use or Save a Vendor Price

After typing at least two characters of the part name, check **Previous Vendor Prices**.

If a useful result appears:

1. Check the vendor, price, availability, date, and vehicle information.
2. Tap **Use This**.
3. Confirm that the selected vendor price and unit cost are correct.
4. Finish adding the part.

(The selected quote connects the vendor and price to the part and can fill the PO details later.)

If no useful price appears:

1. Tap **Add Vendor Quote**.
2. Select an existing Parts Supplier or Both / General vendor.
3. Enter the unit price.
4. Choose availability and add optional notes.
5. Tap **Save Quote**.
6. Finish adding the part.

(A price becomes reusable history only when **Save Quote** is used. Typing only a unit cost on the part or PO does not guarantee a saved vendor suggestion.)

(Vendor quote history remains available after its old vehicle is deleted. It is reusable business memory.)

### Step 10: Create a Purchase Order

From **Parts -> Needs PO** or the part inside its work order, tap **Create PO**. Check or enter:

- vendor;
- part name/description;
- whole-number quantity;
- unit cost;
- shipping;
- tax, if needed; and
- notes.

(The vendor must be an existing Parts Supplier or Both / General vendor. Shipping starts at $100 and has $0, $50, $100, $150, and Custom choices. The form shows the live total.)

(The PO connects the vehicle, work order part, vendor, and cost. The app blocks a second active PO for the same part. An authorized user may create the PO while the needs-to-buy part is still marked Pending Review.)

After creation, the PO, PO item, and part become **Ordered**, and the related work order moves to **Waiting Parts**.

(If a saved quote was selected, its history is marked as purchased. If the part name is corrected in the PO form, the required part name is updated throughout the app.)

### Step 11: Find the Purchase Order

Go to **Purchase Orders** and use these tabs:

- **Ordered**;
- **Received**;
- **Cancelled**; and
- **All**.

Use search or the Vehicle and Vendor filters to find the right PO.

(Search can match VIN, stock number, PO, vendor, or part. Always confirm the vehicle and part before changing the order.)

### Step 12: Mark the Part Received

Open **Purchase Orders -> Ordered**, find the PO, and tap **Mark Received**. Confirm the action.

(The app updates the PO, all non-returned items in that PO, linked part requests, and the received-by/time information. Individual items can also be received from the PO details.)

(A work order moves from Waiting Parts to In Progress only after every non-rejected needs-to-buy part for that work order has been received.)

If an ordered or received item must go back, use **Mark Returned** on the item.

(A return appears in the Parts **Returned** tab and deducts the part subtotal, shipping, and tax from the vehicle cost. Owner/Admin can undo a return when needed.)

### Step 13: Add Labor

Inside the work order, tap **Add Labor**. Enter hours worked and optional notes, then save.

(Hours must be greater than zero and can be entered in quarter-hour steps. The saved cost is hours x the technician's hourly rate.)

(Owner/Admin can select another technician. Other permitted users log against their own profile. If no hourly rate is set, the app warns that the labor cost will save as $0.00.)

(Adding labor moves a Needed or Approved work order to In Progress.)

### Step 14: Complete the Work Order

When the repair is finished, open the work order and tap **Mark Complete**.

(The work order becomes **Completed**. Check the parts, labor, outside repairs, photos, and notes before completing it.)

### Step 15: Complete the Final Checklist

Open **Final Checklist** and complete all required checks.

- There are six Technician checks.
- There are six Admin checks.
- Technicians can complete Technician checks.
- Owner/Admin can complete all checks.

(The first checked item moves an Inspection, Repair, or Ready for Sale vehicle to **Quality Check**.)

(When all 12 checks are complete, the vehicle becomes **Ready for Sale**. Managers can review the progress but do not tick the current checklist rows.)

### Step 16: Ready for Sale Photo Cleanup

When an Owner/Admin/Manager transition makes the vehicle Ready for Sale, the app cleans safe repair photos to reduce storage.

(Repair, before-work, work-order, and temporary photos can be removed. Main, final, protected photos, documents, invoices, and receipts stay at this stage.)

(If cleanup cannot finish, the vehicle can still be Ready for Sale and the app shows a warning. An authorized user can use **Clean Repair Photos** to retry.)

### Step 17: Sell the Vehicle

Open **Sell Vehicle** from Vehicle Detail or **Mark Sold** from Vehicle File. Enter:

- buyer name;
- buyer phone;
- sale price;
- sale date;
- payment method;
- notes; and
- warranty details, if included.

(Sale price and sale date are required. The current Sell form does not have a separate buyer-email field; an email already stored in prebooking can remain with that customer record.)

Tap the button to save the sale.

(After the sale, the vehicle shows one **Sold** badge instead of Ready for Sale. Sold is the business/sale state; the internal repair workflow does not need to be rewritten.)

(After the sale is saved, the app automatically tries to remove the remaining vehicle and repair-linked photos and clears the main-photo link. Text records, documents, invoices, sale details, and warranty details remain.)

(Photo cleanup cannot cancel a saved sale. If it is incomplete, the app shows: **Sale saved, but some photos may need cleanup.**)

### Step 18: Add or Update the Warranty

Warranty is available in the Sell form and can also be added or edited later.

1. Leave Warranty on, or turn it off to record **No Warranty**.
2. Choose a warranty start date.
3. Choose a period from 1 to 12 months.
4. Add optional warranty type and notes.
5. Check the calculated end date and save.

(Warranty starts at three months by default. The app calculates the end date automatically. Authorized users can later use **Edit / Extend Warranty**.)

(If a warranty fails to save after the sale, the sale remains saved. Open the sold vehicle or Warranty Register and add/retry the warranty.)

### Step 19: Use the Warranty Register

Go to **Warranty Register** and choose a tab:

- **All** - all retained sold vehicles in the register;
- **Active** - more than 30 days remain;
- **Expiring Soon** - 0 to 30 days remain;
- **Expired** - the end date is before today; or
- **No Warranty** - a sold vehicle has no warranty record.

(Open a record to add, edit, or extend coverage when the role allows it.)

### Step 20: Clean Up an Expired Warranty Vehicle

Only use this flow for a sold vehicle with a warranty end date before today:

1. Go to **Reports**.
2. Find **Expired Warranty Cleanup**.
3. Tap **Download Archive CSV**.
4. Save the downloaded file safely on the owner's computer or approved business storage.
5. Find the vehicle and tap **Delete From App**.
6. Tick **I downloaded and saved the archive CSV.**
7. Confirm the deletion.

(The download contains all currently eligible records that have not already been exported in that browser session. Delete is enabled only for the exact unchanged records included in that session's CSV.)

(The CSV is a compact permanent reference for the vehicle, sale, warranty, and investment total. It is not a full copy of work orders, parts, labor, photos, or documents.)

(Delete From App removes that vehicle's operational rows and stored photos/documents, including its work, parts, linked POs, labor, costs, outside repairs, sale, warranty, activity, prebooking, and vehicle row. If storage cleanup fails, the database records stay so the user can retry safely.)

(Vendor quotes, vendors, vehicle catalog entries, team profiles, monthly sold-count summaries, and any existing legacy archive rows remain. The cleanup does not create a new full archive row in Supabase.)

(No-Warranty sales do not qualify for expired-warranty cleanup because they have no expired end date.)

## 5. Page-by-page guide

### A. Dashboard

The Dashboard is the management command center. Technicians do not see it.

The main switcher has:

- **Action Center** - urgent, waiting, blocked, or pending work that needs attention;
- **Operations** - active inventory, repair work, parts needing PO, open POs, waiting parts, Quality Check, and Ready for Sale; and
- **Finance** - active investment, estimated active profit, retained sales revenue, and sales information.

The Action Center can link directly to urgent work orders, waiting-parts work, blocked work, parts needing a PO, open POs, pending part reviews, Quality Check vehicles, third-party work, prebookings, and expired warranty cleanup.

The **Sales Summary** includes:

- Total Vehicles Sold;
- Sold This Month;
- Sold This Year; and
- First Sale Month.

(Sold counts remain after expired vehicles are removed because the app keeps a tiny monthly sold-count summary.)

(The value called **Retained Sales Revenue** comes from sale records still kept in the app. It is not a lifetime revenue ledger and can reduce when an expired vehicle's sale record is deleted.)

### B. My Work

My Work is the technician's starting page. It shows:

- active work orders created by or assigned to that technician;
- the technician's activity today; and
- recently touched vehicles.

(Use My Work to return quickly to current jobs without searching the full garage list.)

### C. Intake

Use Intake to:

1. enter the full VIN;
2. check that the VIN is not already in current inventory;
3. review the next stock-number preview;
4. enter vehicle, purchase, title, and origin details;
5. take or upload the required main photo;
6. optionally add a prebooking; and
7. create the vehicle.

(If the next number cannot be loaded, the page says **Stock number will be generated automatically.**)

(After saving, the success screen shows the stock number and provides **View Vehicles**.)

### D. Vehicles

Vehicles shows the current inventory and retained sold vehicles.

Use the status chips for:

- Active;
- Ready for Sale;
- Sold;
- Inspection;
- Repair; and
- Quality Check.

Use search for stock number, VIN, make, model, trim, or color. Sales-capable users can also match saved prebooking customer details. Extra filters include Title Status, Prebooked, and Has 3rd-Party Repair.

(Tap a card for Vehicle Detail. Tap its file icon for Vehicle File. Sold cards show **Sold**, not a second Ready for Sale badge, and use a clean placeholder after photo cleanup.)

(The page loads results in groups. Tap **Load More** when it appears.)

### E. Vehicle Detail

Vehicle Detail is the main working page for one vehicle. It can include:

- vehicle information and main actions;
- prebooking details;
- investment summary;
- service categories and work orders;
- parts and purchase orders inside each work order;
- vehicle and work-order photos;
- labor;
- third-party repairs and invoices;
- extra costs;
- documents and activity;
- final checklist; and
- sale and warranty actions.

Common quick actions inside a work order are **Add Photo**, **Add Labor**, **Add Part**, **Add 3rd-Party**, and **Mark Complete**.

(Adding a work order, part, or third-party repair to an Inspection vehicle moves it to Repair. Starting the final checklist moves it to Quality Check. Completing every final check moves it to Ready for Sale. A saved sale displays Sold.)

#### Prebooking

Use Prebooking to record or edit a reserved customer's name, phone, email, deposit, payment details, status, and notes. A reservation can later be marked Cancelled or Refunded.

(Prebooking does not change the repair workflow status.)

#### Third-party repair

Add a third-party repair inside its work order when a vehicle goes to an outside service vendor. Record the vendor, work, cost/status details, and invoice where applicable.

(Outside work can move a Needed or Approved work order to In Progress and is included in the vehicle's investment total.)

#### Extra costs and documents

Use Extra Costs for costs outside parts, labor, and third-party repairs. Upload vehicle documents, PO receipts, or outside-repair invoices in their matching section.

(Documents and invoices stay when sold photos are cleaned. They are removed only during final expired-warranty vehicle cleanup.)

### F. Vehicle File / Vehicle Summary

Vehicle File is a separate, clean review page for one vehicle. Open it from the file icon or the **Vehicle File** action in Vehicle Detail.

Its tabs are:

- **Work & Parts**;
- **Financial**;
- **Activity**; and
- **Documents**.

It brings together:

- vehicle details;
- work orders and third-party work;
- parts and linked purchase orders;
- part, shipping, tax, and return values;
- labor and extra costs;
- total investment;
- sale/warranty information for permitted users;
- activity history; and
- documents and invoices.

Tap the information icon on a part to review its price breakdown, approval, who ordered/received/returned it, dates, and related PO.

(Owner/Admin/Manager can review full vehicle financial totals. A technician's Financial tab is limited to **My Hours** and **My Labor**.)

(Use Vehicle File when the owner wants one clear history and cost review instead of opening every work section.)

### G. Repairs

Repairs is the global work-order page across all vehicles.

Tabs:

- All;
- In Progress;
- Waiting Parts;
- Urgent; and
- Completed.

Filters:

- Vehicle;
- Service Category; and
- search by VIN, stock, vehicle, or work order.

(Urgent includes High, Critical, and Urgent priority records. Open the related vehicle or use the available work actions from the repair card.)

### H. Parts

Parts is the global parts queue across all vehicles.

Tabs:

- **Needs PO** - needs-to-buy parts without an active PO;
- **Ordered** - an active PO/order exists;
- **Received** - the purchased part arrived;
- **Returned** - the PO item was returned;
- **In-House** - the part is available at the shop;
- **Pending Review** - a needs-to-buy request is waiting for review; and
- **All** - every tracked part.

Use search plus Vendor, Vehicle, and Service Category filters.

Useful actions include:

- **Create PO**;
- **Prices** to see previous vendor prices;
- **Open** to open the vehicle;
- **Approve / Reject** for Owner/Admin review;
- **Need to Buy Instead** when an in-house part is not actually available; and
- **Undo** for an authorized return correction.

(Needs PO and Pending Review are queue views. A pending needs-to-buy part can appear in both views. PO creation is allowed while pending when the user's role permits it.)

### I. Purchase Orders

Purchase Orders tracks ordered parts for all vehicles.

Tabs:

- Ordered;
- Received;
- Cancelled; and
- All.

Use search for VIN, stock, PO, vendor, or part. Use the Vehicle and Vendor filters to narrow the list.

When parts arrive:

1. Open **Purchase Orders**.
2. Open **Ordered**.
3. Search or filter for the vendor, vehicle, or part.
4. Check the vehicle, work order, part, quantity, and vendor.
5. Tap **Mark Received**.
6. Confirm.

(The linked part and related work-order workflow update. A work order waits until all its needed purchased parts have arrived.)

Open **Details** to see items, dates, notes, costs, and uploaded receipt/invoice documents. An eligible item can also be marked Returned.

### J. Vendors

Vendors stores supplier and outside-business details. Vendor types are:

- Parts Supplier;
- Third-Party Repair;
- Both / General; and
- Auction / Source.

The page can show quote count, purchased count, spending, and **View History** for previous quotes and purchases. Search can match a vendor, part, vehicle, or VIN.

(Parts Supplier and Both / General vendors can be used for part quotes and POs. Third-Party Repair and Both / General vendors can be used for outside repairs.)

(Do not delete a real vendor to clean a test price. Vendor records are reusable across vehicles. Edit an incorrect live vendor when permitted.)

### K. Vendor Quote Suggestions

Vendor Quote Suggestions is not a separate main-menu page. It appears as **Previous Vendor Prices** while adding a work-order part, and as **Prices** from a Parts card.

1. Type at least two characters of the part name.
2. Review same or similar previous part prices.
3. Tap **Use This** when the vendor and price still apply.
4. If no result applies, tap **Add Vendor Quote**.
5. Select a vendor and enter price, availability, and optional notes.
6. Tap **Save Quote**.

(If there is no history, the clean empty message is **No previous vendor prices found.**)

(A newer price does not require deleting an older real quote. Save the new quote so staff can compare history.)

(Vehicle deletion does not delete vendor quote history. The app keeps the vendor, part name, price, notes, dates, and helpful snapshots for future suggestions.)

#### Handover-only test quote cleanup

There is no automatic quote deletion and no quote-delete button in the app. An authorized handover administrator may delete only known test rows from the **vendor_part_quotes** table in Supabase.

(Deleting a targeted test quote does not delete its vendor. Any old selected-quote link is safely cleared, and Add Part/Parts continue to work.)

(Never bulk-delete real quote history after live use begins. Never delete vendors as part of quote cleanup.)

### L. Labor Logs

Labor Logs is a feature inside Vehicle Detail, work orders, Repairs, and Vehicle File rather than a separate main-menu page.

1. Open the vehicle/work order.
2. Tap **Add Labor**.
3. Enter hours and optional notes.
4. Save.

(The rate is copied from the technician's Team profile at the time of entry. Labor cost is hours x saved rate.)

(Technicians see their own labor information. Full labor cost totals are shown only to roles with financial access.)

### M. Warranty Register

Warranty Register tracks retained sold vehicles with and without coverage.

Use **All**, **Active**, **Expiring Soon**, **Expired**, and **No Warranty**. Open a record to add coverage or use **Edit / Extend Warranty** when permitted.

(The end date is calculated from a 1-to-12-month period. Expiring Soon means 30 days or less remain.)

### N. Reports & Export Center

Reports is for Owner/Admin/Manager.

The **Monthly Sold Summary** shows:

- Total Vehicles Sold;
- Sold This Year; and
- First Sale Month.

It can download a CSV with each month and the number of vehicles sold.

(The monthly count is a small lifetime summary. It remains after an expired vehicle record is removed. It does not preserve lifetime sale revenue.)

The **Expired Warranty Cleanup** area lets the user:

1. download the Archive CSV;
2. save it outside the app;
3. enable deletion for the exact exported records; and
4. delete each eligible expired vehicle from the app.

The compact archive includes stock number, VIN, vehicle details, mileage, sold date, customer details, sale price, warranty dates/status, total investment, and notes.

(It does not include full work-order, part, labor, photo, or document history. The app does not need to create and keep a second full old-vehicle archive in Supabase.)

### O. Team Management

Team Management groups people as Active, Inactive, or Removed.

Authorized actions include:

- search by name, email, role, or status;
- approve/reactivate an inactive user;
- deactivate a user;
- edit full name;
- change another user's role;
- set hourly rate;
- soft-remove a user;
- show removed users; and
- restore a removed user.

(Email is tied to login and is read-only here. A user cannot change their own role, deactivate themselves, or remove themselves.)

(Restoring a removed person first places them in Inactive. Approve/Reactivate them separately if they should regain access.)

### P. Sales workflow

Sales is a feature, not a separate main-menu page.

- Open an eligible vehicle in Vehicle Detail and use **Sell Vehicle**, or open Vehicle File and use **Mark Sold**.
- Review retained sales on Dashboard and Reports.
- Review sold vehicles and coverage in Warranty Register.

(A sold vehicle displays Sold instead of Ready for Sale. The sale remains available until the eligible expired-warranty cleanup is completed.)

## 6. Filter and real-life scenario guide

### Scenario 1: A part arrives from a vendor

1. Go to **Purchase Orders -> Ordered**.
2. Search by vendor, part, stock number, VIN, or vehicle.
3. Confirm the correct PO and part.
4. Tap **Mark Received** and confirm.

(The PO and linked parts update. The work order moves forward only when all of its needed purchased parts are received.)

### Scenario 2: Find vehicles waiting for parts

1. Go to **Repairs -> Waiting Parts** for affected work orders.
2. Or go to **Parts -> Needs PO / Ordered** to see where the parts are in the order flow.
3. Use the Vehicle filter if the list is long.

(Needs PO means an order still needs to be created. Ordered means the shop is waiting for the vendor.)

### Scenario 3: Find all urgent work

1. Go to **Repairs -> Urgent**.
2. Use Vehicle or Service Category if needed.
3. Open the work order or related vehicle.

(This view includes High, Critical, and Urgent priority work.)

### Scenario 4: Find parts that still need a PO

1. Go to **Parts -> Needs PO**.
2. Check the part, vehicle, selected vendor price, and review state.
3. Tap **Create PO**.

(The app blocks a duplicate active PO for the same part.)

### Scenario 5: Check one vehicle's total cost

1. Go to **Vehicles**.
2. Open the vehicle.
3. Open **Vehicle File**.
4. Choose **Financial**.
5. Review parts, labor, third-party work, extra costs, returns, and total investment.

(Financial detail depends on the user's role. Technicians see only their own hours/labor.)

### Scenario 6: Clean storage after a warranty expires

1. Go to **Reports -> Expired Warranty Cleanup**.
2. Download and safely save the Archive CSV.
3. Find the exported vehicle and tap **Delete From App**.
4. Tick the download confirmation and delete.

(Photos, documents, and vehicle-specific operational records are removed. Reusable vendors, quote history, team members, catalog entries, and monthly sold counts remain.)

### Scenario 7: Check the lifetime sold count

1. Open **Dashboard -> Sales Summary**.
2. Or open **Reports -> Monthly Sold Summary**.

(The sold count remains after expired vehicle cleanup. Retained sales revenue is different and covers sale rows still in the app.)

### Scenario 8: A vendor quote is missing

1. Open the work order and tap **Add Part**.
2. Type the part name.
3. In Previous Vendor Prices, tap **Add Vendor Quote**.
4. Select the vendor, enter price/availability, and tap **Save Quote**.
5. Add the part.

(The saved quote can be suggested for the same or a similar part later.)

### Scenario 9: A vendor quote is old or wrong

1. Open **Add Part** and review the old suggestion.
2. Do not tap Use This if it is no longer correct.
3. Tap **Add Vendor Quote**.
4. Save the current vendor and price.
5. Use the new selected quote for the part.

(Keep real history. The newer quote becomes another future choice and helps staff compare prices over time.)

### Scenario 10: A technician logs work

1. Open **My Work** or the assigned vehicle/work order.
2. Tap **Add Labor**.
3. Enter hours and optional notes.
4. Save.

(The technician's saved Team rate is used. Adding labor can automatically move a Needed/Approved work order to In Progress.)

## 7. Status change guide

### Vehicle statuses

| Status | Meaning | Normal trigger |
| --- | --- | --- |
| **Inspection** | Newly entered and waiting for first review. | Vehicle is created. |
| **Repair** | Work has been identified or started. | First work order, part, or third-party repair is added to an Inspection vehicle. |
| **Quality Check** | Final review/checklist is under way. | First final-check item is completed. |
| **Ready for Sale** | All required final checks are complete. | All 12 checklist items are completed, or an authorized workflow action marks it ready. |
| **Sold** | A sale record exists for the vehicle. | Sell Vehicle / Mark Sold is saved. |

(Sold is the display and business state. It replaces the Ready for Sale badge without forcing a conflicting workflow badge beside it.)

### Work order statuses

| Status | Meaning | Normal trigger |
| --- | --- | --- |
| **Needed** | The work order was created. | Add Work Order. |
| **Parts Needed** | A required part must be bought. | Add a Needs to Buy part to early-stage work. |
| **Waiting Parts** | A PO exists and the shop is waiting. | Create PO. |
| **In Progress** | Work is active or all required purchased parts arrived. | Add labor/outside work, or receive all needed parts. |
| **Completed** | Repair work is finished. | Tap Mark Complete. |

(Approved, Ordered, Blocked, and Cancelled are also available for special cases.)

### Part queue stages

| Queue stage | Meaning |
| --- | --- |
| **Needs PO** | A needs-to-buy part has no active PO. |
| **Ordered** | A PO/order exists and the part has not been received. |
| **Received** | The purchased part arrived. |
| **Returned** | The ordered/received PO item was returned and its cost was deducted. |
| **In-House** | The part is available in the shop. |
| **Pending Review** | A needs-to-buy request is waiting for Owner/Admin review. |

(These are queue views used to organize work. A part can meet more than one view rule, such as Needs PO and Pending Review.)

Statuses let everyone see where a vehicle, work order, part, or PO stands without asking each person for an update.

## 8. Storage cleanup guide

Photos normally use the most storage, so cleanup happens in stages:

1. **Ready for Sale:** safe repair/before/work-order/temp photos are removed; protected main/final photos and documents stay.
2. **Sold:** the app automatically tries to remove all remaining vehicle and repair-linked photos and clears the main photo.
3. **Expired warranty:** the owner saves the compact Archive CSV, then deletes the vehicle-specific operational record and its remaining files from the app.

(Sold-photo cleanup does not remove documents, invoices, sale text, or warranty text. Expired-warranty cleanup removes the old vehicle's documents and operational records after export.)

(If photo cleanup fails during sale, the sale remains saved and a warning appears. If final expired storage cleanup fails, database deletion is stopped so the cleanup can be retried.)

(Deleting eligible expired vehicles helps keep Supabase storage and current operational tables small.)

Cleanup keeps:

- vendor quote history;
- vendors;
- vehicle catalog entries;
- team profiles and historical user names;
- monthly sold-count summaries; and
- any existing legacy archive rows.

## 9. Reusable business data: do not delete

Do not manually delete these after real use begins:

- **Vendors** - reused for parts, POs, outside repairs, and history.
- **Real vendor part quotes** - reused for same/similar future part prices.
- **Team profiles** - needed for access, attribution, and old work history.
- **Vehicle catalog entries** - reused for make/model/trim suggestions.
- **Monthly sales summary** - keeps lifetime sold counts after old vehicle cleanup.

(Use Team deactivate/soft-remove instead of deleting a person's profile.)

(For handover testing only, an authorized administrator can remove specifically identified test rows from vendor_part_quotes in Supabase. Delete the quote row only, never the vendor. The app will safely show **No previous vendor prices found.** when no suggestions remain.)

## 10. Short demo script

Use this script when giving the client a tour:

1. Install the app from the phone browser.
2. Log in and explain that new users need approval.
3. Show Dashboard, Action Center, Operations, Finance, and Sales Summary.
4. Go to Intake and enter a full VIN.
5. Show the stock-number preview, fill vehicle details, add the required photo, and create the vehicle.
6. Explain that the new vehicle starts in Inspection.
7. Open the vehicle from Vehicles and point out the Vehicle File icon.
8. Add a work order inside a service category.
9. Explain that the vehicle moves to Repair and the work order starts as Needed.
10. Add an In-House or Needs to Buy part.
11. Show Previous Vendor Prices; use a quote or save one through Add Vendor Quote.
12. Open Parts -> Needs PO and create the PO.
13. Go to Purchase Orders -> Ordered and mark the correct PO received.
14. Add technician labor and mark the repair complete.
15. Complete the Technician and Admin final-check sections.
16. Explain Quality Check, Ready for Sale, and repair-photo cleanup.
17. Mark the vehicle sold and show that Sold replaces Ready for Sale.
18. Add or review the 1-to-12-month warranty and calculated end date.
19. Show the Warranty Register tabs.
20. Show Reports, Monthly Sold Summary, Archive CSV, and expired-warranty cleanup.
21. Open Vehicle File and show Work & Parts, Financial, Activity, and Documents.
22. Finish with My Work, Repairs filters, Parts queues, Purchase Orders, Vendors/history, and Team Management.

(For a safe demo, do not permanently clean up a real vehicle or delete real vendor quotes. Use clearly named test data and follow the export confirmation before any eligible expired-vehicle deletion.)

## 11. Daily-use reminders

- Confirm the stock number, VIN, vehicle, part, and vendor before ordering or receiving.
- Use **Save Quote** when a vendor price should be remembered.
- Upload receipts and invoices in the matching PO or outside-repair record.
- Record labor while the work is fresh so hours and costs stay accurate.
- Do not mark a work order complete until its work, parts, labor, photos, and notes are checked.
- Complete both sides of the final checklist before sale.
- Save the Archive CSV outside the app before deleting an eligible expired vehicle.
- Never delete reusable business data as part of vehicle cleanup.

(When a screen does not show an action described in this guide, check the user's role and account status first.)
