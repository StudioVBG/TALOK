"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IndexationCard } from "./IndexationCard";
import { Clock, CheckCircle, XCircle } from "lucide-react";

interface IndexationListProps {
  pending: any[];
  applied: any[];
  declined: any[];
}

export function IndexationList({ pending, applied, declined }: IndexationListProps) {
  const [activeTab, setActiveTab] = useState("pending");

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList className="w-full justify-start border-b rounded-none bg-transparent p-0">
        <TabsTrigger 
          value="pending" 
          className="data-[state=active]:border-b-2 data-[state=active]:border-amber-500 rounded-none"
        >
          <Clock className="h-4 w-4 mr-2" />
          En attente ({pending.length})
        </TabsTrigger>
        <TabsTrigger 
          value="applied"
          className="data-[state=active]:border-b-2 data-[state=active]:border-green-500 rounded-none"
        >
          <CheckCircle className="h-4 w-4 mr-2" />
          Appliquées ({applied.length})
        </TabsTrigger>
        <TabsTrigger 
          value="declined"
          className="data-[state=active]:border-b-2 data-[state=active]:border-slate-500 rounded-none"
        >
          <XCircle className="h-4 w-4 mr-2" />
          Non appliquées ({declined.length})
        </TabsTrigger>
      </TabsList>

      <TabsContent value="pending" className="mt-6">
        {pending.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <Clock className="h-12 w-12 mx-auto mb-3 text-slate-300" />
            <p>Aucune révision en attente</p>
            <p className="text-sm mt-1">
              Les révisions éligibles apparaîtront ici à la date anniversaire de vos baux
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {pending.map((indexation) => (
              <IndexationCard 
                key={indexation.id} 
                indexation={indexation} 
                showActions 
              />
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="applied" className="mt-6">
        {applied.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <CheckCircle className="h-12 w-12 mx-auto mb-3 text-slate-300" />
            <p>Aucune révision appliquée</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {applied.map((indexation) => (
              <IndexationCard 
                key={indexation.id} 
                indexation={indexation} 
              />
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="declined" className="mt-6">
        {declined.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <XCircle className="h-12 w-12 mx-auto mb-3 text-slate-300" />
            <p>Aucune révision refusée</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {declined.map((indexation) => (
              <IndexationCard 
                key={indexation.id} 
                indexation={indexation} 
              />
            ))}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}

