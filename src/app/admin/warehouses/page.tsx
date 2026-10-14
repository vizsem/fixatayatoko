import { getWarehouses } from '@/lib/actions/inventory.actions';
import WarehouseClient from './WarehouseClient';

export const dynamic = 'force-dynamic';

export default async function AdminWarehousesPage() {
  const warehouses = await getWarehouses();
  return <WarehouseClient initialWarehouses={warehouses} />;
}
