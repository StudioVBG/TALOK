// Helpers pour le formatage

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  if (!date) return "";
  
  // ✅ FIX SOTA 2026: Gère les dates ISO complètes (ex: "1992-04-04T00:00:00.000Z")
  // Extrait YYYY-MM-DD et force à midi pour éviter les décalages de fuseau horaire
  let d: Date;
  if (typeof date === "string") {
    const dateOnly = date.substring(0, 10);
    if (dateOnly.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [year, month, day] = dateOnly.split("-").map(Number);
      d = new Date(year, month - 1, day, 12, 0, 0);
    } else {
      d = new Date(date);
    }
  } else {
    d = date;
  }

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(d);
}

export function formatDateShort(date: string | Date): string {
  if (!date) return "";

  // ✅ FIX SOTA 2026: Gère les dates ISO complètes
  let d: Date;
  if (typeof date === "string") {
    const dateOnly = date.substring(0, 10);
    if (dateOnly.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [year, month, day] = dateOnly.split("-").map(Number);
      d = new Date(year, month - 1, day, 12, 0, 0);
    } else {
      d = new Date(date);
    }
  } else {
    d = date;
  }

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

export function formatPeriod(period: string): string {
  // Format "YYYY-MM" -> "MM/YYYY"
  const [year, month] = period.split("-");
  return `${month}/${year}`;
}

export function formatPhoneNumber(phone: string): string {
  // Format "0612345678" -> "06 12 34 56 78"
  return phone.replace(/(\d{2})(?=\d)/g, "$1 ");
}

export function formatFullName(prenom: string | null, nom: string | null): string {
  if (!prenom && !nom) return "Utilisateur";
  return [prenom, nom].filter(Boolean).join(" ");
}

export function buildAvatarUrl(avatarPath: string | null | undefined): string | null {
  if (!avatarPath) return null;
  if (/^https?:\/\//i.test(avatarPath)) {
    return avatarPath;
  }
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!baseUrl) return null;
  return `${baseUrl}/storage/v1/object/public/avatars/${avatarPath}`;
}

/**
 * Convertit un nombre en lettres (version simplifiée pour les montants)
 * Supporte jusqu'à 999 999
 */
export function numberToWords(n: number): string {
  if (n === 0) return "zéro";
  
  const units = ["", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf"];
  const teens = ["dix", "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf"];
  const tens = ["", "dix", "vingt", "trente", "quarante", "cinquante", "soixante", "soixante-dix", "quatre-vingt", "quatre-vingt-dix"];
  
  const convertGroup = (num: number): string => {
    let str = "";
    
    // Centaines
    if (num >= 100) {
      const hundred = Math.floor(num / 100);
      if (hundred === 1) str += "cent ";
      else str += units[hundred] + " cents ";
      num %= 100;
    }
    
    // Dizaines et Unités
    if (num > 0) {
      if (num < 10) {
        str += units[num];
      } else if (num < 20) {
        str += teens[num - 10];
      } else {
        const ten = Math.floor(num / 10);
        const unit = num % 10;
        
        // Gestion des 70, 90
        if (ten === 7 || ten === 9) {
          str += tens[ten - 1]; // soixante ou quatre-vingt
          if (ten === 7 && unit === 1) str += "-et-onze";
          else if (unit === 0) str += "-dix";
          else str += "-" + teens[unit]; // onze, douze...
        } else {
          str += tens[ten];
          if (unit === 1 && ten < 8) str += "-et-un";
          else if (unit > 0) str += "-" + units[unit];
        }
      }
    }
    return str.trim();
  };

  const integerPart = Math.floor(n);
  const decimalPart = Math.round((n - integerPart) * 100);
  
  let result = "";
  
  // Milliers
  if (integerPart >= 1000) {
    const thousand = Math.floor(integerPart / 1000);
    if (thousand === 1) result += "mille ";
    else result += convertGroup(thousand) + " mille ";
  }
  
  // Reste
  const rest = integerPart % 1000;
  if (rest > 0) {
    result += convertGroup(rest);
  } else if (integerPart === 0) {
    result += "zéro";
  }
  
  result = result.trim() + " euros";
  
  // Centimes
  if (decimalPart > 0) {
    result += " et " + convertGroup(decimalPart) + " centimes";
  }
  
  return result;
}
