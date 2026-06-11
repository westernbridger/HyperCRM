import { ContactsTable } from "@/components/contacts/contacts-table";

export default function ContactsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Contacts</h1>
        <p className="text-sm text-muted-foreground">
          Manage your contacts, leads, and customer relationships.
        </p>
      </div>
      <ContactsTable />
    </div>
  );
}
