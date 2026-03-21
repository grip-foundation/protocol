import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PayClaw, GripAgent } from '../src';
import { PayClawError, UnauthorizedError } from '../src/types';

// ─── Mock fetch ─────────────────────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function mockResponse(data: unknown, status = 200) {
  mockFetch.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  });
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('PayClaw', () => {
  let payclaw: PayClaw;

  beforeEach(() => {
    mockFetch.mockReset();
    payclaw = new PayClaw({
      apiKey: 'pc_live_test_key',
      agentId: 'test-agent',
      baseUrl: 'http://localhost:3000',
    });
  });

  describe('constructor', () => {
    it('throws if apiKey is missing', () => {
      expect(() => new PayClaw({ apiKey: '', agentId: 'x' })).toThrow('apiKey is required');
    });

    it('throws if agentId is missing', () => {
      expect(() => new PayClaw({ apiKey: 'key', agentId: '' })).toThrow('agentId is required');
    });
  });

  describe('pay()', () => {
    it('sends payment and returns result with balance', async () => {
      mockResponse({
        id: 'pay_123',
        status: 'confirmed',
        txHash: '0xabc',
        amountUsdc: 20,
        fee: 0.02,
        to: 'OpenAI',
        timestamp: '2026-03-21T00:00:00Z',
      });

      mockResponse({ usdc: 460.0, address: '0xdef' });

      const result = await payclaw.pay('OpenAI', 20.0, 'GPT-4 API credits');

      expect(result.status).toBe('confirmed');
      expect(result.txHash).toBe('0xabc');
      expect(result.amountUsdc).toBe(20);
      expect(result.balance).toBe(460.0);
    });

    it('passes memo correctly', async () => {
      mockResponse({ id: 'pay_1', status: 'confirmed', txHash: '0x1', amountUsdc: 5, fee: 0.005, to: '0xabc', timestamp: '' });
      mockResponse({ usdc: 100, address: '0x1' });

      await payclaw.pay('0xabc', 5, 'test memo');

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.memo).toBe('test memo');
      expect(body.amountUsdc).toBe(5);
      expect(body.to).toBe('0xabc');
    });

    it('throws PayClawError on API failure', async () => {
      mockResponse({ message: 'Insufficient funds', code: 'INSUFFICIENT_FUNDS' }, 402);
      mockResponse({ usdc: 0, address: null }); // balance call after pay failure doesn't happen

      await expect(payclaw.pay('0xabc', 999)).rejects.toThrow(PayClawError);
    });

    it('throws UnauthorizedError on 401', async () => {
      mockResponse({}, 401);
      await expect(payclaw.pay('0xabc', 1)).rejects.toThrow(UnauthorizedError);
    });
  });

  describe('escrow()', () => {
    it('creates escrow and returns escrowId', async () => {
      mockResponse({
        id: 'pay_456',
        escrowId: 42,
        txHash: '0xescrow',
        status: 'confirmed',
        amountUsdc: 0.05,
        payeeAddress: '0xpayee',
        timeoutSeconds: 300,
      });

      const result = await payclaw.escrow('0xpayee', 0.05, { serviceId: 'translate-v1' });

      expect(result.escrowId).toBe(42);
      expect(result.txHash).toBe('0xescrow');
    });
  });

  describe('release()', () => {
    it('releases escrow', async () => {
      mockResponse({ escrowId: 42, txHash: '0xrelease', status: 'released' });

      const result = await payclaw.release(42);
      expect(result.status).toBe('released');
    });
  });

  describe('balance()', () => {
    it('returns USDC balance as number', async () => {
      mockResponse({ usdc: 123.45, address: '0xwallet' });
      const balance = await payclaw.balance();
      expect(balance).toBe(123.45);
    });
  });

  describe('agent()', () => {
    it('returns GripAgent bound to agentId', () => {
      const agent = payclaw.agent('researcher');
      expect(agent).toBeInstanceOf(GripAgent);
    });

    it('GripAgent.pay() sends correct agentId', async () => {
      const agent = payclaw.agent('researcher');
      mockResponse({ id: 'p1', status: 'confirmed', txHash: '0x1', amountUsdc: 1, fee: 0, to: '0x1', timestamp: '' });

      await agent.pay('0x1', 1);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.agentId).toBe('researcher');
    });
  });

  describe('pixDeposit()', () => {
    it('returns QR code data', async () => {
      mockResponse({
        pixId: 'pix_1',
        qrCode: '00020126...',
        qrCodeImage: 'data:image/png;base64,...',
        amountBrl: 100,
        amountUsdc: 17.24,
        rateBrlUsdc: 5.8,
        expiresAt: '2026-03-21T01:00:00Z',
      });

      const result = await payclaw.pixDeposit(100);
      expect(result.amountBrl).toBe(100);
      expect(result.qrCode).toBeTruthy();
    });
  });

  describe('pixRate()', () => {
    it('returns exchange rate', async () => {
      mockResponse({ brl_per_usdc: 5.8, usdc_per_brl: 0.172, source: 'coingecko', timestamp: '' });

      const rate = await payclaw.pixRate();
      expect(rate.brl_per_usdc).toBe(5.8);
    });
  });

  describe('error handling', () => {
    it('throws on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('fetch failed'));
      await expect(payclaw.balance()).rejects.toThrow(PayClawError);
    });

    it('throws timeout error on abort', async () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValueOnce(abortError);
      await expect(payclaw.balance()).rejects.toMatchObject({ code: 'TIMEOUT' });
    });
  });
});
