/**
 * @deprecated This service is deprecated. Use the more complete meter OCR service from '@/lib/ocr/meter.service'.
 *
 * This file is maintained for backward compatibility with existing imports.
 *
 * Migration guide:
 * - For meter photo analysis: import { meterOCRService } from '@/lib/ocr/meter.service'
 * - For CNI/ID card extraction: import { extractCNIData } from '@/lib/services/ocr-service'
 *
 * @see {@link @/lib/ocr/meter.service} for advanced meter OCR with image preprocessing
 * @see {@link @/lib/services/ocr-service} for CNI/identity document extraction
 */

import { meterOCRService, MeterOCRService, type MeterOCRResult } from '@/lib/ocr/meter.service';

/**
 * @deprecated Use MeterOCRService from '@/lib/ocr/meter.service' instead.
 * This class is a backward-compatible wrapper around the new meter OCR service.
 */
export class OCRService {
  /**
   * @deprecated Use meterOCRService.analyzeMeterPhoto() from '@/lib/ocr/meter.service' instead.
   * Analyzes a meter photo to extract the numeric reading.
   *
   * @param imageBuffer - The image buffer to analyze
   * @returns Object with value and confidence
   */
  async analyzeMeterPhoto(imageBuffer: Buffer): Promise<{ value: number; confidence: number }> {
    const result = await meterOCRService.analyzeMeterPhoto(imageBuffer, 'electricity');
    return {
      value: result.value ?? 0,
      confidence: result.confidence,
    };
  }
}

/**
 * @deprecated Use meterOCRService from '@/lib/ocr/meter.service' instead.
 * This instance is maintained for backward compatibility.
 */
export const ocrService = new OCRService();

// Re-export types and services from the canonical location for convenience
export { meterOCRService, MeterOCRService, type MeterOCRResult };
