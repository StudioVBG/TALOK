# Edge Functions - Guide d'implémentation

## Déploiement

### Prérequis
```bash
npm install -g supabase
supabase login
```

### Déployer les fonctions

```bash
# OCR/IDP
supabase functions deploy analyze-documents

# Génération PDF
supabase functions deploy generate-pdf
```

## Configuration

### Variables d'environnement

Dans le dashboard Supabase, ajouter les variables suivantes pour chaque fonction :

#### analyze-documents
- `GOOGLE_VISION_API_KEY` (optionnel, pour Google Vision)
- `AWS_ACCESS_KEY_ID` (optionnel, pour AWS Textract)
- `AWS_SECRET_ACCESS_KEY` (optionnel, pour AWS Textract)

#### generate-pdf
- `PDF_SERVICE_URL` (optionnel, pour service externe)
- `PDF_SERVICE_API_KEY` (optionnel)

## Intégration avec les routes API

Les routes API appellent les Edge Functions via :

```typescript
const { data, error } = await supabase.functions.invoke('analyze-documents', {
  body: { application_id, files }
});

const { data, error } = await supabase.functions.invoke('generate-pdf', {
  body: { type: 'lease', data: { ... } }
});
```

## TODO

- [ ] Intégrer Google Vision API pour OCR
- [ ] Intégrer AWS Textract pour IDP
- [ ] Intégrer Puppeteer ou PDFKit pour génération PDF
- [ ] Ajouter gestion d'erreurs robuste
- [ ] Ajouter retry logic
- [ ] Ajouter logging structuré





