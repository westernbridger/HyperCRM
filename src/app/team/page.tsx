import { TeamView } from "@/components/team/team-view";

export default function TeamPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Team</h1>
        <p className="text-sm text-muted-foreground">
          Manage roles, permissions, and invitations.
        </p>
      </div>
      <TeamView />
    </div>
  );
}
