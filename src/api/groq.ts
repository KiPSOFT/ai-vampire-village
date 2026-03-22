export interface GroqModel {
  id: string;
  name: string;
}

export const fetchModels = async (apiKey: string): Promise<GroqModel[]> => {
  try {
    const response = await fetch('https://api.groq.com/openai/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });
    if (!response.ok) throw new Error('Failed to fetch models');
    const data = await response.json();
    return data.data.map((m: any) => ({
      id: m.id,
      name: m.id // Groq models usually don't have a human 'name' field, just 'id'
    }));
  } catch (error) {
    console.error('Error fetching Groq models:', error);
    return [];
  }
};

export const getAgentDecision = async (
  apiKey: string,
  model: string,
  systemPrompt: string,
  contextPrompt: string
): Promise<string> => {
  return '';
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
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

    if (content === undefined || content === null || content.trim() === '') {
      return `DEBUG ERROR: API returned empty or missing content. Full API response: ${JSON.stringify(data)}`;
    }

    return content;
  } catch (error: any) {
    console.error('Error fetching agent decision from Groq:', error);
    return `Error: ${error.message}`;
  }
};
