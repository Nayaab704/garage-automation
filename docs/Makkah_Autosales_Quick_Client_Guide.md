# Makkah Autosales App - Quick Client Guide

Use this guide for daily work and client training. Buttons may be hidden when a user's role does not have permission.

## 1. Install the app

### iPhone or iPad

**Safari → Share → Add to Home Screen → Add**

### Android phone or tablet

**Chrome → three dots → Install App / Add to Home Screen → Install / Add**

Then open the app icon and log in with your email and password.

(New users must be approved in **Team** before they can use the app. An internet connection is needed for login and live data.)

## 2. Main workflow overview

**Intake → Inspection → Repair → Parts / PO → Quality Check → Ready for Sale → Sold → Warranty → Expired Cleanup**

(Statuses change as work moves through the app.)

## 3. Create a new vehicle

1. Go to **Intake**.
2. Enter the full 17-character VIN and tap **Continue**.
3. Fill in the vehicle details.
4. Check the next stock-number preview.
5. Take or upload the main vehicle photo.
6. Tap **Create Vehicle**.

(The VIN box allows up to 17 characters. Use the complete VIN.)

(The main photo is required before Create Vehicle. The saved vehicle appears in **Vehicles** and starts as **Inspection**.)

## 4. Open a vehicle and add work

1. Go to **Vehicles**.
2. Tap the vehicle card.
3. Find the correct service category.
4. Tap **Add Work Order**.
5. Enter the issue or repair title, priority, and notes.
6. Save.

(After work is added, the vehicle changes from **Inspection** to **Repair**. The new work order starts as **Needed**.)

## 5. Add parts and a vendor quote

1. Open the work order.
2. Tap **Add Part**.
3. Enter the part name and quantity.
4. Choose:

   - **In-House** if the part is already at the shop; or
   - **Needs to Buy** if it must be ordered.

### Previous vendor price appears

- Check the vendor and price.
- Tap **Use This** if it is correct.
- Finish adding the part.

### No useful quote appears

- Tap **Add Vendor Quote**.
- Select the vendor.
- Enter the price and availability.
- Tap **Save Quote**.
- Finish adding the part.

(A price is remembered only when **Save Quote** is used. Saved quotes can appear next time for the same or a similar part.)

(Vendor quote history stays available even after an old vehicle is deleted.)

## 6. Create a purchase order

1. Go to **Parts → Needs PO**.
2. Find the correct part and tap **Create PO**.
3. Select the vendor.
4. Confirm the part name and quantity.
5. Confirm unit price, shipping, and tax.
6. Add notes if needed.
7. Save the PO.

(After the PO is created, the part becomes **Ordered** and the work order moves to **Waiting Parts**.)

## 7. When parts arrive

1. Go to **Purchase Orders**.
2. Open the **Ordered** tab.
3. Search or filter by vendor, vehicle, stock number, VIN, or part.
4. Confirm the correct vehicle, part, and PO.
5. Tap **Mark Received** and confirm.

(The PO and linked part update. When every required purchased part for the work order is received, the work can move forward.)

## 8. Add labor and complete work

1. Open the vehicle and work order.
2. Tap **Add Labor**.
3. Enter the hours and optional notes.
4. Save.
5. When the repair is finished, tap **Mark Complete**.

(Hourly rates are set in **Team**. Labor cost is calculated from hours x the saved technician rate.)

## 9. Final checklist and Ready for Sale

1. Open **Final Checklist**.
2. Complete the Technician checks.
3. Complete the Admin checks.
4. Confirm that every check is complete.

(Technicians complete Technician checks. Owner/Admin completes the Admin checks.)

(Starting the checklist moves the vehicle to **Quality Check**. When all checks are complete, it becomes **Ready for Sale**.)

(Ready for Sale cleans safe repair/work photos to save storage. Main, final, and protected files stay at this stage.)

## 10. Sell the vehicle and add warranty

1. Open the vehicle.
2. Tap **Sell Vehicle** or **Mark Sold**.
3. Enter the buyer name and phone.
4. Enter the sale price, sale date, and payment method.
5. Add a warranty period if applicable.
6. Save the sale.

(After saving, **Sold** replaces the Ready for Sale badge.)

(The warranty end date is calculated automatically. An authorized user can edit or extend it later.)

(After the sale is saved, the app automatically cleans the remaining vehicle and repair photos. Sale, warranty, and document records remain.)

## 11. Warranty Register

Go to **Warranty Register** and use:

- **All** - all retained sold vehicles;
- **Active** - warranty is active;
- **Expiring Soon** - 30 days or less remain;
- **Expired** - warranty has ended; or
- **No Warranty** - sold without warranty coverage.

(Open a record to add, edit, or extend a warranty when permitted.)

## 12. Reports and expired cleanup

Go to **Reports** to check the **Monthly Sold Summary**.

For an eligible expired-warranty vehicle:

**Download Archive CSV → Save the file → Delete From App → Confirm the CSV was saved**

(The CSV is the owner's compact old-vehicle reference. It does not contain every photo or full work detail.)

(Delete From App removes the old vehicle's data, photos, documents, and related work records to save Supabase space.)

(The lifetime sold count stays on the Dashboard because the app keeps a tiny monthly sold-count summary.)

(Expired cleanup is for a sold vehicle with an expired warranty end date. A No Warranty sale is not eligible.)

## 13. Vehicle File / Summary

Open **Vehicle File** from the file icon on a vehicle card or from Vehicle Detail.

Use it to review one vehicle's:

- work orders;
- parts and purchase orders;
- labor and extra costs;
- documents and activity; and
- financial breakdown.

Tap the information icon on a part to see its price and who ordered, received, or returned it.

(Use **Vehicle File → Financial** for a quick cost review. Financial detail depends on the user's role.)

## 14. Page cheat sheet

- **Dashboard** = owner overview, totals, and action items.
- **My Work** = technician's active work and recent activity.
- **Intake** = add a new vehicle.
- **Vehicles** = find and open vehicle records.
- **Vehicle Detail** = main working page for one vehicle.
- **Vehicle File** = clean history and cost summary for one vehicle.
- **Repairs** = all work orders and repair filters.
- **Parts** = all parts queues.
- **Purchase Orders** = ordered, received, and cancelled parts.
- **Vendors** = parts suppliers and repair vendors.
- **Warranty Register** = sold-vehicle warranty tracking.
- **Reports** = exports, expired cleanup, and monthly sold summary.
- **Team** = approve users, change roles, and set hourly rates.

(Selling is done inside Vehicle Detail or Vehicle File. There is no separate Sales page.)

## 15. Common scenarios

- **Part arrives:** Purchase Orders → Ordered → search → Mark Received.
- **Need to order a part:** Parts → Needs PO → Create PO.
- **Check urgent work:** Repairs → Urgent.
- **Check one vehicle's cost:** Vehicles → open vehicle → Vehicle File → Financial.
- **Warranty expired:** Reports → Download Archive CSV → save → Delete From App.
- **Add a missing quote:** Add Part → Add Vendor Quote → Save Quote.

## 16. Do not delete

Do not manually delete:

- real vendors;
- real vendor quotes;
- team profiles;
- vehicle catalog entries; or
- the monthly sales summary.

(These records are reusable business data or lifetime counters. Expired-vehicle cleanup keeps them.)
