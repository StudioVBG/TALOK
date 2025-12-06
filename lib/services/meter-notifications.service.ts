/**
 * Service de notifications pour les compteurs
 * 
 * Gère l'envoi des notifications liées aux relevés de compteurs:
 * - Rappels mensuels
 * - Notification lors d'un EDL programmé
 * - Notification quand un relevé est soumis
 */

import { createClient } from "@/lib/supabase/server";

// ============================================
// TYPES
// ============================================

interface NotificationData {
  user_id: string;
  type: string;
  title: string;
  message: string;
  property_id?: string;
  lease_id?: string;
  action_url?: string;
  priority?: "low" | "normal" | "high" | "urgent";
  metadata?: Record<string, any>;
}

// ============================================
// SERVICE
// ============================================

class MeterNotificationsService {
  /**
   * Créer une notification
   */
  async createNotification(data: NotificationData): Promise<string | null> {
    const supabase = await createClient();
    
    try {
      // Récupérer le profile_id
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", data.user_id)
        .single();
      
      // Essayer d'abord user_notifications (nouvelle table)
      const { data: notification, error } = await supabase
        .from("user_notifications")
        .insert({
          user_id: data.user_id,
          profile_id: (profile as any)?.id,
          type: data.type,
          title: data.title,
          message: data.message,
          property_id: data.property_id,
          lease_id: data.lease_id,
          action_url: data.action_url,
          priority: data.priority || "normal",
          metadata: data.metadata || {},
          channels: ["in_app"],
        })
        .select("id")
        .single();

      if (error) {
        // Si erreur (table n'existe pas), essayer l'ancienne table
        const { data: oldNotif, error: oldError } = await supabase
          .from("notifications")
          .insert({
            user_id: data.user_id,
            type: data.type,
            title: data.title,
            message: data.message,
            metadata: {
              ...data.metadata,
              property_id: data.property_id,
              lease_id: data.lease_id,
              action_url: data.action_url,
            },
          })
          .select("id")
          .single();

        if (oldError) throw oldError;
        return (oldNotif as any)?.id;
      }

      return (notification as any)?.id;
    } catch (error) {
      console.error("[MeterNotifications] Error creating notification:", error);
      return null;
    }
  }

  /**
   * Notifier le locataire qu'un relevé est requis (EDL programmé)
   */
  async notifyMeterReadingRequired(
    tenantUserId: string,
    propertyAddress: string,
    edlType: "entree" | "sortie",
    edlId: string,
    leaseId: string,
    propertyId: string,
    scheduledDate?: string
  ): Promise<void> {
    const typeLabel = edlType === "entree" ? "d'entrée" : "de sortie";
    const dateStr = scheduledDate 
      ? ` prévu le ${new Date(scheduledDate).toLocaleDateString("fr-FR")}`
      : "";

    await this.createNotification({
      user_id: tenantUserId,
      type: "meter_reading_required",
      title: `Relevés de compteurs requis`,
      message: `L'état des lieux ${typeLabel}${dateStr} pour ${propertyAddress} nécessite vos relevés de compteurs. Veuillez les effectuer dès que possible.`,
      property_id: propertyId,
      lease_id: leaseId,
      action_url: "/app/tenant/meters",
      priority: "high",
      metadata: {
        edl_id: edlId,
        edl_type: edlType,
        scheduled_date: scheduledDate,
      },
    });
  }

  /**
   * Envoyer un rappel mensuel de relevé
   */
  async sendMonthlyReminder(
    tenantUserId: string,
    propertyAddress: string,
    propertyId: string,
    leaseId: string
  ): Promise<void> {
    await this.createNotification({
      user_id: tenantUserId,
      type: "meter_reading_reminder",
      title: "Rappel : Relevé de compteurs",
      message: `N'oubliez pas d'effectuer vos relevés de compteurs mensuels pour ${propertyAddress}.`,
      property_id: propertyId,
      lease_id: leaseId,
      action_url: "/app/tenant/meters",
      priority: "normal",
      metadata: {
        reminder_type: "monthly",
      },
    });
  }

