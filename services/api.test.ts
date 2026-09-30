import { describe, it, expect, afterEach, vi } from 'vitest';
import { api } from './api';
import type { QuestionnaireAnswers } from '../types';

const answers = { age: 28 } as unknown as QuestionnaireAnswers;
const respond = (status: number, body: unknown) =>
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })));

afterEach(() => vi.unstubAllGlobals());

describe('saving the questionnaire', () => {
  it('reports success, and whether a plan was generated', async () => {
    respond(200, { assignedPlan: true });
    expect(await api.saveQuestionnaire(answers)).toEqual({ ok: true, assignedPlan: true });
    respond(200, { assignedPlan: false });
    expect(await api.saveQuestionnaire(answers)).toEqual({ ok: true, assignedPlan: false });
  });

  it('is a saved questionnaire even when no plan could be generated', async () => {
    // Generation failing is an admin\'s problem, not a failed save.
    respond(200, { assignedPlan: false });
    expect((await api.saveQuestionnaire(answers)).ok).toBe(true);
  });

  it('reports a refusal with the server\'s own reason', async () => {
    respond(400, { error: 'Days per week must be between 1 and 7.' });
    expect(await api.saveQuestionnaire(answers)).toEqual({
      ok: false, assignedPlan: false, error: 'Days per week must be between 1 and 7.',
    });
  });

  it('reports rate limiting and server errors as failures, not as saved', async () => {
    respond(429, { error: 'Too many requests.' });
    expect((await api.saveQuestionnaire(answers)).ok).toBe(false);
    respond(500, {});
    const r = await api.saveQuestionnaire(answers);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/500/);
  });

  it('reports an unreachable server as a failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('Failed to fetch'); }));
    expect(await api.saveQuestionnaire(answers)).toEqual({ ok: false, assignedPlan: false, error: 'Failed to fetch' });
  });
});
