create index if not exists vehicles_status_idx
  on public.vehicles(status);

create index if not exists vehicles_stock_number_idx
  on public.vehicles(stock_number);

create index if not exists vehicles_vin_idx
  on public.vehicles(vin);

create index if not exists vehicles_created_at_idx
  on public.vehicles(created_at);

create index if not exists repair_jobs_vehicle_id_idx
  on public.repair_jobs(vehicle_id);

create index if not exists repair_jobs_status_idx
  on public.repair_jobs(status);

create index if not exists repair_jobs_category_idx
  on public.repair_jobs(category);

create index if not exists repair_jobs_priority_idx
  on public.repair_jobs(priority);

create index if not exists repair_jobs_created_at_idx
  on public.repair_jobs(created_at);

create index if not exists part_requests_vehicle_id_idx
  on public.part_requests(vehicle_id);

create index if not exists part_requests_repair_job_id_idx
  on public.part_requests(repair_job_id);

create index if not exists part_requests_status_idx
  on public.part_requests(status);

create index if not exists part_requests_approval_status_idx
  on public.part_requests(approval_status);

create index if not exists part_requests_part_source_idx
  on public.part_requests(part_source);

create index if not exists purchase_orders_vehicle_id_idx
  on public.purchase_orders(vehicle_id);

create index if not exists purchase_orders_status_idx
  on public.purchase_orders(status);

create index if not exists purchase_orders_vendor_id_idx
  on public.purchase_orders(vendor_id);

create index if not exists purchase_orders_created_at_idx
  on public.purchase_orders(created_at);

create index if not exists purchase_order_items_purchase_order_id_idx
  on public.purchase_order_items(purchase_order_id);

create index if not exists purchase_order_items_part_request_id_idx
  on public.purchase_order_items(part_request_id);

create index if not exists labor_logs_vehicle_id_idx
  on public.labor_logs(vehicle_id);

create index if not exists labor_logs_repair_job_id_idx
  on public.labor_logs(repair_job_id);

create index if not exists labor_logs_user_id_idx
  on public.labor_logs(user_id);

create index if not exists labor_logs_created_at_idx
  on public.labor_logs(created_at);

create index if not exists activity_logs_vehicle_id_idx
  on public.activity_logs(vehicle_id);

create index if not exists activity_logs_created_at_idx
  on public.activity_logs(created_at);

create index if not exists vehicle_photos_vehicle_id_idx
  on public.vehicle_photos(vehicle_id);

create index if not exists vehicle_photos_repair_job_id_idx
  on public.vehicle_photos(repair_job_id);

create index if not exists vehicle_documents_vehicle_id_idx
  on public.vehicle_documents(vehicle_id);

create index if not exists vehicle_documents_repair_job_id_idx
  on public.vehicle_documents(repair_job_id);

create index if not exists third_party_repairs_vehicle_id_idx
  on public.third_party_repairs(vehicle_id);

create index if not exists third_party_repairs_repair_job_id_idx
  on public.third_party_repairs(repair_job_id);

create index if not exists third_party_repairs_status_idx
  on public.third_party_repairs(status);

create index if not exists vendor_part_quotes_vehicle_id_idx
  on public.vendor_part_quotes(vehicle_id);

create index if not exists vendor_part_quotes_repair_job_id_idx
  on public.vendor_part_quotes(repair_job_id);

create index if not exists vendor_part_quotes_part_request_id_idx
  on public.vendor_part_quotes(part_request_id);
