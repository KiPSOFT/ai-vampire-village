import { OLLAMA_BASE_URL } from './config';

export const getOllamaDecision = async (
  model: string,
  systemPrompt: string,
  contextPrompt: string
): Promise<string> => {
  const url = `${OLLAMA_BASE_URL}/api/chat`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: contextPrompt }
        ],
        stream: false,
        options: {
          temperature: 0.3,
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content = data?.message?.content;
    
    console.log(`🦙 [Ollama Request] url: ${url}, model: ${model}`);
    console.log(`🦙 [Ollama Response]`, content);
    
    if (content === undefined || content === null || content.trim() === '') {
      return `DEBUG ERROR: Ollama returned empty content. Full response: ${JSON.stringify(data)}`;
    }
    
    return content;
  } catch (error: any) {
    console.error('Error fetching agent decision from Ollama:', error);
    return `Error: ${error.message}`;
  }
};
