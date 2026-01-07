import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, emotionContext } = await req.json();
    
    const AI_API_KEY = Deno.env.get("AI_API_KEY");
    
    if (!AI_API_KEY) {
      throw new Error("AI_API_KEY is not configured");
    }

    // Create emotion-aware system prompt
    let systemPrompt = "You are a friendly AI learning assistant for NeuroLearn, an advanced neuroadaptive education platform. Help students learn effectively, answer questions, provide study tips, and motivate them. Keep responses concise and encouraging.";
    
    if (emotionContext) {
      const { facialEmotion, voiceEmotion, engagement, attention } = emotionContext;
      systemPrompt += `\n\nCurrent student state: Facial emotion: ${facialEmotion}, Voice emotion: ${voiceEmotion || 'unknown'}, Engagement: ${engagement}%, Attention: ${attention}%. `;
      
      if (engagement < 60) {
        systemPrompt += "The student seems distracted or low on energy. Be extra encouraging, break things down simply, and suggest taking breaks if needed.";
      } else if (facialEmotion === 'sad') {
        systemPrompt += "The student appears to be struggling emotionally. Be empathetic, supportive, and reassuring. Remind them that challenges are normal.";
      } else if (facialEmotion === 'happy' && engagement > 75) {
        systemPrompt += "The student is highly engaged and positive! Match their energy, dive deeper into topics, and challenge them appropriately.";
      } else if (attention < 70) {
        systemPrompt += "The student's attention is wavering. Keep responses brief and focused. Suggest interactive activities.";
      }
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { 
            role: "system", 
            content: systemPrompt 
          },
          ...messages,
        ],
        stream: true,
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        if (!reader) return;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
