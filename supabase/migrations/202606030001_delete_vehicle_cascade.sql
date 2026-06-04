-- Permanently deletes a vehicle and its dependent records in one transaction.
-- The UI is admin-only, but this RPC also enforces the owner/admin role check.
create or replace function public.delete_vehicle_cascade(p_vehicle_id uuid)
returns table (
  deleted_vehicle_id uuid,
  deleted_stock_number text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stock_number text;
begin
  if not exists (
    select 1
    from public.profiles
    where auth_user_id = auth.uid()
      and role in ('owner', 'admin')
      and coalesce(is_active, true) = true
  ) then
    raise exception 'Only admin/manager can delete vehicles.'
      using errcode = '42501';
  end if;

  select stock_number
    into v_stock_number
  from public.vehicles
  where id = p_vehicle_id;

  if not found then
    raise exception 'Vehicle not found.'
      using errcode = 'P0002';
  end if;

  delete from public.vehicle_documents
  where vehicle_id = p_vehicle_id
     or repair_job_id in (
       select id from public.repair_jobs where vehicle_id = p_vehicle_id
     )
     or third_party_repair_id in (
       select id
       from public.third_party_repairs
       where vehicle_id = p_vehicle_id
          or repair_job_id in (
            select id from public.repair_jobs where vehicle_id = p_vehicle_id
          )
     )
     or purchase_order_id in (
       select id from public.purchase_orders where vehicle_id = p_vehicle_id
     );

  delete from public.purchase_order_items
  where purchase_order_id in (
      select id from public.purchase_orders where vehicle_id = p_vehicle_id
    )
     or part_request_id in (
      select id from public.part_requests where vehicle_id = p_vehicle_id
    )
     or part_request_id in (
      select part_requests.id
      from public.part_requests
      join public.repair_jobs on repair_jobs.id = part_requests.repair_job_id
      where repair_jobs.vehicle_id = p_vehicle_id
    );

  delete from public.warranties
  where sale_id in (
    select id from public.sales where vehicle_id = p_vehicle_id
  );

  delete from public.vehicle_photos
  where vehicle_id = p_vehicle_id
     or repair_job_id in (
       select id from public.repair_jobs where vehicle_id = p_vehicle_id
     );

  delete from public.labor_logs
  where vehicle_id = p_vehicle_id
     or repair_job_id in (
       select id from public.repair_jobs where vehicle_id = p_vehicle_id
     );

  delete from public.cost_entries
  where vehicle_id = p_vehicle_id;

  delete from public.vehicle_final_checks
  where vehicle_id = p_vehicle_id;

  delete from public.activity_logs
  where vehicle_id = p_vehicle_id;

  delete from public.third_party_repairs
  where vehicle_id = p_vehicle_id
     or repair_job_id in (
       select id from public.repair_jobs where vehicle_id = p_vehicle_id
     );

  delete from public.purchase_orders
  where vehicle_id = p_vehicle_id;

  delete from public.part_requests
  where vehicle_id = p_vehicle_id
     or repair_job_id in (
       select id from public.repair_jobs where vehicle_id = p_vehicle_id
     );

  delete from public.repair_process_items
  where vehicle_id = p_vehicle_id
     or repair_process_id in (
       select id from public.repair_processes where vehicle_id = p_vehicle_id
     );

  delete from public.repair_processes
  where vehicle_id = p_vehicle_id;

  delete from public.sales
  where vehicle_id = p_vehicle_id;

  delete from public.repair_jobs
  where vehicle_id = p_vehicle_id;

  delete from public.vehicles
  where id = p_vehicle_id;

  deleted_vehicle_id := p_vehicle_id;
  deleted_stock_number := v_stock_number;
  return next;
end;
$$;

revoke all on function public.delete_vehicle_cascade(uuid) from public;
grant execute on function public.delete_vehicle_cascade(uuid) to authenticated;
