do $$
declare
  index_record record;
begin
  for index_record in
    select *
    from (
      values
        ('vehicles', 'status', 'vehicles_status_idx'),
        ('vehicles', 'stock_number', 'vehicles_stock_number_idx'),
        ('vehicles', 'vin', 'vehicles_vin_idx'),
        ('vehicles', 'created_at', 'vehicles_created_at_idx'),
        ('vehicles', 'sale_status', 'vehicles_sale_status_idx'),

        ('repair_jobs', 'vehicle_id', 'repair_jobs_vehicle_id_idx'),
        ('repair_jobs', 'service_category_id', 'repair_jobs_service_category_id_idx'),
        ('repair_jobs', 'status', 'repair_jobs_status_idx'),
        ('repair_jobs', 'category', 'repair_jobs_category_idx'),
        ('repair_jobs', 'priority', 'repair_jobs_priority_idx'),
        ('repair_jobs', 'assigned_to', 'repair_jobs_assigned_to_idx'),
        ('repair_jobs', 'created_by', 'repair_jobs_created_by_idx'),
        ('repair_jobs', 'created_at', 'repair_jobs_created_at_idx'),
        ('repair_jobs', 'completed_at', 'repair_jobs_completed_at_idx'),

        ('part_requests', 'vehicle_id', 'part_requests_vehicle_id_idx'),
        ('part_requests', 'repair_job_id', 'part_requests_repair_job_id_idx'),
        ('part_requests', 'status', 'part_requests_status_idx'),
        ('part_requests', 'approval_status', 'part_requests_approval_status_idx'),
        ('part_requests', 'part_source', 'part_requests_part_source_idx'),
        ('part_requests', 'selected_vendor_id', 'part_requests_selected_vendor_id_idx'),
        ('part_requests', 'selected_quote_id', 'part_requests_selected_quote_id_idx'),
        ('part_requests', 'created_by', 'part_requests_created_by_idx'),
        ('part_requests', 'approved_by', 'part_requests_approved_by_idx'),
        ('part_requests', 'created_at', 'part_requests_created_at_idx'),

        ('purchase_orders', 'vehicle_id', 'purchase_orders_vehicle_id_idx'),
        ('purchase_orders', 'status', 'purchase_orders_status_idx'),
        ('purchase_orders', 'vendor_id', 'purchase_orders_vendor_id_idx'),
        ('purchase_orders', 'ordered_by', 'purchase_orders_ordered_by_idx'),
        ('purchase_orders', 'received_by', 'purchase_orders_received_by_idx'),
        ('purchase_orders', 'cancelled_by', 'purchase_orders_cancelled_by_idx'),
        ('purchase_orders', 'ordered_at', 'purchase_orders_ordered_at_idx'),
        ('purchase_orders', 'received_at', 'purchase_orders_received_at_idx'),
        ('purchase_orders', 'created_at', 'purchase_orders_created_at_idx'),

        ('purchase_order_items', 'purchase_order_id', 'purchase_order_items_purchase_order_id_idx'),
        ('purchase_order_items', 'part_request_id', 'purchase_order_items_part_request_id_idx'),
        ('purchase_order_items', 'status', 'purchase_order_items_status_idx'),
        ('purchase_order_items', 'returned_by', 'purchase_order_items_returned_by_idx'),

        ('labor_logs', 'vehicle_id', 'labor_logs_vehicle_id_idx'),
        ('labor_logs', 'repair_job_id', 'labor_logs_repair_job_id_idx'),
        ('labor_logs', 'technician_id', 'labor_logs_technician_id_idx'),
        ('labor_logs', 'created_at', 'labor_logs_created_at_idx'),

        ('activity_logs', 'vehicle_id', 'activity_logs_vehicle_id_idx'),
        ('activity_logs', 'user_id', 'activity_logs_user_id_idx'),
        ('activity_logs', 'created_at', 'activity_logs_created_at_idx'),

        ('vehicle_photos', 'vehicle_id', 'vehicle_photos_vehicle_id_idx'),
        ('vehicle_photos', 'repair_job_id', 'vehicle_photos_repair_job_id_idx'),
        ('vehicle_photos', 'created_at', 'vehicle_photos_created_at_idx'),

        ('vehicle_documents', 'vehicle_id', 'vehicle_documents_vehicle_id_idx'),
        ('vehicle_documents', 'repair_job_id', 'vehicle_documents_repair_job_id_idx'),
        ('vehicle_documents', 'third_party_repair_id', 'vehicle_documents_third_party_repair_id_idx'),
        ('vehicle_documents', 'purchase_order_id', 'vehicle_documents_purchase_order_id_idx'),
        ('vehicle_documents', 'uploaded_by', 'vehicle_documents_uploaded_by_idx'),
        ('vehicle_documents', 'created_at', 'vehicle_documents_created_at_idx'),

        ('third_party_repairs', 'vehicle_id', 'third_party_repairs_vehicle_id_idx'),
        ('third_party_repairs', 'repair_job_id', 'third_party_repairs_repair_job_id_idx'),
        ('third_party_repairs', 'vendor_id', 'third_party_repairs_vendor_id_idx'),
        ('third_party_repairs', 'status', 'third_party_repairs_status_idx'),
        ('third_party_repairs', 'created_by', 'third_party_repairs_created_by_idx'),
        ('third_party_repairs', 'created_at', 'third_party_repairs_created_at_idx'),

        ('vendor_part_quotes', 'vehicle_id', 'vendor_part_quotes_vehicle_id_idx'),
        ('vendor_part_quotes', 'repair_job_id', 'vendor_part_quotes_repair_job_id_idx'),
        ('vendor_part_quotes', 'part_request_id', 'vendor_part_quotes_part_request_id_idx'),
        ('vendor_part_quotes', 'vendor_id', 'vendor_part_quotes_vendor_id_idx'),
        ('vendor_part_quotes', 'created_by', 'vendor_part_quotes_created_by_idx'),
        ('vendor_part_quotes', 'quote_status', 'vendor_part_quotes_quote_status_idx'),
        ('vendor_part_quotes', 'quoted_at', 'vendor_part_quotes_quoted_at_idx'),
        ('vendor_part_quotes', 'created_at', 'vendor_part_quotes_created_at_idx'),

        ('vehicle_prebookings', 'vehicle_id', 'vehicle_prebookings_vehicle_id_idx'),
        ('vehicle_prebookings', 'status', 'vehicle_prebookings_status_idx'),
        ('vehicle_prebookings', 'created_by', 'vehicle_prebookings_created_by_idx'),
        ('vehicle_prebookings', 'cancelled_by', 'vehicle_prebookings_cancelled_by_idx'),
        ('vehicle_prebookings', 'created_at', 'vehicle_prebookings_created_at_idx'),

        ('sales', 'vehicle_id', 'sales_vehicle_id_idx'),
        ('sales', 'sale_date', 'sales_sale_date_idx'),
        ('sales', 'created_at', 'sales_created_at_idx'),

        ('profiles', 'auth_user_id', 'profiles_auth_user_id_idx'),
        ('profiles', 'email', 'profiles_email_idx'),
        ('profiles', 'role', 'profiles_role_idx'),
        ('profiles', 'is_active', 'profiles_is_active_idx')
    ) as indexes(table_name, column_name, index_name)
  loop
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = index_record.table_name
        and column_name = index_record.column_name
    ) then
      execute format(
        'create index if not exists %I on public.%I(%I)',
        index_record.index_name,
        index_record.table_name,
        index_record.column_name
      );
    end if;
  end loop;
end $$;
