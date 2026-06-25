import { ContactsTable } from "@/components/contacts/contacts-table";
import { SegmentsTab } from "@/components/contacts/segments-tab";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Users, FolderPlus } from "lucide-react";

export default function ContactsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Contacts</h1>
        <p className="text-sm text-muted-foreground">
          Manage your contacts, leads, and customer relationships.
        </p>
      </div>
      <Tabs defaultValue="contacts">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="contacts" className="gap-2">
            <Users className="h-4 w-4" />
            Contacts
          </TabsTrigger>
          <TabsTrigger value="segments" className="gap-2">
            <FolderPlus className="h-4 w-4" />
            Segments
          </TabsTrigger>
        </TabsList>
        <TabsContent value="contacts" className="mt-4">
          <ContactsTable />
        </TabsContent>
        <TabsContent value="segments" className="mt-4">
          <SegmentsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
