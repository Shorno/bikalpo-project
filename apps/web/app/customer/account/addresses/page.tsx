import { getMyAddresses } from "@/actions/address/address-actions";
import { AddressList } from "@/components/account/address-list";

export default async function AddressesPage() {
  const { addresses } = await getMyAddresses();

  return <AddressList addresses={addresses} />;
}
