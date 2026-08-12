create or replace view public.vehicle_financial_summary
with (security_invoker = true)
as
with purchased_part_costs as (
  select
    purchase_orders.vehicle_id,
    sum(
      greatest(
        coalesce(purchase_order_items.quantity, 1)
          * coalesce(purchase_order_items.unit_cost, 0)
        + coalesce(purchase_order_items.shipping_cost, 0)
        + coalesce(purchase_order_items.tax, 0)
        - coalesce(purchase_order_items.returned_amount, 0)
        - coalesce(purchase_order_items.returned_shipping_amount, 0),
        0
      )
    ) as amount
  from public.purchase_order_items
  join public.purchase_orders
    on purchase_orders.id = purchase_order_items.purchase_order_id
  left join public.part_requests
    on part_requests.id = purchase_order_items.part_request_id
  where lower(btrim(coalesce(purchase_order_items.status, '')))
      in ('ordered', 'received')
    and lower(btrim(coalesce(purchase_order_items.return_status, '')))
      not in ('cancelled', 'canceled', 'returned', 'rejected')
    and lower(btrim(coalesce(purchase_orders.status, '')))
      not in ('cancelled', 'canceled', 'returned', 'rejected')
    and lower(btrim(coalesce(part_requests.status, '')))
      not in ('cancelled', 'canceled', 'returned', 'rejected')
    and lower(btrim(coalesce(part_requests.approval_status, '')))
      not in ('cancelled', 'canceled', 'returned', 'rejected')
    and lower(btrim(coalesce(part_requests.part_source, ''))) <> 'in_house'
  group by purchase_orders.vehicle_id
),
in_house_part_costs as (
  select
    part_requests.vehicle_id,
    sum(
      greatest(
        coalesce(
          part_requests.quoted_total_cost,
          coalesce(part_requests.quantity, 1)
            * coalesce(
              part_requests.unit_cost,
              part_requests.quoted_unit_cost,
              0
            )
        ),
        0
      )
    ) as amount
  from public.part_requests
  where lower(btrim(coalesce(part_requests.part_source, ''))) = 'in_house'
    and lower(btrim(coalesce(part_requests.status, '')))
      not in ('cancelled', 'canceled', 'returned', 'rejected')
    and lower(btrim(coalesce(part_requests.approval_status, '')))
      not in ('cancelled', 'canceled', 'returned', 'rejected')
  group by part_requests.vehicle_id
),
labor_costs as (
  select
    labor_logs.vehicle_id,
    sum(greatest(coalesce(labor_logs.labor_cost, 0), 0)) as amount
  from public.labor_logs
  group by labor_logs.vehicle_id
),
third_party_costs as (
  select
    third_party_repairs.vehicle_id,
    sum(
      greatest(
        coalesce(third_party_repairs.repair_cost, 0)
          + coalesce(third_party_repairs.transit_cost, 0),
        0
      )
    ) as amount
  from public.third_party_repairs
  group by third_party_repairs.vehicle_id
),
extra_costs as (
  select
    cost_entries.vehicle_id,
    sum(greatest(coalesce(cost_entries.amount, 0), 0)) as amount
  from public.cost_entries
  group by cost_entries.vehicle_id
),
vehicle_costs as (
  select
    vehicles.id as vehicle_id,
    vehicles.stock_number,
    vehicles.make,
    vehicles.model,
    coalesce(vehicles.purchase_price, 0) as purchase_price,
    nullif(vehicles.target_sale_price, 0) as target_sale_price,
    coalesce(purchased_part_costs.amount, 0)
      + coalesce(in_house_part_costs.amount, 0)
      + coalesce(labor_costs.amount, 0)
      + coalesce(third_party_costs.amount, 0)
      + coalesce(extra_costs.amount, 0) as total_repair_cost
  from public.vehicles
  left join purchased_part_costs
    on purchased_part_costs.vehicle_id = vehicles.id
  left join in_house_part_costs
    on in_house_part_costs.vehicle_id = vehicles.id
  left join labor_costs
    on labor_costs.vehicle_id = vehicles.id
  left join third_party_costs
    on third_party_costs.vehicle_id = vehicles.id
  left join extra_costs
    on extra_costs.vehicle_id = vehicles.id
  where public.is_admin_or_manager()
)
select
  vehicle_costs.vehicle_id,
  vehicle_costs.stock_number,
  vehicle_costs.make,
  vehicle_costs.model,
  vehicle_costs.purchase_price,
  vehicle_costs.total_repair_cost,
  vehicle_costs.purchase_price + vehicle_costs.total_repair_cost
    as total_invested,
  vehicle_costs.target_sale_price,
  case
    when vehicle_costs.target_sale_price is null then null
    else vehicle_costs.target_sale_price
      - vehicle_costs.purchase_price
      - vehicle_costs.total_repair_cost
  end as estimated_profit
from vehicle_costs;

revoke all on table public.vehicle_financial_summary from public;
revoke all on table public.vehicle_financial_summary from anon;
grant select on table public.vehicle_financial_summary to authenticated;

comment on view public.vehicle_financial_summary is
  'Admin financial totals. Purchased parts count only ordered/received items; cancelled, canceled, returned, and rejected parts remain stored but are excluded.';
