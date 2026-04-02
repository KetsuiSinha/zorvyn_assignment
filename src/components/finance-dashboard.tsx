"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { roleCapabilityLines, roleTitle } from "@/lib/role-capabilities";

const TOKEN_KEY = "zorvyn_token";

type Role = "VIEWER" | "ANALYST" | "ADMIN";

type User = {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: string;
};

type Summary = {
  period: string;
  totals: { income: number; expenses: number; net: number };
  allTime: { income: number; expenses: number; net: number };
  byCategory: Record<string, { income: number; expense: number; net: number }>;
  recentActivity: Array<{
    id: string;
    date: string;
    amount: number;
    type: string;
    category: string;
    notes?: string | null;
  }>;
  trends: Array<{ label: string; income: number; expense: number; net: number }>;
};

type RecordRow = {
  id: string;
  amount: string;
  type: string;
  category: string;
  date: string;
  notes: string | null;
  createdBy: { id: string; name: string; email: string };
};

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export function FinanceDashboard() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [booting, setBooting] = useState(true);
  const [email, setEmail] = useState("admin@demo.local");
  const [password, setPassword] = useState("Demo12345!");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [summary, setSummary] = useState<Summary | null>(null);
  const [period, setPeriod] = useState<"week" | "month" | "year">("month");

  const [records, setRecords] = useState<RecordRow[]>([]);
  const [recordsTotal, setRecordsTotal] = useState(0);

  const [users, setUsers] = useState<User[]>([]);

  const [newUser, setNewUser] = useState({
    email: "",
    password: "",
    name: "",
    role: "VIEWER" as Role,
  });

  const [newRecord, setNewRecord] = useState({
    amount: "",
    type: "EXPENSE" as "INCOME" | "EXPENSE",
    category: "",
    date: new Date().toISOString().slice(0, 10),
    notes: "",
  });

  useEffect(() => {
    const t = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
    setToken(t);
  }, []);

  const loadMe = useCallback(async (t: string) => {
    const res = await fetch("/api/me", { headers: authHeaders(t) });
    if (!res.ok) {
      localStorage.removeItem(TOKEN_KEY);
      setToken(null);
      setUser(null);
      return;
    }
    const data = (await res.json()) as { user: User };
    setUser(data.user);
  }, []);

  useEffect(() => {
    if (!token) {
      setBooting(false);
      return;
    }
    void (async () => {
      await loadMe(token);
      setBooting(false);
    })();
  }, [token, loadMe]);

  const loadSummary = useCallback(async () => {
    if (!token) return;
    const res = await fetch(`/api/dashboard/summary?period=${period}`, {
      headers: authHeaders(token),
    });
    if (!res.ok) return;
    const data = (await res.json()) as { summary: Summary };
    setSummary(data.summary);
  }, [token, period]);

  useEffect(() => {
    if (user && token) void loadSummary();
  }, [user, token, loadSummary]);

  const loadRecords = useCallback(async () => {
    if (!token || !user) return;
    if (user.role === "VIEWER") return;
    const res = await fetch("/api/records?limit=50", { headers: authHeaders(token) });
    if (!res.ok) return;
    const data = (await res.json()) as { records: RecordRow[]; total: number };
    setRecords(data.records);
    setRecordsTotal(data.total);
  }, [token, user]);

  const loadUsers = useCallback(async () => {
    if (!token || user?.role !== "ADMIN") return;
    const res = await fetch("/api/users", { headers: authHeaders(token) });
    if (!res.ok) return;
    const data = (await res.json()) as { users: User[] };
    setUsers(data.users);
  }, [token, user]);

  useEffect(() => {
    if (user?.role === "ANALYST" || user?.role === "ADMIN") void loadRecords();
  }, [user, loadRecords]);

  useEffect(() => {
    if (user?.role === "ADMIN") void loadUsers();
  }, [user, loadUsers]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const text = await res.text();
      let data: { token?: string; error?: string } = {};
      try {
        data = text ? (JSON.parse(text) as { token?: string; error?: string }) : {};
      } catch {
        setLoginError(res.ok ? "Invalid response" : `Login failed (${res.status})`);
        return;
      }
      if (!res.ok) {
        setLoginError(data.error ?? "Login failed");
        return;
      }
      if (data.token) {
        localStorage.setItem(TOKEN_KEY, data.token);
        setToken(data.token);
        await loadMe(data.token);
      }
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    setSummary(null);
    setRecords([]);
    setUsers([]);
  }

  async function createRecord(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setBusy(true);
    try {
      const res = await fetch("/api/records", {
        method: "POST",
        headers: { ...authHeaders(token), "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(newRecord.amount),
          type: newRecord.type,
          category: newRecord.category,
          date: new Date(newRecord.date).toISOString(),
          notes: newRecord.notes || undefined,
        }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error: string };
        alert(err.error);
        return;
      }
      setNewRecord({
        amount: "",
        type: "EXPENSE",
        category: "",
        date: new Date().toISOString().slice(0, 10),
        notes: "",
      });
      await loadRecords();
      await loadSummary();
    } finally {
      setBusy(false);
    }
  }

  async function deleteRecord(id: string) {
    if (!token || !confirm("Delete this record?")) return;
    const res = await fetch(`/api/records/${id}`, {
      method: "DELETE",
      headers: authHeaders(token),
    });
    if (!res.ok) {
      const err = (await res.json()) as { error: string };
      alert(err.error);
      return;
    }
    await loadRecords();
    await loadSummary();
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setBusy(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { ...authHeaders(token), "Content-Type": "application/json" },
        body: JSON.stringify(newUser),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error: string };
        alert(err.error);
        return;
      }
      setNewUser({ email: "", password: "", name: "", role: "VIEWER" });
      await loadUsers();
    } finally {
      setBusy(false);
    }
  }

  async function patchUser(id: string, patch: { status?: string; role?: Role }) {
    if (!token) return;
    const res = await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { ...authHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const err = (await res.json()) as { error: string };
      alert(err.error);
      return;
    }
    await loadUsers();
  }

  if (booting) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!token || !user) {
    return (
      <div className="relative flex min-h-[80vh] items-center justify-center overflow-hidden px-4">
        <div className="bg-primary/10 pointer-events-none absolute -top-16 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full blur-3xl" />
        <Card className="relative w-full max-w-md border-0 shadow-xl ring-1 ring-black/5">
          <CardHeader>
            <CardTitle className="text-xl">Finance dashboard</CardTitle>
            <CardDescription>
              Demo accounts (password <code className="rounded bg-muted px-1 py-0.5 text-xs">Demo12345!</code>
              ): viewer@demo.local · analyst@demo.local · admin@demo.local
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {loginError ? <p className="text-sm text-destructive">{loginError}</p> : null}
              <Button type="submit" disabled={busy} className="w-full">
                {busy ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  const capabilities = roleCapabilityLines(user.role);
  const dashboardTabLabel =
    user.role === "VIEWER" ? "Dashboard" : "Dashboard & insights";

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10">
      <header className="bg-background/70 supports-[backdrop-filter]:bg-background/60 flex flex-col gap-4 rounded-2xl border p-5 shadow-sm backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Finance dashboard</h1>
          <p className="text-muted-foreground text-sm">
            Signed in as {user.name} ({user.email})
          </p>
        </div>
        <div className="mt-4 flex items-center gap-2 sm:mt-0">
          <Badge variant="secondary">{roleTitle(user.role)}</Badge>
          <Button variant="outline" size="sm" onClick={logout}>
            Sign out
          </Button>
        </div>
      </header>

      <Card className="border-0 shadow-sm ring-1 ring-black/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Your access</CardTitle>
          <CardDescription>
            Permissions for the <strong>{roleTitle(user.role)}</strong> role.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="text-muted-foreground list-inside list-disc space-y-1 text-sm leading-6">
            {capabilities.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Tabs defaultValue="summary" className="w-full">
        <TabsList
          className={`bg-muted/70 grid h-auto w-full max-w-lg gap-1 rounded-xl p-1 ${user.role === "ADMIN" ? "grid-cols-3" : user.role === "VIEWER" ? "grid-cols-1" : "grid-cols-2"}`}
        >
          <TabsTrigger value="summary">{dashboardTabLabel}</TabsTrigger>
          {user.role !== "VIEWER" ? (
            <TabsTrigger value="records">Records</TabsTrigger>
          ) : null}
          {user.role === "ADMIN" ? <TabsTrigger value="users">Users</TabsTrigger> : null}
        </TabsList>

        <TabsContent value="summary" className="mt-6 space-y-6">
          {user.role === "VIEWER" ? (
            <p className="text-muted-foreground text-sm">
              Viewers see dashboard KPIs and insights only. Transaction notes are not shown, and the full
              records list is not available.
            </p>
          ) : null}
          {user.role === "ANALYST" ? (
            <p className="text-muted-foreground text-sm">
              Analysts can explore insights here and use the Records tab to read the full ledger (no edits).
            </p>
          ) : null}
          {user.role === "ADMIN" ? (
            <p className="text-muted-foreground text-sm">
              Admins have full access to insights, record management, and user administration.
            </p>
          ) : null}
          <div className="bg-muted/40 flex flex-wrap items-center gap-3 rounded-xl border p-3">
            <Label htmlFor="period" className="text-sm">
              Period
            </Label>
            <Select
              value={period}
              onValueChange={(v) => setPeriod(v as typeof period)}
            >
              <SelectTrigger id="period" className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Last 7 days</SelectItem>
                <SelectItem value="month">Last month</SelectItem>
                <SelectItem value="year">Last year</SelectItem>
              </SelectContent>
            </Select>
            <Button type="button" variant="secondary" size="sm" onClick={() => void loadSummary()}>
              Refresh
            </Button>
          </div>

          {summary ? (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <Card className="border-emerald-200/70 bg-emerald-50/40 shadow-sm dark:border-emerald-900/60 dark:bg-emerald-950/20">
                  <CardHeader className="pb-2">
                    <CardDescription>Income ({summary.period})</CardDescription>
                    <CardTitle className="text-2xl tabular-nums">
                      {summary.totals.income.toLocaleString(undefined, {
                        style: "currency",
                        currency: "USD",
                      })}
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card className="border-rose-200/70 bg-rose-50/40 shadow-sm dark:border-rose-900/60 dark:bg-rose-950/20">
                  <CardHeader className="pb-2">
                    <CardDescription>Expenses ({summary.period})</CardDescription>
                    <CardTitle className="text-2xl tabular-nums">
                      {summary.totals.expenses.toLocaleString(undefined, {
                        style: "currency",
                        currency: "USD",
                      })}
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card className="border-primary/30 bg-primary/5 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardDescription>Net ({summary.period})</CardDescription>
                    <CardTitle className="text-2xl tabular-nums">
                      {summary.totals.net.toLocaleString(undefined, {
                        style: "currency",
                        currency: "USD",
                      })}
                    </CardTitle>
                  </CardHeader>
                </Card>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="border-0 shadow-sm ring-1 ring-black/5">
                  <CardHeader>
                    <CardTitle className="text-base">Category totals ({summary.period})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-hidden rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Category</TableHead>
                          <TableHead className="text-right">Income</TableHead>
                          <TableHead className="text-right">Expense</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Object.entries(summary.byCategory).map(([cat, v]) => (
                          <TableRow key={cat}>
                            <TableCell>{cat}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {v.income.toLocaleString(undefined, {
                                style: "currency",
                                currency: "USD",
                              })}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {v.expense.toLocaleString(undefined, {
                                style: "currency",
                                currency: "USD",
                              })}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-sm ring-1 ring-black/5">
                  <CardHeader>
                    <CardTitle className="text-base">Trends</CardTitle>
                    <CardDescription>Bucketed income, expenses, and net</CardDescription>
                  </CardHeader>
                  <CardContent className="max-h-[280px] overflow-auto">
                    <div className="overflow-hidden rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Bucket</TableHead>
                          <TableHead className="text-right">Net</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {summary.trends.map((t) => (
                          <TableRow key={t.label}>
                            <TableCell>{t.label}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {t.net.toLocaleString(undefined, {
                                style: "currency",
                                currency: "USD",
                              })}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-0 shadow-sm ring-1 ring-black/5">
                <CardHeader>
                  <CardTitle className="text-base">Recent activity</CardTitle>
                  {user.role === "VIEWER" ? (
                    <CardDescription>Notes are hidden for viewer accounts.</CardDescription>
                  ) : null}
                </CardHeader>
                <CardContent>
                  <div className="overflow-hidden rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        {user.role !== "VIEWER" ? <TableHead>Notes</TableHead> : null}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {summary.recentActivity.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="whitespace-nowrap">
                            {new Date(r.date).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Badge variant={r.type === "INCOME" ? "default" : "secondary"}>
                              {r.type}
                            </Badge>
                          </TableCell>
                          <TableCell>{r.category}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {r.amount.toLocaleString(undefined, {
                              style: "currency",
                              currency: "USD",
                            })}
                          </TableCell>
                          {user.role !== "VIEWER" ? (
                            <TableCell className="max-w-[200px] truncate text-muted-foreground">
                              {r.notes ?? "—"}
                            </TableCell>
                          ) : null}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">No summary data yet.</p>
          )}
        </TabsContent>

        {user.role !== "VIEWER" ? (
          <TabsContent value="records" className="mt-6 space-y-8">
            {user.role === "ANALYST" ? (
              <p className="text-muted-foreground text-sm">
                Analyst role: view and filter all records below. Creating, editing, or deleting entries
                requires an <strong>Admin</strong> account.
              </p>
            ) : null}
            {user.role === "ADMIN" ? (
              <Card className="border-0 shadow-sm ring-1 ring-black/5">
                <CardHeader>
                  <CardTitle className="text-base">New record</CardTitle>
                  <CardDescription>
                    Admins can create, update, and delete records (see row actions).
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={createRecord} className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="amt">Amount</Label>
                      <Input
                        id="amt"
                        inputMode="decimal"
                        value={newRecord.amount}
                        onChange={(e) => setNewRecord({ ...newRecord, amount: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select
                        value={newRecord.type}
                        onValueChange={(v) =>
                          setNewRecord({ ...newRecord, type: v as "INCOME" | "EXPENSE" })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="INCOME">Income</SelectItem>
                          <SelectItem value="EXPENSE">Expense</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cat">Category</Label>
                      <Input
                        id="cat"
                        value={newRecord.category}
                        onChange={(e) => setNewRecord({ ...newRecord, category: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="d">Date</Label>
                      <Input
                        id="d"
                        type="date"
                        value={newRecord.date}
                        onChange={(e) => setNewRecord({ ...newRecord, date: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="notes">Notes</Label>
                      <Textarea
                        id="notes"
                        rows={2}
                        value={newRecord.notes}
                        onChange={(e) => setNewRecord({ ...newRecord, notes: e.target.value })}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Button type="submit" disabled={busy}>
                        Add record
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            ) : null}

            <Card className="border-0 shadow-sm ring-1 ring-black/5">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">All records</CardTitle>
                  <CardDescription>
                    {recordsTotal} total · showing {records.length}
                  </CardDescription>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => void loadRecords()}>
                  Refresh
                </Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>By</TableHead>
                      {user.role === "ADMIN" ? <TableHead /> : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="whitespace-nowrap">
                          {new Date(r.date).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant={r.type === "INCOME" ? "default" : "secondary"}>
                            {r.type}
                          </Badge>
                        </TableCell>
                        <TableCell>{r.category}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {Number(r.amount).toLocaleString(undefined, {
                            style: "currency",
                            currency: "USD",
                          })}
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-[140px] truncate">
                          {r.createdBy.name}
                        </TableCell>
                        {user.role === "ADMIN" ? (
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive"
                              type="button"
                              onClick={() => void deleteRecord(r.id)}
                            >
                              Delete
                            </Button>
                          </TableCell>
                        ) : null}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ) : null}

        {user.role === "ADMIN" ? (
          <TabsContent value="users" className="mt-6 space-y-8">
            <Card className="border-0 shadow-sm ring-1 ring-black/5">
              <CardHeader>
                <CardTitle className="text-base">Invite user</CardTitle>
                <CardDescription>Create accounts and assign roles.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={createUser} className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="nu-email">Email</Label>
                    <Input
                      id="nu-email"
                      type="email"
                      value={newUser.email}
                      onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nu-pass">Password</Label>
                    <Input
                      id="nu-pass"
                      type="password"
                      value={newUser.password}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                      required
                      minLength={8}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nu-name">Name</Label>
                    <Input
                      id="nu-name"
                      value={newUser.name}
                      onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select
                      value={newUser.role}
                      onValueChange={(v) => setNewUser({ ...newUser, role: v as Role })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="VIEWER">Viewer</SelectItem>
                        <SelectItem value="ANALYST">Analyst</SelectItem>
                        <SelectItem value="ADMIN">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="sm:col-span-2">
                    <Button type="submit" disabled={busy}>
                      Create user
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm ring-1 ring-black/5">
              <CardHeader>
                <CardTitle className="text-base">Team</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell>{u.name}</TableCell>
                        <TableCell className="text-muted-foreground">{u.email}</TableCell>
                        <TableCell>
                          <Select
                            value={u.role}
                            onValueChange={(v) => void patchUser(u.id, { role: v as Role })}
                          >
                            <SelectTrigger className="w-[120px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="VIEWER">Viewer</SelectItem>
                              <SelectItem value="ANALYST">Analyst</SelectItem>
                              <SelectItem value="ADMIN">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={u.status}
                            onValueChange={(v) =>
                              void patchUser(u.id, { status: v as "ACTIVE" | "INACTIVE" })
                            }
                          >
                            <SelectTrigger className="w-[120px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ACTIVE">Active</SelectItem>
                              <SelectItem value="INACTIVE">Inactive</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ) : null}
      </Tabs>

      <Separator />

      <footer className="text-muted-foreground pb-8 text-center text-xs">
        Viewer: dashboard only · Analyst: dashboard + read records · Admin: records + users
      </footer>
    </div>
  );
}
