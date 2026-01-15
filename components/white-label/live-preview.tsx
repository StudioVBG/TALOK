"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Monitor,
  Tablet,
  Smartphone,
  RotateCcw,
  ExternalLink,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { OrganizationBranding, DEFAULT_BRANDING } from "@/lib/white-label/types";

type DeviceSize = "desktop" | "tablet" | "mobile";

interface LivePreviewProps {
  branding: Partial<OrganizationBranding>;
  className?: string;
}

const DEVICE_SIZES: Record<DeviceSize, { width: number; height: number; label: string }> = {
  desktop: { width: 1280, height: 800, label: "Desktop" },
  tablet: { width: 768, height: 1024, label: "Tablet" },
  mobile: { width: 375, height: 667, label: "Mobile" },
};

/**
 * Génère le CSS personnalisé basé sur le branding
 */
function generateCustomCSS(branding: Partial<OrganizationBranding>): string {
  const primary = branding.primary_color || DEFAULT_BRANDING.primary_color;
  const secondary = branding.secondary_color || DEFAULT_BRANDING.secondary_color;
  const accent = branding.accent_color || DEFAULT_BRANDING.accent_color;

  // Convertir hex en HSL pour les variables CSS
  const hexToHSL = (hex: string): string => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }

    return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
  };

  return `
    :root {
      --primary: ${hexToHSL(primary!)};
      --secondary: ${hexToHSL(secondary!)};
      --accent: ${hexToHSL(accent!)};
    }
    ${branding.custom_css || ""}
  `;
}

/**
 * Génère le HTML de prévisualisation
 */
