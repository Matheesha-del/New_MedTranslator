import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import OpenAI from "npm:openai";

const openai = new OpenAI();

Deno.serve(async (req) => {
  
  const { conversation } = await req.json();

  
  if (!conversation || !Array.isArray(conversation)) {
    return new Response(
      JSON.stringify({ error: "Invalid input. 'conversation' must be an array of messages." }),
      { headers: { "Content-Type": "application/json" }, status: 400 }
    );
  }

  const completion = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "system",
        content: "You are an assistant that summarizes conversations into concise and clear summaries.",
      },
      ...conversation,
    ],
  });

  console.log(completion.choices[0]);

  return new Response(
    JSON.stringify(completion.choices[0].message),
    { headers: { "Content-Type": "application/json" } }
  );
});
