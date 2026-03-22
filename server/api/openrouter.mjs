/**
 * OpenRouter LLM API — server-side
 */
export async function getOpenRouterDecision(apiKey, model, agentName, systemPrompt, contextPrompt) {
  try {
    /*
    console.log(`\n================== 🌐 OPENROUTER REQUEST [${agentName}] ==================`);
    console.log(`Model: ${model}`);
    console.log(`\n--- SYSTEM PROMPT ---\n${systemPrompt}`);
    console.log(`\n--- CONTEXT PROMPT ---\n${contextPrompt}`);
    console.log(`======================================================================\n`);
    */

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal: AbortSignal.timeout(45000), // 45 Saniyelik zaman aşımı süresi
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-Title': 'AI Box Experiment',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: contextPrompt }
        ],
        temperature: 0.7,
        max_tokens: 2048,
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '{"action": "STAY", "reason": "API returned empty response"}';

    console.log(`\n================== 🌐 OPENROUTER RESPONSE [${agentName}] ==================`);
    console.log(content || '<EMPTY RESPONSE>');
    console.log(`======================================================================\n`);

    return content;
  } catch (error) {
    console.error(`🌐 [OpenRouter ERR] agent: ${agentName}:`, error.message);
    return `Error: ${error.message}`;
  }
}
