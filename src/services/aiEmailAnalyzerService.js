const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const SYSTEM_PROMPT = `You are a content-analysis assistant. The email you're given has ALREADY been confirmed to come from a trusted/configured sender (the sender's identity is verified separately, before this step — do NOT judge or second-guess the From address, and do not reject an email just because it looks forwarded or the From address looks personal).
Your only job: decide whether the email's content presents a short code that the recipient is meant to enter or use somewhere (e.g. to confirm/verify an account or recovery email, log in, or pass a security checkpoint).
This code can be called ANYTHING, or nothing at all — "OTP", "one-time code", "verification code", "confirmation code", "security code", "login code", "PIN", or just introduced with plain wording like "Enter this code", "Use this code", "Your code is", "Here's your code". Treat all of these identically — the exact term used, or whether any term is used, does not matter. The code is often on its own line right after such wording. What matters is that a short code is clearly presented for the recipient to type/enter.
Respond with ONLY a JSON object, no other text, in this exact shape:
{"isOtp": boolean, "otp": string}
Rules:
- "isOtp" is true whenever the email content presents such a code — regardless of what word (if any) is used to describe it, and regardless of the From address or whether the mail looks forwarded.
- "otp" is the code itself, exactly as written (digits or letters, keep any leading zeros), or an empty string if isOtp is false or no code is found.
- Only extract a code the recipient is meant to actively enter/use. Ignore unrelated numbers that are not presented as an enterable code (dates, account/user IDs, phone numbers, prices, ad copy, URLs).
- Ignore emails (ads, general "someone logged in" alerts, marketing) that do not present such a code.`;

const buildUserPrompt = ({ subject, from, text }) => {
  const truncatedBody = (text || '').slice(0, 4000);
  return `From: ${from || ''}\nSubject: ${subject || ''}\n\nBody:\n${truncatedBody}`;
};

const parseJsonResponse = (raw) => {
  try {
    const match = String(raw || '').match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : raw);
    return {
      isOtp: Boolean(parsed.isOtp),
      otp: parsed.otp ? String(parsed.otp).trim() : '',
    };
  } catch (err) {
    return { isOtp: false, otp: '' };
  }
};

const analyzeWithOpenAI = async (email, { apiKey, model }) => {
  const client = new OpenAI({ apiKey });
  const completion = await client.chat.completions.create({
    model: model || 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(email) },
    ],
  });
  return parseJsonResponse(completion.choices?.[0]?.message?.content);
};

const analyzeWithGemini = async (email, { apiKey, model }) => {
  const genAI = new GoogleGenerativeAI(apiKey);
  const genModel = genAI.getGenerativeModel({
    model: model || 'gemini-1.5-flash',
    generationConfig: { responseMimeType: 'application/json' },
  });
  const result = await genModel.generateContent(`${SYSTEM_PROMPT}\n\n${buildUserPrompt(email)}`);
  return parseJsonResponse(result.response.text());
};

// email: { subject, from, text }. aiConfig: { provider, model, apiKey } (apiKey already decrypted).
const analyzeEmail = async (email, aiConfig) => {
  if (!aiConfig?.apiKey) {
    throw new Error('AI provider API key is not configured');
  }
  if (aiConfig.provider === 'gemini') {
    return analyzeWithGemini(email, aiConfig);
  }
  return analyzeWithOpenAI(email, aiConfig);
};

module.exports = { analyzeEmail };
