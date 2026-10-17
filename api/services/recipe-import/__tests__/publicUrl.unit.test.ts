import { describe, it, expect, vi } from 'vitest';
import { InvalidRecipeImportUrlError } from '../errors.ts';
import {
  assertPublicHttpUrl,
  resolvePublicHttpUrl,
  fetchPublicHtml,
} from '../publicUrl.ts';

describe('resolvePublicHttpUrl / assertPublicHttpUrl', () => {
  it('rejects private and metadata hostnames', async () => {
    await expect(assertPublicHttpUrl(new URL('http://localhost/recipe'))).rejects.toBeInstanceOf(
      InvalidRecipeImportUrlError
    );
    await expect(
      assertPublicHttpUrl(new URL('http://169.254.169.254/latest/meta-data/'))
    ).rejects.toBeInstanceOf(InvalidRecipeImportUrlError);
    await expect(assertPublicHttpUrl(new URL('http://192.168.1.1/'))).rejects.toBeInstanceOf(
      InvalidRecipeImportUrlError
    );
  });

  it('rejects credentials in the URL', async () => {
    await expect(
      assertPublicHttpUrl(new URL('https://user:pass@example.com/recipe'))
    ).rejects.toBeInstanceOf(InvalidRecipeImportUrlError);
  });

  it('rejects when DNS returns any private address', async () => {
    const lookup = vi.fn().mockResolvedValue([
      { address: '93.184.216.34', family: 4 },
      { address: '10.0.0.5', family: 4 },
    ]);

    await expect(
      resolvePublicHttpUrl(new URL('https://example.com/recipe'), lookup)
    ).rejects.toBeInstanceOf(InvalidRecipeImportUrlError);
  });

  it('returns only public addresses for pinning', async () => {
    const lookup = vi.fn().mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);

    const addresses = await resolvePublicHttpUrl(new URL('https://example.com/recipe'), lookup);
    expect(addresses).toEqual([{ address: '93.184.216.34', family: 4 }]);
  });
});

describe('fetchPublicHtml', () => {
  it('re-validates each redirect hop before fetching', async () => {
    const lookup = vi
      .fn()
      .mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }])
      .mockResolvedValueOnce([{ address: '10.0.0.1', family: 4 }]);

    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: 'https://evil.internal/recipe' },
      })
    );

    await expect(
      fetchPublicHtml(new URL('https://example.com/recipe'), fetchImpl as typeof fetch, lookup)
    ).rejects.toBeInstanceOf(InvalidRecipeImportUrlError);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
