import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Copy, UserPlus, Trash2, Users, Clock, CheckCircle, XCircle } from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  owner: "Eigentümer",
  admin: "Administrator",
  bookkeeper: "Buchhalter",
  viewer: "Betrachter",
};

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  admin: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  bookkeeper: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  viewer: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
};

export default function UsersTab() {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "bookkeeper" | "viewer">("bookkeeper");
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);

  const { data: members, refetch: refetchMembers } = trpc.invitations.listMembers.useQuery();
  const { data: invitationsList, refetch: refetchInvitations } = trpc.invitations.list.useQuery();

  const createInvitation = trpc.invitations.create.useMutation({
    onSuccess: (data) => {
      setGeneratedLink(data.inviteUrl);
      refetchInvitations();
      toast.success("Einladungslink wurde erstellt");
    },
    onError: (err) => {
      toast.error("Fehler: " + err.message);
    },
  });

  const revokeInvitation = trpc.invitations.revoke.useMutation({
    onSuccess: () => {
      refetchInvitations();
      toast.success("Einladung wurde widerrufen");
    },
  });

  const handleCreateInvite = () => {
    if (!inviteEmail) return;
    createInvitation.mutate({
      email: inviteEmail,
      name: inviteName || undefined,
      role: inviteRole,
      origin: window.location.origin,
    });
  };

  const copyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    toast.success("Link in Zwischenablage kopiert");
  };

  const isExpired = (expiresAt: Date) => new Date() > new Date(expiresAt);

  return (
    <div className="space-y-6">
      {/* Aktive Mitglieder */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Aktive Benutzer
            </CardTitle>
            <CardDescription>
              Alle Benutzer mit Zugriff auf diese Organisation
            </CardDescription>
          </div>
          <Button onClick={() => { setInviteOpen(true); setGeneratedLink(null); setInviteEmail(""); setInviteName(""); setInviteRole("bookkeeper"); }}>
            <UserPlus className="h-4 w-4 mr-2" />
            Benutzer einladen
          </Button>
        </CardHeader>
        <CardContent>
          {!members || members.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Keine Mitglieder gefunden</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>E-Mail</TableHead>
                  <TableHead>Rolle</TableHead>
                  <TableHead>Mitglied seit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.userName ?? "–"}</TableCell>
                    <TableCell>{m.userEmail ?? "–"}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${ROLE_COLORS[m.role] ?? ROLE_COLORS.viewer}`}>
                        {ROLE_LABELS[m.role] ?? m.role}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(m.createdAt).toLocaleDateString("de-CH")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Ausstehende Einladungen */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Ausstehende Einladungen
          </CardTitle>
          <CardDescription>
            Einladungslinks sind 7 Tage gültig
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!invitationsList || invitationsList.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Keine ausstehenden Einladungen</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>E-Mail</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Rolle</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Läuft ab</TableHead>
                  <TableHead>Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitationsList.map((inv) => {
                  const expired = isExpired(inv.expiresAt);
                  const used = !!inv.usedAt;
                  const inviteUrl = `${window.location.origin}/einladung/${inv.token}`;
                  return (
                    <TableRow key={inv.id}>
                      <TableCell>{inv.email}</TableCell>
                      <TableCell>{inv.name ?? "–"}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${ROLE_COLORS[inv.role] ?? ROLE_COLORS.viewer}`}>
                          {ROLE_LABELS[inv.role] ?? inv.role}
                        </span>
                      </TableCell>
                      <TableCell>
                        {used ? (
                          <Badge variant="outline" className="text-green-600 border-green-600">
                            <CheckCircle className="h-3 w-3 mr-1" /> Angenommen
                          </Badge>
                        ) : expired ? (
                          <Badge variant="outline" className="text-red-500 border-red-500">
                            <XCircle className="h-3 w-3 mr-1" /> Abgelaufen
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                            <Clock className="h-3 w-3 mr-1" /> Ausstehend
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(inv.expiresAt).toLocaleDateString("de-CH")}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {!used && !expired && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyLink(inviteUrl)}
                              title="Link kopieren"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => revokeInvitation.mutate({ id: inv.id })}
                            title="Einladung widerrufen"
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Einladungs-Dialog */}
      <Dialog open={inviteOpen} onOpenChange={(open) => { setInviteOpen(open); if (!open) setGeneratedLink(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Benutzer einladen</DialogTitle>
          </DialogHeader>

          {!generatedLink ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invite-email">E-Mail-Adresse *</Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="treuhänder@beispiel.ch"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-name">Name (optional)</Label>
                <Input
                  id="invite-name"
                  placeholder="Max Muster"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-role">Rolle</Label>
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as typeof inviteRole)}>
                  <SelectTrigger id="invite-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrator – Voller Zugriff auf Daten und Einstellungen</SelectItem>
                    <SelectItem value="bookkeeper">Buchhalter – Buchen, Berichte, Lohn</SelectItem>
                    <SelectItem value="viewer">Betrachter – Nur Lesezugriff</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setInviteOpen(false)}>Abbrechen</Button>
                <Button
                  onClick={handleCreateInvite}
                  disabled={!inviteEmail || createInvitation.isPending}
                >
                  {createInvitation.isPending ? "Wird erstellt..." : "Einladungslink generieren"}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 p-4">
                <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">
                  Einladungslink erstellt (gültig 7 Tage)
                </p>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={generatedLink}
                    className="text-xs font-mono bg-white dark:bg-gray-900"
                  />
                  <Button
                    size="sm"
                    onClick={() => copyLink(generatedLink)}
                    className="shrink-0"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Senden Sie diesen Link an <strong>{inviteEmail}</strong>. Nach dem Klick kann sich die Person registrieren und erhält sofort Zugriff mit der Rolle <strong>{ROLE_LABELS[inviteRole]}</strong>.
              </p>
              <DialogFooter>
                <Button onClick={() => setInviteOpen(false)}>Schliessen</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
