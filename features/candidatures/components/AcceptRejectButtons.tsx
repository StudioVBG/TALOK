"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

interface AcceptRejectButtonsProps {
  applicationId: string;
  applicantName: string;
  onAccept: (id: string) => void;
  onReject: (id: string, reason?: string) => void;
  acceptLoading?: boolean;
  rejectLoading?: boolean;
  disabled?: boolean;
}

export function AcceptRejectButtons({
  applicationId,
  applicantName,
  onAccept,
  onReject,
  acceptLoading,
  rejectLoading,
  disabled,
}: AcceptRejectButtonsProps) {
  const [showAcceptDialog, setShowAcceptDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const handleAccept = () => {
    onAccept(applicationId);
    setShowAcceptDialog(false);
  };

  const handleReject = () => {
    onReject(applicationId, rejectReason || undefined);
    setShowRejectDialog(false);
    setRejectReason("");
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          className="bg-emerald-600 hover:bg-emerald-700"
          onClick={() => setShowAcceptDialog(true)}
          disabled={disabled || acceptLoading}
        >
          {acceptLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle className="mr-2 h-4 w-4" />
          )}
          Accepter cette candidature
        </Button>
        <Button
          variant="outline"
          className="text-red-600 border-red-200 hover:bg-red-50"
          onClick={() => setShowRejectDialog(true)}
          disabled={disabled || rejectLoading}
        >
          {rejectLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <XCircle className="mr-2 h-4 w-4" />
          )}
          Refuser
        </Button>
      </div>

      {/* Dialog de confirmation d'acceptation */}
      <Dialog open={showAcceptDialog} onOpenChange={setShowAcceptDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Accepter la candidature</DialogTitle>
            <DialogDescription>
              Vous allez accepter la candidature de <strong>{applicantName}</strong>.
              Un bail sera automatiquement créé et les autres candidats seront notifiés du refus.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAcceptDialog(false)}>
              Annuler
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={handleAccept}
              disabled={acceptLoading}
            >
              {acceptLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmer l'acceptation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de refus */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refuser la candidature</DialogTitle>
            <DialogDescription>
              Refuser la candidature de <strong>{applicantName}</strong>.
              Un email de refus sera envoyé automatiquement.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Motif du refus (optionnel)..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={rejectLoading}
            >
              {rejectLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmer le refus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