  /**
   * Notifier le propriétaire qu'un relevé a été soumis
   */
  async notifyReadingSubmitted(
    ownerUserId: string,
    meterType: string,
    readingValue: number,
    unit: string,
    propertyAddress: string,
    propertyId: string,
    edlId?: string
  ): Promise<void> {
    const meterLabels: Record<string, string> = {
      electricity: "Électricité",
      gas: "Gaz",
      water: "Eau",
      heating: "Chauffage",
    };

    await this.createNotification({
      user_id: ownerUserId,
      type: "meter_reading_submitted",
      title: "Nouveau relevé de compteur",
      message: `Un relevé de compteur ${meterLabels[meterType] || meterType} (${readingValue.toLocaleString("fr-FR")} ${unit}) a été soumis pour ${propertyAddress}.`,
      property_id: propertyId,
      action_url: edlId ? `/app/owner/inspections/${edlId}` : `/app/owner/properties/${propertyId}`,
      priority: "normal",
      metadata: {
        meter_type: meterType,
        reading_value: readingValue,
        unit,
        edl_id: edlId,
      },
    });
  }

  /**
   * Notifier d'une anomalie détectée sur un relevé
   */
  async notifyAnomalyDetected(
    ownerUserId: string,
    meterType: string,
    currentValue: number,
    previousValue: number,
    unit: string,
    propertyAddress: string,
    propertyId: string
  ): Promise<void> {
    const difference = currentValue - previousValue;
    const percentChange = previousValue > 0 
      ? ((difference / previousValue) * 100).toFixed(1) 
      : "N/A";

    await this.createNotification({
      user_id: ownerUserId,
      type: "meter_anomaly_detected",
      title: "⚠️ Anomalie de consommation détectée",
      message: `Une variation importante (+${percentChange}%) a été détectée sur le compteur ${meterType} de ${propertyAddress}. Valeur actuelle: ${currentValue} ${unit}, précédente: ${previousValue} ${unit}.`,
      property_id: propertyId,
      action_url: `/app/owner/properties/${propertyId}`,
      priority: "high",
      metadata: {
        meter_type: meterType,
        current_value: currentValue,
        previous_value: previousValue,
        difference,
        percent_change: percentChange,
      },
    });
  }

  /**
   * Envoyer des rappels mensuels à tous les locataires
   * (À appeler via un cron job)
   */
  async sendAllMonthlyReminders(): Promise<number> {
    const supabase = await createClient();
    let count = 0;

    try {
      // Trouver tous les baux actifs avec des compteurs
      const { data: activeTenants, error } = await supabase
        .from("lease_signers")
        .select(`
          profile_id,
          profiles!inner(user_id),
          lease:leases!inner(
            id,
            property_id,
            statut,
            property:properties!inner(
              id,
              adresse_complete,
              ville
            )
          )
        `)
        .eq("lease.statut", "active")
        .in("role", ["locataire_principal", "colocataire"]);

      if (error) throw error;

      // Pour chaque locataire, vérifier s'il a des compteurs sans relevé ce mois
      for (const tenant of (activeTenants || [])) {
        const tenantData = tenant as any;
        const propertyId = tenantData.lease?.property_id;
        const userId = tenantData.profiles?.user_id;
        
        if (!propertyId || !userId) continue;

        // Vérifier s'il y a des compteurs
        const { data: meters } = await supabase
          .from("meters")
          .select("id")
          .eq("property_id", propertyId)
          .eq("is_active", true);

        if (!meters || meters.length === 0) continue;

        // Vérifier s'il y a déjà un relevé ce mois
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const { data: recentReadings } = await supabase
          .from("meter_readings")
          .select("id")
          .in("meter_id", meters.map(m => (m as any).id))
          .gte("reading_date", startOfMonth.toISOString().split("T")[0])
          .limit(1);

        if (recentReadings && recentReadings.length > 0) continue;

        // Vérifier qu'on n'a pas déjà envoyé un rappel cette semaine
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        const { data: recentNotifs } = await supabase
          .from("notifications")
          .select("id")
          .eq("user_id", userId)
          .eq("type", "meter_reading_reminder")
          .gte("created_at", oneWeekAgo.toISOString())
          .limit(1);

        if (recentNotifs && recentNotifs.length > 0) continue;

        // Envoyer le rappel
        const propertyAddress = `${tenantData.lease?.property?.adresse_complete || ""}, ${tenantData.lease?.property?.ville || ""}`;
        
        await this.sendMonthlyReminder(
          userId,
          propertyAddress,
          propertyId,
          tenantData.lease?.id
        );

        count++;
      }

      console.log(`[MeterNotifications] Sent ${count} monthly reminders`);
      return count;

    } catch (error) {
      console.error("[MeterNotifications] Error sending monthly reminders:", error);
      return count;
    }
  }
}

// Export singleton
export const meterNotificationsService = new MeterNotificationsService();

// Export classe pour tests
export { MeterNotificationsService };

