import { DataTablePage } from "@/components/data-table-page";

export default function ReportsPage() {
  return <DataTablePage title="Strategy reports" subtitle="Analysis reports linked to relational strategy plans." endpoint="/api/strategy-reports" columns={[
    {key:"report_id",label:"ID"},{key:"title",label:"REPORT"},{key:"race_name",label:"RACE"},{key:"driver_name",label:"DRIVER"},{key:"strategy_type",label:"STRATEGY"},{key:"created_at",label:"CREATED",format:"datetime"},
  ]}/>;
}
