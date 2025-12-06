"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  Euro, 
  Plus, 
  Receipt, 
  Users, 
  CheckCircle2, 
  Clock,
  AlertCircle,
  ArrowRight,
  Wallet
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { formatCurrency, formatDateShort } from "@/lib/helpers/format";

interface Roommate {
  id: string;
  name: string;
  avatar?: string;
  share_percentage: number;
}

interface Expense {
  id: string;
  description: string;
  amount: number;
  paid_by: string;
  paid_by_name: string;
  date: string;
  category: "rent" | "utilities" | "groceries" | "household" | "other";
  splits: ExpenseSplit[];
  settled: boolean;
}

interface ExpenseSplit {
  roommate_id: string;
  amount: number;
  settled: boolean;
}

interface Balance {
  roommate_id: string;
  roommate_name: string;
  balance: number; // Positif = on me doit, Négatif = je dois
}

interface Props {
  leaseId: string;
  roommates: Roommate[];
  currentUserId: string;
}

const EXPENSE_CATEGORIES = [
  { value: "rent", label: "Loyer", icon: "🏠" },
  { value: "utilities", label: "Charges", icon: "💡" },
  { value: "groceries", label: "Courses", icon: "🛒" },
  { value: "household", label: "Ménage", icon: "🧹" },
  { value: "other", label: "Autre", icon: "📦" },
];

