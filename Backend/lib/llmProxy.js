// ============================================================================
// Layer 3 / 4 — LLM Proxy (llmProxy.js)
// ============================================================================
// Wraps safe prompts in <user_input> XML delimiters, calls the configured LLM
// API (Claude or Gemini), and performs a basic PII regex scan on the response
// before returning.
// ============================================================================

const fetch = require('node-fetch');

// ── PII regex patterns ──────────────────────────────────────────────────────
const PII_PATTERNS = [
  { type: 'email',      regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g },
  { type: 'phone',      regex: /(\+?\d{1,3}[-.\s]?)?(\(?\d{2,4}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{4}/g },
  { type: 'api_key',    regex: /(?:sk|pk|api|key|token|secret)[-_]?[a-zA-Z0-9]{20,}/gi },
  { type: 'ssn',        regex: /\b\d{3}-\d{2}-\d{4}\b/g },
  { type: 'credit_card', regex: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g },
];

/**
 * Call the configured LLM with the user's prompt wrapped in XML delimiters.
 *
 * @param {string} prompt – The user's original prompt (already deemed safe)
 * @returns {Promise<{ response: string, piiDetected: Array<{type: string, value: string}> }>}
 */
async function callLLM(prompt) {
  const provider = (process.env.LLM_PROVIDER || 'gemini').toLowerCase();

  // Wrap in XML delimiters for defence-in-depth
  const wrappedPrompt = `<user_input>${prompt}</user_input>`;

  let llmResponse;

  if (provider === 'claude') {
    llmResponse = await _callClaude(wrappedPrompt);
  } else {
    llmResponse = await _callGemini(wrappedPrompt);
  }

  // PII scan on the response
  const piiDetected = _scanPII(llmResponse);

  if (piiDetected.length > 0) {
    console.warn(`⚠  PII detected in LLM response: ${piiDetected.map(p => p.type).join(', ')}`);
  }

  return { response: llmResponse, piiDetected };
}

// ── Claude API ──────────────────────────────────────────────────────────────

async function _callClaude(wrappedPrompt) {
  const apiKey = process.env.LLM_API_KEY;

  if (!apiKey || apiKey === 'your_llm_api_key_here') {
    return '[Claude API key not configured — demo mode]';
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{ role: 'user', content: wrappedPrompt }],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`❌  Claude API error ${res.status}: ${body}`);
      return `[Claude API error: ${res.status}]`;
    }

    const data = await res.json();
    return data.content?.[0]?.text || '[No response from Claude]';
  } catch (err) {
    console.error('❌  Claude API call failed:', err.message);
    return `[Claude API call failed: ${err.message}]`;
  }
}

// ── Gemini API ──────────────────────────────────────────────────────────────

async function _callGemini(wrappedPrompt) {
  const apiKey = process.env.LLM_API_KEY;

  if (!apiKey || apiKey === 'your_llm_api_key_here') {
    return '[Gemini API key not configured — demo mode]';
  }

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: wrappedPrompt }] }],
        }),
      }
    );

    if (!res.ok) {
      const body = await res.text();
      console.error(`❌  Gemini API error ${res.status}: ${body}`);
      return `[Gemini API error: ${res.status}]`;
    }

    const data = await res.json();
    return (
      data.candidates?.[0]?.content?.parts?.[0]?.text ||
      '[No response from Gemini]'
    );
  } catch (err) {
    console.error('❌  Gemini API call failed:', err.message);
    return `[Gemini API call failed: ${err.message}]`;
  }
}

// ── PII Scanner ─────────────────────────────────────────────────────────────

function _scanPII(text) {
  const detected = [];

  for (const { type, regex } of PII_PATTERNS) {
    // Reset regex state for global patterns
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(text)) !== null) {
      detected.push({ type, value: match[0] });
    }
  }

  return detected;
}

module.exports = { callLLM };
