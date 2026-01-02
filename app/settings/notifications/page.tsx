'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Bell,
  Mail,
  MessageSquare,
  Smartphone,
  Moon,
  Clock,
  Save,
  Loader2,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import {
  NotificationPreferences,
  NotificationTemplate,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CHANNEL_LABELS,
  DIGEST_MODE_LABELS,
  NotificationChannel,
} from '@/lib/types/notifications';

export default function NotificationSettingsPage() {
  const { toast } = useToast();
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Charger les préférences
  useEffect(() => {
    async function fetchPreferences() {
      try {
        const response = await fetch('/api/notifications/preferences');
        const data = await response.json();
        
        if (response.ok) {
          setPreferences(data.preferences);
          setTemplates(data.templates || []);
        } else {
          toast({ title: 'Erreur', description: 'Erreur lors du chargement des préférences', variant: 'destructive' });
        }
      } catch (error) {
        toast({ title: 'Erreur', description: 'Erreur de connexion', variant: 'destructive' });
      } finally {
        setIsLoading(false);
      }
    }

    fetchPreferences();
  }, []);

  // Mettre à jour une préférence
  const updatePreference = <K extends keyof NotificationPreferences>(
    key: K,
    value: NotificationPreferences[K]
  ) => {
    if (preferences) {
      setPreferences({ ...preferences, [key]: value });
      setHasChanges(true);
    }
  };

  // Sauvegarder les préférences
  const savePreferences = async () => {
    if (!preferences) return;

    setIsSaving(true);
    try {
      const response = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          in_app_enabled: preferences.in_app_enabled,
          email_enabled: preferences.email_enabled,
          sms_enabled: preferences.sms_enabled,
          push_enabled: preferences.push_enabled,
          notification_email: preferences.notification_email,
          sms_phone: preferences.sms_phone,
          category_preferences: preferences.category_preferences,
          disabled_templates: preferences.disabled_templates,
          quiet_hours_start: preferences.quiet_hours_start,
          quiet_hours_end: preferences.quiet_hours_end,
          quiet_hours_timezone: preferences.quiet_hours_timezone,
          digest_mode: preferences.digest_mode,
          digest_time: preferences.digest_time,
          digest_day: preferences.digest_day,
        }),
      });

      if (response.ok) {
        toast({ title: 'Succès', description: 'Préférences enregistrées' });
        setHasChanges(false);
      } else {
        const data = await response.json();
        toast({ title: 'Erreur', description: data.error || 'Erreur lors de la sauvegarde', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Erreur', description: 'Erreur de connexion', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle un template désactivé
  const toggleTemplate = (templateCode: string) => {
    if (!preferences) return;

    const disabled = [...(preferences.disabled_templates || [])];
    const index = disabled.indexOf(templateCode);
    
    if (index === -1) {
      disabled.push(templateCode);
    } else {
      disabled.splice(index, 1);
    }
    
    updatePreference('disabled_templates', disabled);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!preferences) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Impossible de charger les préférences</p>
      </div>
    );
  }

  // Grouper les templates par catégorie
  const templatesByCategory = templates.reduce((acc, template) => {
    if (!acc[template.category]) {
      acc[template.category] = [];
    }
    acc[template.category].push(template);
    return acc;
  }, {} as Record<string, NotificationTemplate[]>);

  return (
    <div className="container max-w-4xl py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-8"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
            <p className="text-muted-foreground mt-1">
              Configurez comment et quand vous souhaitez être notifié
            </p>
          </div>
          
          {hasChanges && (
            <Button onClick={savePreferences} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Enregistrer
            </Button>
          )}
        </div>

        {/* Canaux de notification */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Canaux de notification
            </CardTitle>
            <CardDescription>
              Choisissez les canaux par lesquels vous souhaitez recevoir des notifications
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* In-App */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <Bell className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <Label className="font-medium">Notifications dans l'application</Label>
                  <p className="text-sm text-muted-foreground">
                    Notifications visibles dans le centre de notifications
                  </p>
                </div>
              </div>
              <Switch
                checked={preferences.in_app_enabled}
                onCheckedChange={(checked) => updatePreference('in_app_enabled', checked)}
              />
            </div>

            <Separator />

            {/* Email */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                    <Mail className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <Label className="font-medium">Notifications par email</Label>
                    <p className="text-sm text-muted-foreground">
                      Recevez les notifications par email
                    </p>
                  </div>
                </div>
                <Switch
                  checked={preferences.email_enabled}
                  onCheckedChange={(checked) => updatePreference('email_enabled', checked)}
                />
              </div>
              
              {preferences.email_enabled && (
                <div className="ml-14">
                  <Label className="text-sm">Email de notification</Label>
                  <Input
                    type="email"
                    placeholder="Laisser vide pour utiliser l'email principal"
                    value={preferences.notification_email || ''}
                    onChange={(e) => updatePreference('notification_email', e.target.value || null)}
                    className="mt-1 max-w-md"
                  />
                </div>
              )}
            </div>

            <Separator />

            {/* SMS */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                    <MessageSquare className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <Label className="font-medium">Notifications SMS</Label>
                    <p className="text-sm text-muted-foreground">
                      Pour les alertes urgentes uniquement
                    </p>
                  </div>
                </div>
                <Switch
                  checked={preferences.sms_enabled}
                  onCheckedChange={(checked) => updatePreference('sms_enabled', checked)}
                />
              </div>
              
              {preferences.sms_enabled && (
                <div className="ml-14">
                  <Label className="text-sm">Numéro de téléphone</Label>
                  <Input
                    type="tel"
                    placeholder="+33 6 12 34 56 78"
                    value={preferences.sms_phone || ''}
                    onChange={(e) => updatePreference('sms_phone', e.target.value || null)}
                    className="mt-1 max-w-md"
                  />
                </div>
              )}
            </div>

            <Separator />

            {/* Push */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
                  <Smartphone className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <Label className="font-medium">Notifications push</Label>
                  <p className="text-sm text-muted-foreground">
                    Notifications sur votre appareil
                  </p>
                </div>
              </div>
              <Switch
                checked={preferences.push_enabled}
                onCheckedChange={(checked) => updatePreference('push_enabled', checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Heures silencieuses */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Moon className="h-5 w-5" />
              Heures silencieuses
            </CardTitle>
            <CardDescription>
              Définissez une période pendant laquelle vous ne souhaitez pas être dérangé
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 max-w-md">
              <div>
                <Label className="text-sm">Début</Label>
                <Input
                  type="time"
                  value={preferences.quiet_hours_start || ''}
                  onChange={(e) => updatePreference('quiet_hours_start', e.target.value || null)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-sm">Fin</Label>
                <Input
                  type="time"
                  value={preferences.quiet_hours_end || ''}
                  onChange={(e) => updatePreference('quiet_hours_end', e.target.value || null)}
                  className="mt-1"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Les notifications urgentes seront toujours envoyées
            </p>
          </CardContent>
        </Card>

        {/* Mode résumé */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Fréquence des notifications
            </CardTitle>
            <CardDescription>
              Choisissez de recevoir les notifications instantanément ou en résumé
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 max-w-md">
              <div>
                <Label className="text-sm">Mode</Label>
                <Select
                  value={preferences.digest_mode}
                  onValueChange={(value: 'instant' | 'daily' | 'weekly') => 
                    updatePreference('digest_mode', value)
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(DIGEST_MODE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {preferences.digest_mode !== 'instant' && (
                <>
                  <div>
                    <Label className="text-sm">Heure d'envoi</Label>
                    <Input
                      type="time"
                      value={preferences.digest_time || '09:00'}
                      onChange={(e) => updatePreference('digest_time', e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  {preferences.digest_mode === 'weekly' && (
                    <div>
                      <Label className="text-sm">Jour d'envoi</Label>
                      <Select
                        value={String(preferences.digest_day ?? 1)}
                        onValueChange={(value) => updatePreference('digest_day', parseInt(value))}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">Dimanche</SelectItem>
                          <SelectItem value="1">Lundi</SelectItem>
                          <SelectItem value="2">Mardi</SelectItem>
                          <SelectItem value="3">Mercredi</SelectItem>
                          <SelectItem value="4">Jeudi</SelectItem>
                          <SelectItem value="5">Vendredi</SelectItem>
                          <SelectItem value="6">Samedi</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Types de notifications */}
        <Card>
          <CardHeader>
            <CardTitle>Types de notifications</CardTitle>
            <CardDescription>
              Activez ou désactivez des types spécifiques de notifications
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {NOTIFICATION_CATEGORIES.map((category) => {
              const categoryTemplates = templatesByCategory[category.value] || [];
              if (categoryTemplates.length === 0) return null;

              return (
                <div key={category.value}>
                  <h4 className="font-medium mb-3">{category.label}</h4>
                  <div className="space-y-3 ml-4">
                    {categoryTemplates.map((template) => {
                      const isDisabled = preferences.disabled_templates?.includes(template.code);
                      
                      return (
                        <div
                          key={template.code}
                          className="flex items-center justify-between py-2"
                        >
                          <div className="flex-1">
                            <Label className="font-normal">{template.name}</Label>
                            {template.description && (
                              <p className="text-xs text-muted-foreground">
                                {template.description}
                              </p>
                            )}
                            <div className="flex gap-1 mt-1">
                              {template.channels.map((channel) => (
                                <Badge key={channel} variant="outline" className="text-xs">
                                  {NOTIFICATION_CHANNEL_LABELS[channel as NotificationChannel]}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <Switch
                            checked={!isDisabled}
                            onCheckedChange={() => toggleTemplate(template.code)}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <Separator className="mt-4" />
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Bouton de sauvegarde fixe */}
        {hasChanges && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="fixed bottom-8 right-8"
          >
            <Button
              size="lg"
              onClick={savePreferences}
              disabled={isSaving}
              className="shadow-lg"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Enregistrer les modifications
            </Button>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
