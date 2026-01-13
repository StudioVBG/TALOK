'use client';

/**
 * Tenant Rewards Dashboard
 * SOTA 2026 - Bilt-style loyalty program
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Gift,
  Star,
  Trophy,
  Flame,
  CreditCard,
  ShoppingBag,
  Utensils,
  Film,
  Plane,
  Wrench,
  Zap,
  ChevronRight,
  Medal,
} from 'lucide-react';

interface RewardsAccount {
  points_balance: number;
  lifetime_points: number;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  tier_progress: number;
  payment_streak: number;
  longest_streak: number;
  rewards_earned: number;
  rank: number;
  badges: Array<{ badge: { id: string; name: string; icon: string }; earned_at: string }>;
  config: {
    pointsPerEuro: number;
    pointsPerEuroRedemption: number;
    tiers: Record<string, number>;
  };
}

interface RewardPartner {
  id: string;
  name: string;
  logo_url: string | null;
  category: string;
  description: string;
  is_featured: boolean;
}

interface RewardTransaction {
  id: string;
  type: 'earned' | 'redeemed' | 'expired' | 'bonus';
  points: number;
  description: string;
  created_at: string;
}

const tierConfig = {
  bronze: { color: 'bg-amber-600', icon: Medal, label: 'Bronze' },
  silver: { color: 'bg-gray-400', icon: Medal, label: 'Argent' },
  gold: { color: 'bg-yellow-500', icon: Trophy, label: 'Or' },
  platinum: { color: 'bg-purple-500', icon: Star, label: 'Platine' },
};

const categoryIcons: Record<string, React.ElementType> = {
  dining: Utensils,
  shopping: ShoppingBag,
  entertainment: Film,
  travel: Plane,
  services: Wrench,
  utilities: Zap,
};

function formatNumber(num: number): string {
  return new Intl.NumberFormat('fr-FR').format(num);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  });
}

export function RewardsDashboard() {
  const [account, setAccount] = useState<RewardsAccount | null>(null);
  const [partners, setPartners] = useState<RewardPartner[]>([]);
  const [history, setHistory] = useState<RewardTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  async function fetchData() {
    setLoading(true);
    try {
      const [accountRes, partnersRes, historyRes] = await Promise.all([
        fetch('/api/sota/rewards?type=account'),
        fetch('/api/sota/rewards?type=partners'),
        fetch('/api/sota/rewards?type=history&limit=10'),
      ]);

      if (accountRes.ok) setAccount(await accountRes.json());
      if (partnersRes.ok) setPartners(await partnersRes.json());
      if (historyRes.ok) setHistory(await historyRes.json());
    } catch (error) {
      console.error('Failed to fetch rewards data:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!account) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Impossible de charger les récompenses
        </CardContent>
      </Card>
    );
  }

  const TierIcon = tierConfig[account.tier].icon;
  const nextTierThreshold = account.tier === 'bronze' ? account.config.tiers.silver :
                           account.tier === 'silver' ? account.config.tiers.gold :
                           account.tier === 'gold' ? account.config.tiers.platinum :
                           null;

  return (
    <div className="space-y-6">
      {/* Points Overview Card */}
      <Card className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/80">Vos points</p>
              <p className="text-4xl font-bold">
                {formatNumber(account.points_balance)}
              </p>
              <p className="text-sm text-white/80 mt-1">
                = {formatNumber(account.points_balance / account.config.pointsPerEuroRedemption)}€ en récompenses
              </p>
            </div>
            <div className="text-right">
              <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${tierConfig[account.tier].color}`}>
                <TierIcon className="h-4 w-4" />
                <span className="font-medium">{tierConfig[account.tier].label}</span>
              </div>
              <p className="text-sm text-white/80 mt-2">
                Rang #{account.rank}
              </p>
            </div>
          </div>

          {/* Tier Progress */}
          {nextTierThreshold && (
            <div className="mt-6">
              <div className="flex justify-between text-sm text-white/80 mb-2">
                <span>Progression vers {
                  account.tier === 'bronze' ? 'Argent' :
                  account.tier === 'silver' ? 'Or' : 'Platine'
                }</span>
                <span>{formatNumber(account.lifetime_points)} / {formatNumber(nextTierThreshold)}</span>
              </div>
              <Progress value={account.tier_progress} className="h-2 bg-white/20" />
            </div>
          )}

          {/* Streak */}
          <div className="flex items-center gap-4 mt-6 pt-4 border-t border-white/20">
            <div className="flex items-center gap-2">
              <Flame className="h-5 w-5 text-orange-400" />
              <div>
                <p className="text-2xl font-bold">{account.payment_streak}</p>
                <p className="text-xs text-white/80">Série en cours</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-400" />
              <div>
                <p className="text-2xl font-bold">{account.longest_streak}</p>
                <p className="text-xs text-white/80">Record</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-green-400" />
              <div>
                <p className="text-2xl font-bold">{account.rewards_earned}€</p>
                <p className="text-xs text-white/80">Économisés</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Aperçu</TabsTrigger>
          <TabsTrigger value="earn">Gagner</TabsTrigger>
          <TabsTrigger value="redeem">Échanger</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Badges */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Mes badges</CardTitle>
            </CardHeader>
            <CardContent>
              {account.badges.length > 0 ? (
                <div className="flex flex-wrap gap-3">
                  {account.badges.map((b) => (
                    <div
                      key={b.badge.id}
                      className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg"
                      title={`Obtenu le ${formatDate(b.earned_at)}`}
                    >
                      <span className="text-2xl">{b.badge.icon}</span>
                      <span className="text-sm font-medium">{b.badge.name}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Payez votre loyer à temps pour débloquer des badges !
                </p>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Activité récente</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {history.slice(0, 5).map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        tx.type === 'earned' || tx.type === 'bonus' ? 'bg-green-100 text-green-600' :
                        tx.type === 'redeemed' ? 'bg-blue-100 text-blue-600' :
                        'bg-red-100 text-red-600'
                      }`}>
                        {tx.type === 'earned' || tx.type === 'bonus' ? '+' : '-'}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{tx.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(tx.created_at)}
                        </p>
                      </div>
                    </div>
                    <span className={`font-medium ${
                      tx.points > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {tx.points > 0 ? '+' : ''}{formatNumber(tx.points)}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="earn" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Comment gagner des points</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-3">
                  <CreditCard className="h-8 w-8 text-indigo-500" />
                  <div>
                    <p className="font-medium">Paiement du loyer</p>
                    <p className="text-sm text-muted-foreground">
                      {account.config.pointsPerEuro} point par euro payé
                    </p>
                  </div>
                </div>
                <Badge>Automatique</Badge>
              </div>

              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-3">
                  <Flame className="h-8 w-8 text-orange-500" />
                  <div>
                    <p className="font-medium">Bonus ponctualité</p>
                    <p className="text-sm text-muted-foreground">
                      50 points pour chaque paiement à temps
                    </p>
                  </div>
                </div>
                <Badge variant="secondary">+50</Badge>
              </div>

              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-3">
                  <Trophy className="h-8 w-8 text-yellow-500" />
                  <div>
                    <p className="font-medium">Bonus série</p>
                    <p className="text-sm text-muted-foreground">
                      Jusqu'à 500 points pour 12 mois consécutifs
                    </p>
                  </div>
                </div>
                <Badge variant="secondary">+100-500</Badge>
              </div>

              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-3">
                  <Gift className="h-8 w-8 text-purple-500" />
                  <div>
                    <p className="font-medium">Parrainage</p>
                    <p className="text-sm text-muted-foreground">
                      500 points par ami parrainé
                    </p>
                  </div>
                </div>
                <Button size="sm">Parrainer</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="redeem" className="space-y-4">
          {/* Featured Partners */}
          <div className="grid gap-4 md:grid-cols-2">
            {partners.filter(p => p.is_featured).map((partner) => {
              const CategoryIcon = categoryIcons[partner.category] || Gift;
              return (
                <Card key={partner.id} className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                          <CategoryIcon className="h-6 w-6" />
                        </div>
                        <div>
                          <p className="font-medium">{partner.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {partner.description}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* All Partners */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Tous les partenaires</CardTitle>
              <CardDescription>
                100 points = 1€ de récompense
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2">
                {partners.map((partner) => {
                  const CategoryIcon = categoryIcons[partner.category] || Gift;
                  return (
                    <div
                      key={partner.id}
                      className="flex items-center justify-between p-3 hover:bg-muted rounded-lg cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <CategoryIcon className="h-5 w-5 text-muted-foreground" />
                        <span>{partner.name}</span>
                      </div>
                      <Button size="sm" variant="outline">
                        Échanger
                      </Button>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default RewardsDashboard;
