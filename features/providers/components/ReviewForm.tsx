'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Star, Loader2, Send } from 'lucide-react';

interface ReviewFormProps {
  providerProfileId: string;
  workOrderId: string;
  providerName: string;
  onSubmit: (data: {
    rating_overall: number;
    rating_punctuality: number | null;
    rating_quality: number | null;
    rating_communication: number | null;
    rating_value: number | null;
    comment: string;
  }) => Promise<void>;
}

function StarRating({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
}) {
  const [hover, setHover] = useState(0);

  return (
    <div className="flex items-center justify-between">
      <Label className="text-sm">{label}</Label>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            className="p-0.5"
          >
            <Star
              className={`h-5 w-5 transition-colors ${
                star <= (hover || value)
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-gray-300'
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

export function ReviewForm({ providerProfileId, workOrderId, providerName, onSubmit }: ReviewFormProps) {
  const [overall, setOverall] = useState(0);
  const [punctuality, setPunctuality] = useState(0);
  const [quality, setQuality] = useState(0);
  const [communication, setCommunication] = useState(0);
  const [value, setValue] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (overall === 0) {
      setError('Veuillez donner une note globale');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await onSubmit({
        rating_overall: overall,
        rating_punctuality: punctuality || null,
        rating_quality: quality || null,
        rating_communication: communication || null,
        rating_value: value || null,
        comment,
      });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <Card className="border-emerald-200 bg-emerald-50/30 dark:border-emerald-900/40">
        <CardContent className="py-8 text-center">
          <Star className="h-10 w-10 fill-yellow-400 text-yellow-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold">Merci pour votre avis !</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Votre retour aide les autres proprietaires a choisir leurs prestataires.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          Laisser un avis pour {providerName}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Note globale */}
          <div className="p-4 rounded-lg border bg-muted/30">
            <StarRating value={overall} onChange={setOverall} label="Note globale *" />
          </div>

          {/* Criteres detailles */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-muted-foreground">Criteres detailles (optionnel)</Label>
            <StarRating value={punctuality} onChange={setPunctuality} label="Ponctualite" />
            <StarRating value={quality} onChange={setQuality} label="Qualite du travail" />
            <StarRating value={communication} onChange={setCommunication} label="Communication" />
            <StarRating value={value} onChange={setValue} label="Rapport qualite/prix" />
          </div>

          {/* Commentaire */}
          <div className="space-y-2">
            <Label htmlFor="review-comment">Commentaire</Label>
            <Textarea
              id="review-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Partagez votre experience..."
              rows={3}
            />
          </div>

          <Button type="submit" disabled={submitting || overall === 0}>
            {submitting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Publier l&apos;avis
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