export function ColocExpenseSplit({ leaseId, roommates, currentUserId }: Props) {
  const { toast } = useToast();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [settleDialogOpen, setSettleDialogOpen] = useState(false);
  const [selectedSettlement, setSelectedSettlement] = useState<Balance | null>(null);

  // Form state
  const [newExpense, setNewExpense] = useState({
    description: "",
    amount: "",
    category: "other" as Expense["category"],
    split_type: "equal" as "equal" | "custom",
  });

  useEffect(() => {
    fetchExpenses();
  }, [leaseId]);

  const fetchExpenses = async () => {
    try {
      // Simuler les données pour la démo
      const mockExpenses: Expense[] = [
        {
          id: "1",
          description: "Loyer Janvier",
          amount: 1200,
          paid_by: currentUserId,
          paid_by_name: "Vous",
          date: "2025-01-01",
          category: "rent",
          splits: roommates.map(r => ({
            roommate_id: r.id,
            amount: 1200 / roommates.length,
            settled: r.id === currentUserId,
          })),
          settled: false,
        },
        {
          id: "2",
          description: "Électricité",
          amount: 150,
          paid_by: roommates[1]?.id || currentUserId,
          paid_by_name: roommates[1]?.name || "Vous",
          date: "2025-01-15",
          category: "utilities",
          splits: roommates.map(r => ({
            roommate_id: r.id,
            amount: 150 / roommates.length,
            settled: r.id === (roommates[1]?.id || currentUserId),
          })),
          settled: false,
        },
      ];

      setExpenses(mockExpenses);
      calculateBalances(mockExpenses);
    } catch (error) {
      console.error("Erreur chargement dépenses:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateBalances = (expensesList: Expense[]) => {
    const balanceMap = new Map<string, number>();

    // Initialiser les balances
    roommates.forEach(r => balanceMap.set(r.id, 0));

    // Calculer les balances
    expensesList.forEach(expense => {
      // La personne qui a payé est créditée du montant total
      const currentPaidBalance = balanceMap.get(expense.paid_by) || 0;
      balanceMap.set(expense.paid_by, currentPaidBalance + expense.amount);

      // Chaque personne est débitée de sa part
      expense.splits.forEach(split => {
        const currentBalance = balanceMap.get(split.roommate_id) || 0;
        balanceMap.set(split.roommate_id, currentBalance - split.amount);
      });
    });

    // Convertir en array
    const balanceArray: Balance[] = roommates.map(r => ({
      roommate_id: r.id,
      roommate_name: r.name,
      balance: balanceMap.get(r.id) || 0,
    }));

    setBalances(balanceArray);
  };

  const handleAddExpense = async () => {
    if (!newExpense.description || !newExpense.amount) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir tous les champs",
        variant: "destructive",
      });
      return;
    }

    try {
      const amount = parseFloat(newExpense.amount);
      const splitAmount = amount / roommates.length;

      const expense: Expense = {
        id: Date.now().toString(),
        description: newExpense.description,
        amount,
        paid_by: currentUserId,
        paid_by_name: "Vous",
        date: new Date().toISOString().split("T")[0],
        category: newExpense.category,
        splits: roommates.map(r => ({
          roommate_id: r.id,
          amount: splitAmount,
          settled: r.id === currentUserId,
        })),
        settled: false,
      };

      const updatedExpenses = [expense, ...expenses];
      setExpenses(updatedExpenses);
      calculateBalances(updatedExpenses);

      toast({
        title: "Dépense ajoutée",
        description: `${formatCurrency(amount)} répartis entre ${roommates.length} colocataires`,
      });

      setDialogOpen(false);
      setNewExpense({
        description: "",
        amount: "",
        category: "other",
        split_type: "equal",
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible d'ajouter la dépense",
        variant: "destructive",
      });
    }
  };

  const handleSettle = async () => {
    if (!selectedSettlement) return;

    toast({
      title: "Remboursement enregistré",
      description: `Vous avez remboursé ${formatCurrency(Math.abs(selectedSettlement.balance))} à ${selectedSettlement.roommate_name}`,
    });

    setSettleDialogOpen(false);
    setSelectedSettlement(null);
    // Refresh expenses
    fetchExpenses();
  };

  const getMyBalance = () => {
    return balances.find(b => b.roommate_id === currentUserId)?.balance || 0;
  };

  const getCategoryInfo = (category: string) => {
    return EXPENSE_CATEGORIES.find(c => c.value === category) || EXPENSE_CATEGORIES[4];
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="mt-4 text-muted-foreground">Chargement des dépenses...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Balance Summary */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className={`border-2 ${getMyBalance() >= 0 ? "border-emerald-200 bg-emerald-50/50" : "border-amber-200 bg-amber-50/50"}`}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl ${getMyBalance() >= 0 ? "bg-emerald-100" : "bg-amber-100"}`}>
                  <Wallet className={`h-6 w-6 ${getMyBalance() >= 0 ? "text-emerald-600" : "text-amber-600"}`} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Votre solde</p>
                  <p className={`text-2xl font-bold ${getMyBalance() >= 0 ? "text-emerald-600" : "text-amber-600"}`}>
                    {getMyBalance() >= 0 ? "+" : ""}{formatCurrency(getMyBalance())}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Dialog open={settleDialogOpen} onOpenChange={setSettleDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline">
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Rembourser
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Enregistrer un remboursement</DialogTitle>
                      <DialogDescription>
                        Sélectionnez la personne à qui vous avez remboursé
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      {balances
                        .filter(b => b.roommate_id !== currentUserId && b.balance > 0)
                        .map(balance => (
                          <div
                            key={balance.roommate_id}
                            className={`p-4 rounded-lg border cursor-pointer transition-all ${
                              selectedSettlement?.roommate_id === balance.roommate_id
                                ? "border-primary bg-primary/5"
                                : "hover:border-primary/50"
                            }`}
                            onClick={() => setSelectedSettlement(balance)}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{balance.roommate_name}</span>
                              <span className="text-emerald-600 font-bold">
                                {formatCurrency(balance.balance)}
                              </span>
                            </div>
                          </div>
                        ))}
                      {balances.filter(b => b.roommate_id !== currentUserId && b.balance > 0).length === 0 && (
                        <p className="text-center text-muted-foreground py-4">
                          Personne ne vous doit d'argent
                        </p>
                      )}
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setSettleDialogOpen(false)}>
                        Annuler
                      </Button>
                      <Button onClick={handleSettle} disabled={!selectedSettlement}>
                        Confirmer
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Ajouter une dépense
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Nouvelle dépense</DialogTitle>
                      <DialogDescription>
                        Ajoutez une dépense à partager avec vos colocataires
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Input
                          id="description"
                          placeholder="Ex: Courses, électricité..."
                          value={newExpense.description}
                          onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="amount">Montant (€)</Label>
                        <Input
                          id="amount"
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={newExpense.amount}
                          onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Catégorie</Label>
                        <Select
                          value={newExpense.category}
                          onValueChange={(value) => setNewExpense({ ...newExpense, category: value as Expense["category"] })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {EXPENSE_CATEGORIES.map(cat => (
                              <SelectItem key={cat.value} value={cat.value}>
                                {cat.icon} {cat.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="p-4 bg-muted rounded-lg">
                        <p className="text-sm text-muted-foreground mb-2">Répartition</p>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Par personne :</span>
                          <span className="font-semibold">
                            {newExpense.amount
                              ? formatCurrency(parseFloat(newExpense.amount) / roommates.length)
                              : "0,00 €"
                            }
                          </span>
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setDialogOpen(false)}>
                        Annuler
                      </Button>
                      <Button onClick={handleAddExpense}>
                        Ajouter
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Balances per roommate */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Soldes entre colocataires
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {balances
                .filter(b => b.roommate_id !== currentUserId)
                .map(balance => (
                  <div
                    key={balance.roommate_id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback>
                          {balance.roommate_name.split(" ").map(n => n[0]).join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{balance.roommate_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {balance.balance > 0 ? "Vous doit" : balance.balance < 0 ? "Vous devez" : "Équilibré"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${
                        balance.balance > 0 ? "text-emerald-600" : 
                        balance.balance < 0 ? "text-red-600" : "text-gray-600"
                      }`}>
                        {balance.balance > 0 ? "+" : ""}{formatCurrency(Math.abs(balance.balance))}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Recent expenses */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Dépenses récentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {expenses.length > 0 ? (
              <div className="space-y-3">
                {expenses.map(expense => {
                  const categoryInfo = getCategoryInfo(expense.category);
                  const mySplit = expense.splits.find(s => s.roommate_id === currentUserId);
                  
                  return (
                    <div
                      key={expense.id}
                      className="flex items-center justify-between p-4 rounded-lg border"
                    >
                      <div className="flex items-center gap-4">
                        <div className="text-2xl">{categoryInfo.icon}</div>
                        <div>
                          <p className="font-medium">{expense.description}</p>
                          <p className="text-sm text-muted-foreground">
                            Payé par {expense.paid_by_name} • {formatDateShort(expense.date)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{formatCurrency(expense.amount)}</p>
                        <p className="text-sm text-muted-foreground">
                          Ma part : {formatCurrency(mySplit?.amount || 0)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <Receipt className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground">Aucune dépense enregistrée</p>
                <p className="text-sm text-muted-foreground">
                  Ajoutez votre première dépense pour commencer
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

