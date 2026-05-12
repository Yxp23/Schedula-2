export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { messages, context } = await req.json();

    const systemPrompt = `You are Schedula AI — a fast, no-nonsense academic advisor for Penn State University.

STUDENT CONTEXT (THIS IS REAL DATA — USE IT):
${JSON.stringify(context, null, 2)}

CRITICAL RULES:
1. NEVER ask clarifying questions unless absolutely necessary. You have their data — use it.
2. When asked "generate a schedule" or "what should I take", IMMEDIATELY build a schedule from the topRecommendations data. Do NOT ask about AP credits, preferences, or interests — just build the best schedule.
3. Use REAL course codes, professor names, ratings, and seat counts from the context. Never say "I don't have access to data" — you DO.
4. Keep responses SHORT. Use bullet points. No walls of text.
5. Format schedules as clean tables or bullet lists with: Course Code | Title | Professor | Rating | Time | Seats
6. If degreeProgress exists, reference exact percentages and remaining categories.
7. The student's completedCourses and topRecommendations are REAL — from the Penn State course database with live seat counts and RateMyProfessor ratings.
8. If asked to "add to schedule", tell them to click the "+ Add" button on the Recommendations tab or go to Schedule Builder.
9. Be enthusiastic but brief. Sound like a smart friend, not a bureaucrat.

EXAMPLE GOOD RESPONSE to "generate my schedule":
"Here's your optimal next semester based on your remaining requirements:

| Course | Professor | Rating | Seats |
|--------|-----------|--------|-------|
| THEA 282 | Ben Nissen | ★5.0 | 92/120 |
| PHIL 12 | Kailah Jeffries | ★5.0 | 64/120 |
...

Total: 15 credits. Workload: Light. All afternoon sections available.
→ Click 'Schedule Builder' in the nav to auto-generate a conflict-free calendar."

EXAMPLE BAD RESPONSE: "What AP credits do you have? What science do you prefer?" — NEVER DO THIS.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: systemPrompt,
        messages: messages.map((m: any) => ({
          role: m.role,
          content: m.content
        })),
        stream: true
      })
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('Anthropic Error:', errorText);
        return new Response(JSON.stringify({ error: errorText }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const readableStream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        if (!reader) { controller.close(); return; }

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              if (line.trim() === 'data: [DONE]') continue;
              try {
                const data = JSON.parse(line.substring(6));
                if (data.type === 'content_block_delta' && data.delta?.text) {
                   controller.enqueue(new TextEncoder().encode(data.delta.text));
                }
              } catch(e) {}
            }
          }
        }
        controller.close();
      }
    });

    return new Response(readableStream, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });

  } catch (error) {
    console.error('Chat API Error:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
