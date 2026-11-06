import { DataTablePage } from "@/components/data-table-page";

export default function ConstructorsPage() {
  return <DataTablePage title="Constructors" subtitle="Team summaries calculated from imported season contracts and race results." endpoint="/api/constructors" columns={[
    {key:"name",label:"CONSTRUCTOR"},{key:"country",label:"COUNTRY"},{key:"drivers",label:"DRIVERS"},{key:"race_starts",label:"STARTS"},{key:"points",label:"POINTS",format:"decimal"},
  ]}/>;
}
