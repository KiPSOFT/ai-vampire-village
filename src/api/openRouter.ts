export interface ORModel {
  id: string;
  name: string;
  pricing: {
    prompt: number;
    completion: number;
  };
}

export const fetchModels = async (): Promise<ORModel[]> => {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/models');
    if (!response.ok) throw new Error('Failed to fetch models');
    const data = await response.json();
    return data.data.map((m: any) => ({
      id: m.id,
      name: m.name || m.id,
      pricing: {
        prompt: Number(m.pricing?.prompt || 0),
        completion: Number(m.pricing?.completion || 0)
      }
    }));
  } catch (error) {
    console.error('Error fetching models:', error);
    return [];
  }
};

export const getAgentDecision = async (
  apiKey: string,
  model: string,
  systemPrompt: string,
  contextPrompt: string
): Promise<string> => {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': window.location.href,
        'X-Title': 'AI Box Experiment',
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: contextPrompt }
        ],
        temperature: 0.7,
        max_tokens: 150,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || 'I decide to stay idle.';
  } catch (error: any) {
    console.error('Error fetching agent decision:', error);
    return `Error: ${error.message}`;
  }
};
