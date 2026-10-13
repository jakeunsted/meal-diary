import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { sendMock, resendCalls } = vi.hoisted(() => ({
  sendMock: vi.fn(),
  resendCalls: [] as string[],
}));

vi.mock('resend', () => ({
  Resend: class Resend {
    emails = { send: sendMock };

    constructor(apiKey: string) {
      resendCalls.push(apiKey);
    }
  },
}));

import { sendMail } from '../mail.service.ts';

beforeEach(() => {
  vi.clearAllMocks();
  resendCalls.length = 0;
});

afterEach(() => {
  delete process.env.RESEND_API_KEY;
  delete process.env.MAIL_FROM;
});

describe('sendMail', () => {
  it('logs the message and skips Resend when the API key is unset', async () => {
    delete process.env.RESEND_API_KEY;
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});

    await sendMail({
      to: 'user@example.com',
      subject: 'Reset your Meal Diary password',
      text: 'http://localhost:3000/reset-password?token=abc',
      html: '<p>reset</p>',
    });

    expect(resendCalls).toEqual([]);
    expect(sendMock).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledWith(
      '[mail] RESEND_API_KEY unset, skipping send',
      expect.objectContaining({
        to: 'user@example.com',
        text: 'http://localhost:3000/reset-password?token=abc',
      })
    );

    info.mockRestore();
  });

  it('sends through Resend when an API key is set', async () => {
    process.env.RESEND_API_KEY = 're_test';
    process.env.MAIL_FROM = 'Meal Diary <noreply@mealdiary.co.uk>';
    sendMock.mockResolvedValue({ data: { id: 'email_1' }, error: null });

    await sendMail({
      to: 'user@example.com',
      subject: 'Reset your Meal Diary password',
      text: 'reset link',
      html: '<p>reset link</p>',
    });

    expect(resendCalls).toEqual(['re_test']);
    expect(sendMock).toHaveBeenCalledWith({
      from: 'Meal Diary <noreply@mealdiary.co.uk>',
      to: 'user@example.com',
      subject: 'Reset your Meal Diary password',
      text: 'reset link',
      html: '<p>reset link</p>',
    });
  });
});
