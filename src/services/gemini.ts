const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const MODEL = 'gemini-3.5-flash-lite'; // updated from gemini-2.5-flash-lite (deprecated for new users)
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

async function callGemini(systemPrompt: string, userContent: string): Promise<string> {
  if (!API_KEY) {
    throw new Error('Missing Gemini API key. Check your .env file.');
  }

  const response = await fetch(`${API_URL}?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: userContent }],
        },
      ],
      generationConfig: {
        temperature: 0.5,
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty response from Gemini');
  return text.trim();
}

export async function summarizeNote(content: string): Promise<string> {
  return callGemini(
    'You are a note-summarizing assistant. Summarize the following note in 2-3 concise sentences. Respond with only the summary, no preamble.',
    content
  );
}

export async function generateTitleAndTags(content: string): Promise<{ title: string; tags: string[] }> {
  const raw = await callGemini(
    'You generate a short title (max 6 words) and 2-4 relevant single-word or short-phrase tags for a note. Respond ONLY with valid JSON in this exact format, no markdown formatting, no code fences: {"title": "...", "tags": ["...", "..."]}',
    content
  );

  try {
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return {
      title: parsed.title ?? '',
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
    };
  } catch {
    throw new Error('Failed to parse AI response as JSON: ' + raw);
  }
}

export async function rewriteNote(content: string): Promise<string> {
  return callGemini(
    'Rewrite the following note to improve clarity and flow while preserving all original meaning and information. Respond with only the rewritten text, no preamble, no markdown code fences.',
    content
  );
}

export async function improveGrammar(content: string): Promise<string> {
  return callGemini(
    'Fix grammar, spelling, and punctuation errors in the following text. Preserve the original meaning, tone, and formatting exactly. Respond with only the corrected text, no preamble.',
    content
  );
}

export async function makeShorter(content: string): Promise<string> {
  return callGemini(
    'Make the following text more concise while preserving all key information. Respond with only the shortened text, no preamble.',
    content
  );
}

export async function makeLonger(content: string): Promise<string> {
  return callGemini(
    'Expand the following text with more detail and elaboration while staying consistent with the original meaning and tone. Respond with only the expanded text, no preamble.',
    content
  );
}

export async function translateNote(content: string, targetLanguage: string): Promise<string> {
  return callGemini(
    `Translate the following text into ${targetLanguage}. Preserve formatting like line breaks and lists where possible. Respond with only the translation, no preamble.`,
    content
  );
}

export async function extractKeyPoints(content: string): Promise<string> {
  return callGemini(
    'Extract the key points from the following note as a concise bulleted list (use "- " for each bullet). Respond with only the bullet list, no preamble.',
    content
  );
}

export async function extractActionItems(content: string): Promise<string> {
  return callGemini(
    'Extract any action items or to-dos from the following note as a bulleted list (use "- " for each item). If there are none, respond with exactly: "No action items found." Respond with only the list or that message, no preamble.',
    content
  );
}

export async function customPrompt(content: string, instruction: string): Promise<string> {
  return callGemini(
    `You are helping edit or analyze a note. Follow this instruction exactly: "${instruction}". Respond with only the result, no preamble, no meta-commentary about what you did.`,
    content
  );
}

export async function askAboutNotes(question: string, notes: { title: string; content: string }[]): Promise<string> {
  if (notes.length === 0) {
    return "I couldn't find any notes related to that question. Try rephrasing, or the answer might be in a note that doesn't share keywords with your question.";
  }

  const context = notes
    .map((n, i) => `--- Note ${i + 1}: "${n.title || 'Untitled'}" ---\n${n.content}`)
    .join('\n\n');

  return callGemini(
    `You answer questions using ONLY the note excerpts provided below. If the notes don't contain enough information to answer, say so honestly rather than guessing. Cite which note(s) your answer draws from by title.\n\n${context}`,
    question
  );
}