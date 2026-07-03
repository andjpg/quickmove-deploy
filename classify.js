// Vercel serverless function — POST /api/classify
// Keeps the Gemini API key server-side (set as an environment variable in
// your Vercel project settings, never exposed to the browser).

const PILLARS = ["Apartments", "Movers & Packers", "Utilities", "Documentation", "General"];
const URGENCY = ["Low", "Medium", "High"];
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Use POST" });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ ok: false, error: "GEMINI_API_KEY is not set in this project's environment variables." });
    return;
  }

  const { text, senderName } = req.body || {};
  if (!text || typeof text !== "string") {
    res.status(400).json({ ok: false, error: "Missing 'text' in request body." });
    return;
  }

  const systemInstruction = `You are QuickMove's intake classifier. QuickMove helps people relocate to a new city (apartments, movers/packers, utilities, address-change documentation). A customer just sent a WhatsApp-style message. Extract structured fields from it.

Respond with ONLY a raw JSON object, no markdown fences, no preamble, in exactly this shape:
{"customer_name": string or null, "pillar": one of ["Apartments","Movers & Packers","Utilities","Documentation","General"], "urgency": one of ["Low","Medium","High"], "summary": a single sentence under 15 words, "suggested_action": a single short sentence telling the ops person what to do next, "ack_reply": a short, warm 1-2 sentence reply to send the customer right now acknowledging their message (do not promise a specific resolution time unless urgency is High, in which case reassure them someone will reach out shortly)}`;

  try {
    const geminiResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemInstruction }] },
          contents: [
            {
              role: "user",
              parts: [{ text: `Sender name (if known): ${senderName || "unknown"}\nMessage: ${text}` }],
            },
          ],
          generationConfig: { temperature: 0.2 },
        }),
      }
    );

    if (!geminiResp.ok) {
      const errText = await geminiResp.text();
      res.status(502).json({ ok: false, error: `Gemini API error (${geminiResp.status}): ${errText}` });
      return;
    }

    const data = await geminiResp.json();
    const rawText =
      data &&
      data.candidates &&
      data.candidates[0] &&
      data.candidates[0].content &&
      data.candidates[0].content.parts &&
      data.candidates[0].content.parts[0] &&
      data.candidates[0].content.parts[0].text;

    if (!rawText) {
      res.status(502).json({ ok: false, error: "Gemini returned no text content.", raw: data });
      return;
    }

    const cleaned = rawText.replace(/```json|```/g, "").trim();
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      res.status(502).json({ ok: false, error: "Could not parse Gemini's response as JSON.", raw: rawText });
      return;
    }

    // Guard against unexpected values so the frontend always gets something safe to render.
    if (!PILLARS.includes(parsed.pillar)) parsed.pillar = "General";
    if (!URGENCY.includes(parsed.urgency)) parsed.urgency = "Medium";
    if (!parsed.summary) parsed.summary = text.slice(0, 90);
    if (!parsed.suggested_action) parsed.suggested_action = "Review manually and route to the right team member.";
    if (!parsed.ack_reply) parsed.ack_reply = "Thanks for reaching out — our team will get back to you shortly.";

    res.status(200).json({ ok: true, result: parsed });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
}
