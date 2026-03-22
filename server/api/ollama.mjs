/**
 * Ollama LLM API — server-side
 */
export async function getOllamaDecision(baseUrl, model, agentName, systemPrompt, contextPrompt) {
  const url = `${baseUrl}/api/chat`;
  try {
    console.log(`\n================== 🦙 OLLAMA REQUEST [${agentName}] ==================`);
    console.log(`Model: ${model}\nURL: ${url}`);
    console.log(`\n--- SYSTEM PROMPT ---\n${systemPrompt}`);
    console.log(`\n--- CONTEXT PROMPT ---\n${contextPrompt}`);
    console.log(`======================================================================\n`);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: contextPrompt }
        ],
        stream: false,
        options: { temperature: 0.3 }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content = data?.message?.content;

    console.log(`\n================== 🦙 OLLAMA RESPONSE [${agentName}] ==================`);
    console.log(content || '<EMPTY RESPONSE>');
    console.log(`======================================================================\n`);

    if (!content || content.trim() === '') {
      return `DEBUG ERROR: Ollama returned empty content. Full response: ${JSON.stringify(data)}`;
    }

    return content;
  } catch (error) {
    console.error(`🦙 [Ollama ERR] agent: ${agentName}:`, error.message);
    return `Error: ${error.message}`;
  }
}
