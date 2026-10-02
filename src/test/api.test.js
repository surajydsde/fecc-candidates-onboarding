// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import request from 'supertest';
import { checkPasscode, issueToken, verifyToken, tokenFromHeader } from '../../server/auth.js';
import { rateLimit, __resetRateLimitsForTests } from '../../server/rateLimit.js';
import { parseSheet, parseCsv, safeFileName } from '../../server/excel.js';
import { __resetUploadStoreForTests } from '../../server/uploadStore.js';

const generateContent = vi.fn();
vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    constructor() {
      this.models = { generateContent };
    }
  },
}));

const { default: app, buildSystemInstruction, classifyGeminiError, NO_DATA_REPLY, CHAT_BUDGET_MS, MAX_TOOL_ROUNDS } = await import('../../api/index.js');

const SAMPLE = fs.readFileSync('public/sample/fecc-candidates-sample.xlsx');

describe('sample sheet and parsing', () => {
  it('parses the bundled sample Excel', async () => {
    const r = await parseSheet(SAMPLE, 'fecc-candidates-sample.xlsx');
    expect(r.sheetName).toBe('Candidates');
    expect(r.candidates).toHaveLength(25);
    expect(r.warnings).toEqual([]);
    expect(r.candidates[0]).toMatchObject({ candidateId: 'FECC-1001', name: 'Aarav Sharma', released: true, stage: 'released' });
    expect(r.candidates[0].joiningDate).toMatch(/^2026-08-\d\d$/);
  });

  it('parses CSV with quotes and a BOM', async () => {
    expect(parseCsv('\uFEFFa,"b, c","d ""q"""\r\n1,2,3')).toEqual([
      ['a', 'b, c', 'd "q"'],
      ['1', '2', '3'],
    ]);
    const csv = Buffer.from('Name,Pre-Onboarding,Post-Onboarding\nAsha,Yes,No\n');
    const r = await parseSheet(csv, 'list.csv');
    expect(r.candidates[0]).toMatchObject({ name: 'Asha', preOnboarding: true, postOnboarding: false, stage: 'postPending' });
  });

  it('rejects unsupported or broken files with readable messages', async () => {
    await expect(parseSheet(Buffer.from('x'), 'list.xls')).rejects.toThrow(/save as .xlsx/);
    await expect(parseSheet(Buffer.from('x'), 'list.pdf')).rejects.toThrow(/Excel/);
    await expect(parseSheet(Buffer.from('not a zip'), 'list.xlsx')).rejects.toThrow(/couldn't be read/);
    await expect(parseSheet(Buffer.alloc(0), 'list.xlsx')).rejects.toThrow(/empty/);
  });

  it('sanitizes file names', () => {
    expect(safeFileName('../../etc/pass"wd.xlsx')).toBe('pass_wd.xlsx');
    expect(safeFileName('C:\\Users\\me\\Q3 list.xlsx')).toBe('Q3 list.xlsx');
  });
});

describe('owner auth and rate limit', () => {
  beforeEach(() => vi.stubEnv('OWNER_PASSCODE', 'correct horse'));
  afterEach(() => vi.unstubAllEnvs());

  it('checks the passcode and issues expiring tokens', () => {
    expect(checkPasscode('correct horse')).toBe(true);
    expect(checkPasscode('wrong')).toBe(false);
    const { token, expiresAt } = issueToken(1000);
    expect(verifyToken(token, 2000)).toBe(true);
    expect(verifyToken(token, expiresAt + 1)).toBe(false);
    expect(verifyToken(`${token}x`, 2000)).toBe(false);
    expect(tokenFromHeader('Bearer abc')).toBe('abc');
  });

  it('limits requests per window', () => {
    __resetRateLimitsForTests();
    expect(rateLimit('k', 2, 1000, 0).ok).toBe(true);
    expect(rateLimit('k', 2, 1000, 1).ok).toBe(true);
    expect(rateLimit('k', 2, 1000, 2).ok).toBe(false);
    expect(rateLimit('k', 2, 1000, 1001).ok).toBe(true);
  });
});

describe('API', () => {
  let token;

  beforeEach(() => {
    vi.stubEnv('OWNER_PASSCODE', 'secret-pass');
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', '');
    vi.stubEnv('VERCEL', '');
    __resetUploadStoreForTests();
    __resetRateLimitsForTests();
    generateContent.mockReset();
    token = issueToken().token;
  });
  afterEach(() => vi.unstubAllEnvs());

  const upload = (name = 'fecc-candidates-sample.xlsx', body = SAMPLE, auth = token) => {
    const req = request(app).post('/api/uploads');
    if (auth) req.set('Authorization', `Bearer ${auth}`);
    return req.send({ fileName: name, contentType: 'application/octet-stream', contentBase64: body.toString('base64') });
  };

  it('starts with no data', async () => {
    const res = await request(app).get('/api/dataset');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ active: null, uploads: [] });
  });

  it('requires owner sign-in to upload', async () => {
    expect((await upload(undefined, undefined, null)).status).toBe(401);
    expect((await upload(undefined, undefined, 'bad.token')).status).toBe(401);
  });

  it('uploads a sheet, records date/time, and serves it as the active dataset', async () => {
    const res = await upload();
    expect(res.status).toBe(201);
    expect(res.body.upload).toMatchObject({ fileName: 'fecc-candidates-sample.xlsx', rowCount: 25, size: SAMPLE.length });
    expect(new Date(res.body.upload.uploadedAt).toString()).not.toBe('Invalid Date');
    expect(res.body.summary).toMatchObject({ total: 25, preCompleted: 20, postCompleted: 15, released: 8 });

    const data = (await request(app).get('/api/dataset')).body;
    expect(data.active.candidates).toHaveLength(25);
    expect(data.uploads).toHaveLength(1);
  });

  it('keeps an upload history with the newest upload live', async () => {
    await upload('first.xlsx');
    await upload('second.csv', Buffer.from('Name,Pre Onboarding,Post Onboarding\nA,Yes,Yes\n'));
    const data = (await request(app).get('/api/dataset')).body;
    expect(data.uploads.map((u) => u.fileName)).toEqual(['second.csv', 'first.xlsx']);
    expect(data.active.fileName).toBe('second.csv');
    expect(data.active.rowCount).toBe(1);
  });

  it('returns a clear 400 for an invalid sheet and keeps the previous data', async () => {
    await upload();
    const bad = await upload('bad.csv', Buffer.from('Name,Email\nA,a@x\n'));
    expect(bad.status).toBe(400);
    expect(bad.body.error).toMatch(/Missing required columns/);
    expect((await request(app).get('/api/dataset')).body.active.rowCount).toBe(25);
  });

  it('downloads the original file and deletes uploads (owner only)', async () => {
    const { id } = (await upload('first.xlsx')).body.upload;
    await upload('second.xlsx');

    expect((await request(app).get(`/api/uploads/${id}/file`)).status).toBe(401);
    const file = await request(app).get(`/api/uploads/${id}/file`).set('Authorization', `Bearer ${token}`).buffer(true).parse((res, cb) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(file.status).toBe(200);
    expect(file.headers['content-disposition']).toContain('first.xlsx');
    expect(Buffer.compare(file.body, SAMPLE)).toBe(0);

    const latest = (await request(app).get('/api/dataset')).body.uploads[0].id;
    const del = await request(app).delete(`/api/uploads/${latest}`).set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(200);
    expect(del.body.active.fileName).toBe('first.xlsx');
    expect((await request(app).delete('/api/uploads/nope').set('Authorization', `Bearer ${token}`)).status).toBe(404);
  });

  it('logs the owner in with the passcode', async () => {
    expect((await request(app).post('/api/admin/login').send({ passcode: 'nope' })).status).toBe(401);
    const ok = await request(app).post('/api/admin/login').send({ passcode: 'secret-pass' });
    expect(ok.status).toBe(200);
    expect(verifyToken(ok.body.token)).toBe(true);
  });

  it('chat says there is no data before any upload, without calling the AI', async () => {
    const res = await request(app).post('/api/chat').send({ message: 'Who is released?' });
    expect(res.body.reply).toBe(NO_DATA_REPLY);
    expect(generateContent).not.toHaveBeenCalled();
  });

  it('chat sends no sheet data up front, runs the tools the model asks for, and returns its answer', async () => {
    await upload();
    const call = { id: 'call-1', name: 'list_candidates', args: { status: 'pre_pending' } };
    generateContent
      .mockResolvedValueOnce({ functionCalls: [call], candidates: [{ content: { role: 'model', parts: [{ functionCall: call }] } }] })
      .mockResolvedValueOnce({ text: '5 candidates have pre-onboarding pending.' });
    const res = await request(app)
      .post('/api/chat')
      .send({ message: 'Who is pending pre-onboarding?', history: [{ role: 'user', text: 'hi' }, { role: 'assistant', text: 'hello' }] });

    expect(res.status).toBe(200);
    expect(res.body.reply).toBe('5 candidates have pre-onboarding pending.');
    expect(res.body.sources).toEqual([{ tool: 'list_candidates', label: 'Candidate list', detail: 'pre-onboarding pending · 5 matched' }]);

    const first = generateContent.mock.calls[0][0];
    expect(first.config.systemInstruction).toContain('fecc-candidates-sample.xlsx');
    expect(first.config.systemInstruction).not.toContain('Aarav Sharma');
    expect(first.config.tools[0].functionDeclarations.map((t) => t.name)).toEqual([
      'get_onboarding_summary',
      'list_candidates',
      'get_candidate',
      'count_candidates',
    ]);
    expect(first.contents.map((c) => c.role)).toEqual(['user', 'model', 'user']);

    const second = generateContent.mock.calls[1][0];
    expect(second.contents.map((c) => c.role)).toEqual(['user', 'model', 'user', 'model', 'user']);
    const fr = second.contents.at(-1).parts[0].functionResponse;
    expect(fr).toMatchObject({ id: 'call-1', name: 'list_candidates' });
    expect(fr.response.output.matched).toBe(5);
    expect(fr.response.output.candidates.map((c) => c.name)).toEqual(['Rohan Mehta', 'Meera Joshi', 'Aditya Kumar', 'Harsh Agarwal', 'Yash Thakur']);
  });

  it('chat stops a model that never stops calling tools', async () => {
    await upload();
    const call = { name: 'get_onboarding_summary', args: {} };
    generateContent.mockResolvedValue({ functionCalls: [call] });
    const res = await request(app).post('/api/chat').send({ message: 'loop' });
    expect(res.status).toBe(503);
    expect(generateContent.mock.calls.length).toBeLessThanOrEqual(3 * (MAX_TOOL_ROUNDS + 1));
  });

  it('chat falls back through models and stops on quota errors', async () => {
    await upload();
    generateContent.mockRejectedValueOnce({ status: 404, message: 'NOT_FOUND' }).mockResolvedValueOnce({ text: 'ok' });
    expect((await request(app).post('/api/chat').send({ message: 'hi' })).body.reply).toBe('ok');

    generateContent.mockReset().mockRejectedValue({ status: 429, message: 'RESOURCE_EXHAUSTED' });
    const res = await request(app).post('/api/chat').send({ message: 'hi' });
    expect(res.status).toBe(429);
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it('rejects empty or oversized uploads', async () => {
    const empty = await request(app).post('/api/uploads').set('Authorization', `Bearer ${token}`).send({ fileName: 'a.xlsx', contentBase64: '' });
    expect(empty.status).toBe(400);
    const big = await upload('big.csv', Buffer.alloc(3 * 1024 * 1024 + 10, 'a'));
    expect(big.status).toBe(400);
    expect(big.body.error).toMatch(/larger than 3 MB/);
  });

  it('stops a slow model at the time budget and returns a clear timeout message', async () => {
    await upload();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    generateContent.mockImplementation(
      ({ config }) =>
        new Promise((_resolve, reject) => {
          config.abortSignal.addEventListener('abort', () => reject(new Error('aborted')));
        })
    );
    const pending = request(app).post('/api/chat').send({ message: 'hi' });
    const done = pending.then((r) => r);
    await vi.waitFor(() => expect(generateContent).toHaveBeenCalled());
    await vi.advanceTimersByTimeAsync(CHAT_BUDGET_MS + 10);
    const res = await done;
    vi.useRealTimers();
    expect(res.status).toBe(504);
    expect(res.body.error).toMatch(/took too long/);
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it('validates chat input', async () => {
    expect((await request(app).post('/api/chat').send({ message: '' })).status).toBe(400);
    expect((await request(app).post('/api/chat').send({ message: 'x'.repeat(2001) })).status).toBe(400);
  });

  it('refuses uploads on Vercel without a Blob store', async () => {
    vi.stubEnv('VERCEL', '1');
    const res = await upload();
    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/Blob store/);
  });
});

describe('helpers', () => {
  it('classifies Gemini errors', () => {
    expect(classifyGeminiError({ status: 403 })).toBe('auth');
    expect(classifyGeminiError({ message: 'quota exceeded' })).toBe('quota');
    expect(classifyGeminiError({ status: 404 })).toBe('model');
    expect(classifyGeminiError(new Error('boom'))).toBe('other');
  });

  it('system instruction explains the same-category rule', () => {
    expect(buildSystemInstruction(null)).toMatch(/Release candidates and course-complete candidates are the SAME category/);
  });
});
