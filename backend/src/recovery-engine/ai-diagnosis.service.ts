import { Injectable, Logger } from '@nestjs/common';
import { Diagnosis } from './types/recovery.types';

// This is the "AI reasons, code acts" boundary. This service's ONLY
// job is to classify a case and recommend an action — it never
// executes anything itself. If Groq is unreachable or returns garbage,
// we fall back to a conservative, deterministic default rather than
// guessing. That fallback path is one of our intentional demo failure
// cases (see PolicyEngineService rule 1 — FALLBACK diagnoses never
// requires anything more than the safest possible action).

@Injectable()
export class AiDiagnosisService {
  private readonly logger = new Logger(AiDiagnosisService.name);
  private readonly groqApiKey = process.env.GROQ_API_KEY;
  private readonly groqModel = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

  async diagnose(context: {
    caseType: 'PAYMENT_FAILURE' | 'B2B_RECEIVABLE';
    details: Record<string, any>;
  }): Promise<Diagnosis> {
    if (!this.groqApiKey) {
      this.logger.warn('GROQ_API_KEY not set — using fallback diagnosis.');
      return this.fallbackDiagnosis(context);
    }

    try {
      const prompt = this.buildPrompt(context);

      const response = await fetch(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.groqApiKey}`,
          },
          body: JSON.stringify({
            model: this.groqModel,
            messages: [
              {
                role: 'system',
                content:
                  'You are a revenue-recovery diagnosis engine. You ONLY classify situations and recommend an action from a fixed list — you never decide whether an action executes, and you never state a final amount to move. Respond with ONLY valid JSON, no prose, no markdown fences.',
              },
              { role: 'user', content: prompt },
            ],
            temperature: 0.2, // low temperature — we want consistent classification, not creativity
            max_tokens: 400,
          }),
          // Fail fast rather than hang the request pipeline
          signal: AbortSignal.timeout(10_000),
        },
      );

      if (!response.ok) {
        this.logger.error(`Groq API error: ${response.status} ${response.statusText}`);
        return this.fallbackDiagnosis(context);
      }

      const data = await response.json();
      const rawContent = data.choices?.[0]?.message?.content;
      if (!rawContent) {
        this.logger.error('Groq response missing content — using fallback.');
        return this.fallbackDiagnosis(context);
      }

      const parsed = this.parseAndValidate(rawContent);
      if (!parsed) {
        this.logger.error('Groq response failed validation — using fallback.');
        return this.fallbackDiagnosis(context);
      }

      return { ...parsed, decidedBy: 'AI' };
    } catch (err) {
      this.logger.error(`AI diagnosis failed: ${err.message} — using fallback.`);
      return this.fallbackDiagnosis(context);
    }
  }

  private buildPrompt(context: { caseType: string; details: Record<string, any> }): string {
    const validActions = [
      'RETRY_PAYMENT',
      'SEND_REMINDER',
      'SEND_ESCALATION',
      'REQUEST_COMMITMENT',
      'VERIFY_PAYMENT',
      'ESCALATE_TO_HUMAN',
    ];

    return `Case type: ${context.caseType}
Details: ${JSON.stringify(context.details, null, 2)}

Classify this case and recommend exactly one action from this list: ${validActions.join(', ')}.

Respond with ONLY this JSON shape, nothing else:
{
  "classification": "<short label for what's happening>",
  "recommendedAction": "<one of the exact action strings above>",
  "reasoning": "<1-2 sentences explaining why>",
  "confidence": <number between 0 and 1>
}`;
  }

  private parseAndValidate(raw: string): Omit<Diagnosis, 'decidedBy'> | null {
    const validActions = new Set([
      'RETRY_PAYMENT',
      'SEND_REMINDER',
      'SEND_ESCALATION',
      'REQUEST_COMMITMENT',
      'VERIFY_PAYMENT',
      'ESCALATE_TO_HUMAN',
    ]);

    try {
      // Strip markdown fences if the model added them despite instructions
      const cleaned = raw.replace(/```json\n?|```\n?/g, '').trim();
      const obj = JSON.parse(cleaned);

      if (
        typeof obj.classification === 'string' &&
        validActions.has(obj.recommendedAction) &&
        typeof obj.reasoning === 'string' &&
        typeof obj.confidence === 'number'
      ) {
        return obj;
      }
      return null;
    } catch {
      return null;
    }
  }

  private fallbackDiagnosis(context: {
    caseType: string;
    details: Record<string, any>;
  }): Diagnosis {
    // Conservative, deterministic default: never retry money movement
    // blindly when AI is unavailable — just flag it for a human.
    return {
      classification: 'AI_UNAVAILABLE',
      recommendedAction: 'NO_ACTION_AI_UNAVAILABLE',
      reasoning:
        'AI diagnosis unavailable or invalid — deferring to safe fallback rather than guessing. Flagged for human review.',
      confidence: 0,
      decidedBy: 'FALLBACK',
    };
  }
}
