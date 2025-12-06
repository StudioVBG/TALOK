// =====================================================
// Composant: Carte Solde d'un lot
// =====================================================

"use client";

import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Building2, Euro, TrendingUp, TrendingDown, CheckCircle2 
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { UnitBalance } from "@/lib/types/copro-charges";

interface UnitBalanceCardProps {
  balance: UnitBalance;
  onClick?: () => void;
}

export function UnitBalanceCard({ balance, onClick }: UnitBalanceCardProps) {
  const isPositiveBalance = balance.balance_due > 0;
  const isNegativeBalance = balance.balance_due < 0;
  const isBalanced = balance.balance_due === 0;

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn("cursor-pointer", onClick && "cursor-pointer")}
    >
      <Card className={cn(
        "border-white/10 bg-white/5 backdrop-blur-sm transition-all",
        isPositiveBalance && "hover:border-red-500/50",
        isNegativeBalance && "hover:border-green-500/50",
        isBalanced && "hover:border-cyan-500/50"
      )}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            {/* Info lot */}
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-lg",
                isPositiveBalance && "bg-red-500/20",
                isNegativeBalance && "bg-green-500/20",
                isBalanced && "bg-cyan-500/20"
              )}>
                <Building2 className={cn(
                  "w-5 h-5",
                  isPositiveBalance && "text-red-400",
                  isNegativeBalance && "text-green-400",
                  isBalanced && "text-cyan-400"
                )} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white">
                    Lot n°{balance.lot_number}
                  </span>
                  <Badge variant="outline" className="text-xs text-slate-400">
                    {balance.tantieme_general} mill.
                  </Badge>
                </div>
                <p className="text-sm text-slate-400">{balance.owner_name}</p>
              </div>
            </div>

            {/* Solde */}
            <div className="text-right">
              <div className="flex items-center gap-1 justify-end">
                {isPositiveBalance && <TrendingUp className="w-4 h-4 text-red-400" />}
                {isNegativeBalance && <TrendingDown className="w-4 h-4 text-green-400" />}
                {isBalanced && <CheckCircle2 className="w-4 h-4 text-cyan-400" />}
                <span className={cn(
                  "text-lg font-bold",
                  isPositiveBalance && "text-red-400",
                  isNegativeBalance && "text-green-400",
                  isBalanced && "text-cyan-400"
                )}>
                  {balance.balance_due.toLocaleString('fr-FR', {
                    style: 'currency',
                    currency: 'EUR',
                  })}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {isPositiveBalance && "Solde débiteur"}
                {isNegativeBalance && "Trop-perçu"}
                {isBalanced && "À jour"}
              </p>
            </div>
          </div>

          {/* Détails */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/10 text-xs text-slate-400">
            <div className="flex items-center gap-1">
              <Euro className="w-3 h-3" />
              <span>Charges: {balance.total_charges.toLocaleString('fr-FR')} €</span>
            </div>
            <div className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              <span>Payé: {balance.total_paid.toLocaleString('fr-FR')} €</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default UnitBalanceCard;

