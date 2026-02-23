"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  ArrowUpDown,
  Pencil,
  Trash2,
  Loader2,
} from "lucide-react";

interface Transaction {
  id: number;
  date: string;
  description: string;
  amount: number;
  category: string;
  accountDebit: string;
  accountCredit: string;
  gstAmount: number;
  isCapitalAsset: boolean;
  ccaClass: string | null;
  ccaRate: number | null;
  notes: string | null;
  flaggedForReview: boolean;
  createdAt: string;
}

type SortKey = "date" | "description" | "amount" | "category";

const categoryLabels: Record<string, string> = {
  revenue: "Revenue",
  cogs: "COGS",
  operating_expense: "Expense",
  capital_asset: "Capital Asset",
};

const categoryColors: Record<string, string> = {
  revenue: "bg-emerald-100 text-emerald-700",
  cogs: "bg-orange-100 text-orange-700",
  operating_expense: "bg-blue-100 text-blue-700",
  capital_asset: "bg-purple-100 text-purple-700",
};

export default function JournalPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [editForm, setEditForm] = useState<Partial<Transaction>>({});
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const loadTransactions = useCallback(async () => {
    try {
      const res = await fetch("/api/transactions");
      if (res.ok) {
        const data = await res.json();
        setTransactions(data);
      }
    } catch (err) {
      console.error("Failed to load transactions:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sorted = [...transactions].sort((a, b) => {
    const mul = sortDir === "asc" ? 1 : -1;
    if (sortKey === "amount") return (a.amount - b.amount) * mul;
    const aVal = a[sortKey] ?? "";
    const bVal = b[sortKey] ?? "";
    return String(aVal).localeCompare(String(bVal)) * mul;
  });

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await fetch(`/api/transactions?id=${deleteId}`, { method: "DELETE" });
      setTransactions((prev) => prev.filter((t) => t.id !== deleteId));
    } catch (err) {
      console.error("Failed to delete:", err);
    }
    setDeleteId(null);
  }

  async function handleEdit() {
    if (!editTx) return;
    try {
      const res = await fetch("/api/transactions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editTx.id, ...editForm }),
      });
      if (res.ok) {
        await loadTransactions();
      }
    } catch (err) {
      console.error("Failed to update:", err);
    }
    setEditTx(null);
    setEditForm({});
  }

  function openEdit(tx: Transaction) {
    setEditTx(tx);
    setEditForm({
      date: tx.date,
      description: tx.description,
      amount: tx.amount,
      category: tx.category,
      accountDebit: tx.accountDebit,
      accountCredit: tx.accountCredit,
      gstAmount: tx.gstAmount,
      notes: tx.notes,
    });
  }

  function SortButton({
    column,
    label,
  }: {
    column: SortKey;
    label: string;
  }) {
    return (
      <button
        onClick={() => handleSort(column)}
        className="flex items-center gap-1 hover:text-foreground transition-colors"
      >
        {label}
        <ArrowUpDown className="h-3 w-3" />
      </button>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Journal</h1>
          <p className="text-sm text-muted-foreground">
            {transactions.length} transaction
            {transactions.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {transactions.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No transactions yet. Start chatting to log entries!</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">
                  <SortButton column="date" label="Date" />
                </TableHead>
                <TableHead>
                  <SortButton column="description" label="Description" />
                </TableHead>
                <TableHead className="text-right">
                  <SortButton column="amount" label="Amount" />
                </TableHead>
                <TableHead>
                  <SortButton column="category" label="Category" />
                </TableHead>
                <TableHead>Debit</TableHead>
                <TableHead>Credit</TableHead>
                <TableHead className="text-right">GST</TableHead>
                <TableHead className="w-[60px]">Flags</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell className="text-sm whitespace-nowrap">
                    {tx.date}
                  </TableCell>
                  <TableCell className="text-sm max-w-[200px] truncate">
                    {tx.description}
                  </TableCell>
                  <TableCell className="text-sm text-right font-mono">
                    ${tx.amount.toLocaleString("en-CA", { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={categoryColors[tx.category] || ""}
                    >
                      {categoryLabels[tx.category] || tx.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {tx.accountDebit}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {tx.accountCredit}
                  </TableCell>
                  <TableCell className="text-sm text-right font-mono">
                    ${tx.gstAmount.toFixed(2)}
                  </TableCell>
                  <TableCell>
                    {tx.flaggedForReview && (
                      <span title="Flagged for CPA review">
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                      </span>
                    )}
                    {tx.isCapitalAsset && (
                      <Badge variant="outline" className="text-[10px] ml-1">
                        CCA
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => openEdit(tx)}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => setDeleteId(tx.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editTx} onOpenChange={() => setEditTx(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Transaction</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Date</label>
              <Input
                type="date"
                value={editForm.date || ""}
                onChange={(e) =>
                  setEditForm({ ...editForm, date: e.target.value })
                }
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Input
                value={editForm.description || ""}
                onChange={(e) =>
                  setEditForm({ ...editForm, description: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Amount</label>
                <Input
                  type="number"
                  step="0.01"
                  value={editForm.amount || ""}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      amount: parseFloat(e.target.value),
                    })
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium">GST Amount</label>
                <Input
                  type="number"
                  step="0.01"
                  value={editForm.gstAmount || ""}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      gstAmount: parseFloat(e.target.value),
                    })
                  }
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Notes</label>
              <Input
                value={editForm.notes || ""}
                onChange={(e) =>
                  setEditForm({ ...editForm, notes: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTx(null)}>
              Cancel
            </Button>
            <Button onClick={handleEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Transaction</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this transaction? This cannot be
            undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
