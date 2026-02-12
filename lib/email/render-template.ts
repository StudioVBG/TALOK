/**
 * Moteur de rendu pour les templates email stockés en base.
 *
 * Supporte :
 * - Variables simples : {{variable}}
 * - Blocs conditionnels : {{#if condition}}...{{/if}}
 */

/**
 * Remplace les variables {{key}} dans un template.
 * Les variables non fournies sont conservées telles quelles.
 */
export function renderTemplate(
  template: string,
  variables: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] ?? match;
  });
}

/**
 * Rendu avec blocs conditionnels {{#if key}}...{{/if}} puis variables.
 */
export function renderWithConditions(
  template: string,
  variables: Record<string, string>,
  conditions: Record<string, boolean>
): string {
  // Résout les blocs conditionnels
  let result = template.replace(
    /\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (_, key, content) => (conditions[key] ? content : "")
  );
  // Puis les variables
  return renderTemplate(result, variables);
}

/**
 * Rendu complet d'un template email (sujet + corps HTML + corps texte).
 */
export function renderEmailTemplate(
  template: { subject: string; body_html: string; body_text: string },
  variables: Record<string, string>,
  conditions?: Record<string, boolean>
): { subject: string; html: string; text: string } {
  const render = conditions
    ? (t: string) => renderWithConditions(t, variables, conditions)
    : (t: string) => renderTemplate(t, variables);

  return {
    subject: render(template.subject),
    html: render(template.body_html),
    text: render(template.body_text),
  };
}
