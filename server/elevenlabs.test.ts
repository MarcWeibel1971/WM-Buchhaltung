import { describe, it, expect } from 'vitest';

describe('ElevenLabs API Key Validation', () => {
  it('should have a valid ELEVENLABS_API_KEY and be able to list voices', async () => {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    expect(apiKey, 'ELEVENLABS_API_KEY must be set').toBeTruthy();

    const res = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: { 'xi-api-key': apiKey! },
    });

    expect(res.status).toBe(200);
    const data = await res.json() as { voices: { voice_id: string; name: string }[] };
    expect(Array.isArray(data.voices)).toBe(true);
    expect(data.voices.length).toBeGreaterThan(0);

    // Verify Daniel voice is available (our chosen voice for the advisor)
    const danielVoice = data.voices.find(v => v.voice_id === 'onwK4e9ZLuTAKqWW03F9');
    expect(danielVoice, 'Daniel voice should be available').toBeTruthy();
  });
});
