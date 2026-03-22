/**
 * Groq LLM API — server-side
 */
export async function getGroqDecision(apiKey, model, agentName, systemPrompt, contextPrompt) {
  try {
    console.log(`\n================== ⚡ GROQ REQUEST [${agentName}] ==================`);
    console.log(`Model: ${model}`);
    console.log(`\n--- SYSTEM PROMPT ---\n${systemPrompt}`);
    console.log(`\n--- CONTEXT PROMPT ---\n${contextPrompt}`);
    console.log(`======================================================================\n`);

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: contextPrompt }
        ],
        temperature: 0.3,
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Groq API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;

    console.log(`\n================== ⚡ GROQ RESPONSE [${agentName}] ==================`);
    console.log(content || '<EMPTY RESPONSE>');
    console.log(`======================================================================\n`);

    if (!content || content.trim() === '') {
      return `DEBUG ERROR: Groq returned empty content. Full response: ${JSON.stringify(data)}`;
    }

    return content;
  } catch (error) {
    console.error(`⚡ [Groq ERR] agent: ${agentName}:`, error.message);
    return `Error: ${error.message}`;
  }
}
