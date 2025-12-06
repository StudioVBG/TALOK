"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  Circle,
  AlertTriangle,
  XCircle,
  Phone,
  ExternalLink,
  FileText,
  ChevronDown,
  ChevronUp,
  Clock,
  Scale,
  Copy,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { LegalProtocol, ProtocolStep, StepStatus } from "@/lib/types/legal-protocols";

interface ProtocolChecklistProps {
  protocol: LegalProtocol;
  stepsStatus?: Record<string, StepStatus>;
  onStepStatusChange?: (stepId: string, status: StepStatus) => void;
  className?: string;
}

const priorityConfig = {
  critique: {
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-100 dark:bg-red-900/30",
    border: "border-red-500",
    label: "Critique",
  },
  important: {
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-100 dark:bg-amber-900/30",
    border: "border-amber-500",
    label: "Important",
  },
  recommandé: {
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-100 dark:bg-blue-900/30",
    border: "border-blue-500",
    label: "Recommandé",
  },
};

export function ProtocolChecklist({
  protocol,
  stepsStatus = {},
  onStepStatusChange,
  className,
}: ProtocolChecklistProps) {
  const [expandedSteps, setExpandedSteps] = useState<string[]>([protocol.steps[0]?.id]);
  const [copiedContact, setCopiedContact] = useState<string | null>(null);

  // Calculer la progression
  const completedSteps = Object.values(stepsStatus).filter(s => s === "completed").length;
  const progressPercentage = Math.round((completedSteps / protocol.steps.length) * 100);

  const toggleStep = useCallback((stepId: string) => {
    setExpandedSteps(prev => 
      prev.includes(stepId) 
        ? prev.filter(id => id !== stepId)
        : [...prev, stepId]
    );
  }, []);

  const handleCopyContact = useCallback((text: string, contactId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedContact(contactId);
    setTimeout(() => setCopiedContact(null), 2000);
  }, []);

  const getStepIcon = (step: ProtocolStep, status: StepStatus) => {
    if (status === "completed") {
      return <CheckCircle2 className="w-6 h-6 text-green-500" />;
    }
    if (status === "in_progress") {
      return (
        <div className="relative">
          <Circle className="w-6 h-6 text-primary" />
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-primary"
            animate={{ scale: [1, 1.3, 1], opacity: [1, 0, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        </div>
      );
    }
    if (step.forbidden_actions && step.forbidden_actions.length > 0) {
      return <XCircle className="w-6 h-6 text-red-500" />;
    }
    return <Circle className="w-6 h-6 text-muted-foreground/40" />;
  };

  return (
    <Card className={cn("overflow-hidden", className)}>
      {/* Header avec progression */}
      <CardHeader className="bg-gradient-to-br from-primary/5 to-primary/10 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{protocol.icon}</span>
            <div>
              <CardTitle className="text-xl">{protocol.title}</CardTitle>
              <CardDescription>{protocol.subtitle}</CardDescription>
            </div>
          </div>
          <Badge variant="secondary" className="text-sm font-medium">
            {completedSteps}/{protocol.steps.length} étapes
          </Badge>
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progression</span>
            <span className="font-medium">{progressPercentage}%</span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
        </div>

        {/* Source juridique */}
        <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
          <Scale className="w-3.5 h-3.5" />
          <span>{protocol.legal_source}</span>
          <span className="mx-1">•</span>
          <span>Mis à jour : {new Date(protocol.last_updated).toLocaleDateString("fr-FR")}</span>
        </div>
      </CardHeader>

      {/* Contacts d'urgence */}
      {protocol.emergency_contacts.length > 0 && (
        <div className="px-4 py-3 bg-red-50 dark:bg-red-950/20 border-b border-red-200 dark:border-red-900">
          <div className="flex items-center gap-2 mb-2">
            <Phone className="w-4 h-4 text-red-600" />
            <span className="text-sm font-medium text-red-700 dark:text-red-400">
              Contacts d&apos;urgence
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {protocol.emergency_contacts.map((contact, idx) => (
              <TooltipProvider key={idx}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 border-red-300 hover:bg-red-100 dark:border-red-800 dark:hover:bg-red-900/30"
                      onClick={() => {
                        if (contact.phone) {
                          window.location.href = `tel:${contact.phone}`;
                        } else if (contact.url) {
                          window.open(contact.url, "_blank");
                        }
                      }}
                    >
                      {contact.phone ? (
                        <>
                          <Phone className="w-3.5 h-3.5 mr-1.5" />
                          {contact.phone}
                        </>
                      ) : (
                        <>
                          <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                          {contact.role}
                        </>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="font-medium">{contact.role}</p>
                    <p className="text-xs">{contact.notes}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
          </div>
        </div>
      )}

      {/* Liste des étapes */}
      <CardContent className="p-0">
        <div className="divide-y">
          {protocol.steps.map((step, index) => {
            const status = stepsStatus[step.id] || "pending";
            const isExpanded = expandedSteps.includes(step.id);
            const priority = priorityConfig[step.priority];
            const hasForbiddenActions = step.forbidden_actions && step.forbidden_actions.length > 0;

            return (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={cn(
                  "relative",
                  status === "in_progress" && "bg-primary/5",
                  hasForbiddenActions && "bg-red-50/50 dark:bg-red-950/10"
                )}
              >
                {/* En-tête de l'étape */}
                <button
                  onClick={() => toggleStep(step.id)}
                  className="w-full p-4 flex items-start gap-4 text-left transition-colors hover:bg-muted/50"
                >
                  {/* Numéro et statut */}
                  <div className="flex-shrink-0 flex flex-col items-center gap-1">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-semibold">
                      {step.order}
                    </div>
                    {getStepIcon(step, status)}
                  </div>

                  {/* Contenu */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold text-base">{step.title}</h4>
                      <Badge className={cn("text-xs", priority.bg, priority.color)} variant="outline">
                        {priority.label}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {step.description}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {step.estimated_duration}
                      </span>
                      {step.deadline_info && (
                        <span className="flex items-center gap-1 text-amber-600">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          {step.deadline_info}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Chevron */}
                  <div className="flex-shrink-0">
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                </button>

                {/* Contenu détaillé */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 pl-16 space-y-4">
                        {/* Warning */}
                        {step.warning && (
                          <Alert variant="destructive">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>Attention</AlertTitle>
                            <AlertDescription>{step.warning}</AlertDescription>
                          </Alert>
                        )}

                        {/* Référence légale */}
                        {step.legal_reference && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 p-2 rounded">
                            <Scale className="w-4 h-4" />
                            <span>Référence : {step.legal_reference}</span>
                          </div>
                        )}

                        {/* Actions interdites */}
                        {hasForbiddenActions && (
                          <div className="space-y-2">
                            <h5 className="text-sm font-semibold text-red-600 flex items-center gap-2">
                              <XCircle className="w-4 h-4" />
                              Actions INTERDITES :
                            </h5>
                            <ul className="space-y-1.5">
                              {step.forbidden_actions!.map((action, idx) => (
                                <li key={idx} className="text-sm text-red-700 dark:text-red-400 pl-2">
                                  {action}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Actions à faire */}
                        {step.detailed_actions.length > 0 && (
                          <div className="space-y-2">
                            <h5 className="text-sm font-semibold flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-green-600" />
                              Actions à effectuer :
                            </h5>
                            <ul className="space-y-1.5">
                              {step.detailed_actions.map((action, idx) => (
                                <li key={idx} className="text-sm flex items-start gap-2">
                                  <span className="text-green-600 mt-0.5">•</span>
                                  {action}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Documents */}
                        {step.documents.length > 0 && (
                          <div className="space-y-2">
                            <h5 className="text-sm font-semibold flex items-center gap-2">
                              <FileText className="w-4 h-4" />
                              Documents à préparer :
                            </h5>
                            <div className="grid gap-2">
                              {step.documents.map((doc) => (
                                <div
                                  key={doc.id}
                                  className={cn(
                                    "p-2 rounded border flex items-start gap-2",
                                    doc.required 
                                      ? "border-amber-300 bg-amber-50/50 dark:bg-amber-950/20" 
                                      : "border-muted"
                                  )}
                                >
                                  <FileText className={cn(
                                    "w-4 h-4 mt-0.5 flex-shrink-0",
                                    doc.required ? "text-amber-600" : "text-muted-foreground"
                                  )} />
                                  <div className="flex-1">
                                    <p className="text-sm font-medium">
                                      {doc.name}
                                      {doc.required && (
                                        <Badge variant="outline" className="ml-2 text-xs">
                                          Obligatoire
                                        </Badge>
                                      )}
                                    </p>
                                    <p className="text-xs text-muted-foreground">{doc.description}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Contacts */}
                        {step.contacts.length > 0 && (
                          <div className="space-y-2">
                            <h5 className="text-sm font-semibold flex items-center gap-2">
                              <Phone className="w-4 h-4" />
                              Contacts utiles :
                            </h5>
                            <div className="flex flex-wrap gap-2">
                              {step.contacts.map((contact, idx) => {
                                const contactKey = `${step.id}-${idx}`;
                                return (
                                  <TooltipProvider key={idx}>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="h-8"
                                          onClick={() => {
                                            if (contact.phone) {
                                              handleCopyContact(contact.phone, contactKey);
                                            } else if (contact.url) {
                                              window.open(contact.url, "_blank");
                                            }
                                          }}
                                        >
                                          {contact.phone ? (
                                            <>
                                              {copiedContact === contactKey ? (
                                                <Check className="w-3.5 h-3.5 mr-1.5 text-green-600" />
                                              ) : (
                                                <Copy className="w-3.5 h-3.5 mr-1.5" />
                                              )}
                                              {contact.phone}
                                            </>
                                          ) : (
                                            <>
                                              <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                                              {contact.role}
                                            </>
                                          )}
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p className="font-medium">{contact.role}</p>
                                        <p className="text-xs">{contact.notes}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Boutons d'action */}
                        {onStepStatusChange && (
                          <div className="flex gap-2 pt-2">
                            <Button
                              size="sm"
                              variant={status === "completed" ? "default" : "outline"}
                              onClick={() => onStepStatusChange(step.id, status === "completed" ? "pending" : "completed")}
                            >
                              <CheckCircle2 className="w-4 h-4 mr-1.5" />
                              {status === "completed" ? "Fait ✓" : "Marquer comme fait"}
                            </Button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Ligne de connexion verticale */}
                {index < protocol.steps.length - 1 && (
                  <div
                    className={cn(
                      "absolute left-[30px] top-[80px] w-0.5 h-[calc(100%-80px)]",
                      status === "completed" ? "bg-green-500" : "bg-muted"
                    )}
                  />
                )}
              </motion.div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}