function generatePreviewHTML(branding: Partial<OrganizationBranding>): string {
  const companyName = branding.company_name || "Mon Entreprise";
  const tagline = branding.tagline || "Gestion locative simplifiée";
  const logoUrl = branding.logo_url;
  const primaryColor = branding.primary_color || DEFAULT_BRANDING.primary_color;
  const secondaryColor = branding.secondary_color || DEFAULT_BRANDING.secondary_color;
  const accentColor = branding.accent_color || DEFAULT_BRANDING.accent_color;
  const removePoweredBy = branding.remove_powered_by || false;

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${companyName}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: #f8fafc;
      min-height: 100vh;
    }

    /* Header */
    .header {
      background: white;
      border-bottom: 1px solid #e2e8f0;
      padding: 16px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .logo-area {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .logo-area img {
      height: 40px;
      width: auto;
    }
    .logo-text {
      font-size: 20px;
      font-weight: 700;
      color: ${primaryColor};
    }
    .nav {
      display: flex;
      gap: 24px;
    }
    .nav a {
      color: #64748b;
      text-decoration: none;
      font-size: 14px;
      font-weight: 500;
    }
    .nav a:hover {
      color: ${primaryColor};
    }
    .user-menu {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: ${primaryColor};
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 14px;
    }

    /* Main */
    .main {
      padding: 32px;
      max-width: 1200px;
      margin: 0 auto;
    }
    .page-title {
      font-size: 28px;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 8px;
    }
    .page-subtitle {
      color: #64748b;
      margin-bottom: 32px;
    }

    /* Stats */
    .stats {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 32px;
    }
    .stat-card {
      background: white;
      border-radius: 12px;
      padding: 20px;
      border: 1px solid #e2e8f0;
    }
    .stat-value {
      font-size: 28px;
      font-weight: 700;
      color: #0f172a;
    }
    .stat-label {
      font-size: 13px;
      color: #64748b;
      margin-top: 4px;
    }
    .stat-card.primary {
      background: ${primaryColor};
      border-color: ${primaryColor};
    }
    .stat-card.primary .stat-value,
    .stat-card.primary .stat-label {
      color: white;
    }

    /* Cards */
    .content-grid {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 24px;
    }
    .card {
      background: white;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      overflow: hidden;
    }
    .card-header {
      padding: 16px 20px;
      border-bottom: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .card-title {
      font-weight: 600;
      color: #0f172a;
    }
    .card-content {
      padding: 20px;
    }

    /* Table */
    .table {
      width: 100%;
    }
    .table th {
      text-align: left;
      padding: 12px 0;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #64748b;
      border-bottom: 1px solid #e2e8f0;
    }
    .table td {
      padding: 16px 0;
      border-bottom: 1px solid #f1f5f9;
    }
    .table tr:last-child td {
      border-bottom: none;
    }

    /* Badges */
    .badge {
      display: inline-flex;
      align-items: center;
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 500;
    }
    .badge.success {
      background: #dcfce7;
      color: #16a34a;
    }
    .badge.warning {
      background: #fef3c7;
      color: #d97706;
    }
    .badge.primary {
      background: ${primaryColor}20;
      color: ${primaryColor};
    }

    /* Buttons */
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 10px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      border: none;
      transition: all 0.15s;
    }
    .btn-primary {
      background: ${primaryColor};
      color: white;
    }
    .btn-primary:hover {
      opacity: 0.9;
    }
    .btn-secondary {
      background: white;
      color: #374151;
      border: 1px solid #e2e8f0;
    }

    /* Activity */
    .activity-item {
      display: flex;
      gap: 12px;
      padding: 12px 0;
    }
    .activity-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: ${primaryColor};
      margin-top: 6px;
    }
    .activity-content {
      flex: 1;
    }
    .activity-text {
      font-size: 14px;
      color: #374151;
    }
    .activity-time {
      font-size: 12px;
      color: #94a3b8;
      margin-top: 2px;
    }

    /* Footer */
    .footer {
      text-align: center;
      padding: 24px;
      color: #94a3b8;
      font-size: 12px;
    }
    .footer a {
      color: ${primaryColor};
      text-decoration: none;
    }

    /* Sidebar */
    .sidebar {
      width: 240px;
      background: white;
      border-right: 1px solid #e2e8f0;
      height: 100vh;
      position: fixed;
      left: 0;
      top: 0;
    }
    .sidebar-logo {
      padding: 20px;
      border-bottom: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .sidebar-logo img {
      height: 32px;
    }
    .sidebar-nav {
      padding: 16px 12px;
    }
    .sidebar-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
      border-radius: 8px;
      color: #64748b;
      font-size: 14px;
      font-weight: 500;
      margin-bottom: 4px;
      cursor: pointer;
    }
    .sidebar-item:hover {
      background: #f1f5f9;
    }
    .sidebar-item.active {
      background: ${primaryColor}15;
      color: ${primaryColor};
    }

    @media (max-width: 768px) {
      .stats { grid-template-columns: repeat(2, 1fr); }
      .content-grid { grid-template-columns: 1fr; }
      .nav { display: none; }
    }
    @media (max-width: 480px) {
      .stats { grid-template-columns: 1fr; }
      .main { padding: 16px; }
    }
  </style>
</head>
<body>
  <header class="header">
    <div class="logo-area">
      ${logoUrl
        ? `<img src="${logoUrl}" alt="${companyName}" />`
        : `<span class="logo-text">🏠 ${companyName}</span>`
      }
    </div>
    <nav class="nav">
      <a href="#">Tableau de bord</a>
      <a href="#">Biens</a>
      <a href="#">Locataires</a>
      <a href="#">Finances</a>
    </nav>
    <div class="user-menu">
      <div class="avatar">JD</div>
    </div>
  </header>

  <main class="main">
    <h1 class="page-title">Tableau de bord</h1>
    <p class="page-subtitle">${tagline}</p>

    <div class="stats">
      <div class="stat-card primary">
        <div class="stat-value">12</div>
        <div class="stat-label">Biens gérés</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">8</div>
        <div class="stat-label">Locataires actifs</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">4 850 €</div>
        <div class="stat-label">Loyers ce mois</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">98%</div>
        <div class="stat-label">Taux d'occupation</div>
      </div>
    </div>

    <div class="content-grid">
      <div class="card">
        <div class="card-header">
          <span class="card-title">Derniers paiements</span>
          <button class="btn btn-secondary">Voir tout</button>
        </div>
        <div class="card-content">
          <table class="table">
            <thead>
              <tr>
                <th>Locataire</th>
                <th>Bien</th>
                <th>Montant</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Marie Martin</td>
                <td>Apt. 12 rue de Paris</td>
                <td>850 €</td>
                <td><span class="badge success">Payé</span></td>
              </tr>
              <tr>
                <td>Pierre Durand</td>
                <td>Studio Belleville</td>
                <td>620 €</td>
                <td><span class="badge success">Payé</span></td>
              </tr>
              <tr>
                <td>Sophie Lambert</td>
                <td>T3 République</td>
                <td>1 100 €</td>
                <td><span class="badge warning">En attente</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <span class="card-title">Activité récente</span>
        </div>
        <div class="card-content">
          <div class="activity-item">
            <div class="activity-dot"></div>
            <div class="activity-content">
              <div class="activity-text">Nouveau paiement reçu</div>
              <div class="activity-time">Il y a 2 heures</div>
            </div>
          </div>
          <div class="activity-item">
            <div class="activity-dot"></div>
            <div class="activity-content">
              <div class="activity-text">Bail signé - T2 Bastille</div>
              <div class="activity-time">Il y a 5 heures</div>
            </div>
          </div>
          <div class="activity-item">
            <div class="activity-dot"></div>
            <div class="activity-content">
              <div class="activity-text">Ticket résolu #127</div>
              <div class="activity-time">Hier</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>

  <footer class="footer">
    ${removePoweredBy
      ? `© ${new Date().getFullYear()} ${companyName}. Tous droits réservés.`
      : `© ${new Date().getFullYear()} ${companyName} · Propulsé par <a href="https://talok.fr">Talok</a>`
    }
  </footer>
</body>
</html>
  `;
}

export function LivePreview({ branding, className }: LivePreviewProps) {
  const [device, setDevice] = useState<DeviceSize>("desktop");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [key, setKey] = useState(0); // Pour forcer le refresh

  const currentDevice = DEVICE_SIZES[device];
  const previewHTML = generatePreviewHTML(branding);

  const handleRefresh = () => {
    setKey((prev) => prev + 1);
  };

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between p-3 bg-slate-100 border-b border-slate-200 rounded-t-xl">
        <div className="flex items-center gap-2">
          {(["desktop", "tablet", "mobile"] as DeviceSize[]).map((d) => (
            <Button
              key={d}
              variant={device === d ? "default" : "ghost"}
              size="sm"
              onClick={() => setDevice(d)}
              className="h-8"
            >
              {d === "desktop" && <Monitor className="w-4 h-4" />}
              {d === "tablet" && <Tablet className="w-4 h-4" />}
              {d === "mobile" && <Smartphone className="w-4 h-4" />}
            </Button>
          ))}
        </div>

        <Badge variant="secondary" className="text-xs">
          {currentDevice.width} × {currentDevice.height}
        </Badge>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleRefresh} className="h-8">
            <RotateCcw className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="h-8"
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const blob = new Blob([previewHTML], { type: "text/html" });
              const url = URL.createObjectURL(blob);
              window.open(url, "_blank");
            }}
            className="h-8"
          >
            <ExternalLink className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Preview Frame */}
      <div
        className={cn(
          "flex-1 bg-slate-200 overflow-auto flex items-start justify-center p-4",
          isFullscreen && "fixed inset-0 z-50"
        )}
      >
        <motion.div
          layout
          transition={{ duration: 0.3 }}
          className="bg-white rounded-lg shadow-2xl overflow-hidden"
          style={{
            width: device === "desktop" ? "100%" : currentDevice.width,
            maxWidth: currentDevice.width,
            height: isFullscreen ? "calc(100vh - 100px)" : 500,
          }}
        >
          <iframe
            key={key}
            srcDoc={previewHTML}
            className="w-full h-full border-0"
            title="Prévisualisation"
            sandbox="allow-same-origin"
          />
        </motion.div>
      </div>

      {/* Info bar */}
      <div className="flex items-center justify-between p-2 bg-slate-50 border-t border-slate-200 rounded-b-xl text-xs text-slate-500">
        <span>Prévisualisation en temps réel</span>
        <span>
          {branding.company_name || "Mon Entreprise"} · {device}
        </span>
      </div>
    </div>
  );
}

export default LivePreview;
