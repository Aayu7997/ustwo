import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import "https://deno.land/x/xhr@0.1.0/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { genres, watchHistory, preferredPlatforms, mood } = await req.json()
    
    const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY')
    if (!OPENROUTER_API_KEY) {
      throw new Error('OPENROUTER_API_KEY is not set')
    }

    const prompt = `Based on the following preferences, recommend 5 movies/shows to watch together:

Genres: ${genres?.join(', ') || 'Any'}
Watch History: ${watchHistory?.join(', ') || 'None provided'}
Preferred Platforms: ${preferredPlatforms?.join(', ') || 'Any'}
Current Mood: ${mood || 'Any'}

Please provide recommendations in this JSON format:
{
  "recommendations": [
    {
      "title": "Movie/Show Title",
      "platform": "Netflix/YouTube/etc",
      "genre": "Genre",
      "description": "Brief description",
      "reason": "Why this fits their preferences",
      "rating": "8.5/10"
    }
  ]
}

Focus on content that's good for couples to watch together. Consider their mood and make the recommendations diverse but fitting.`

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://lovable.ai',
        'X-Title': 'Couple Watch App'
      },
      body: JSON.stringify({
        model: 'openrouter/horizon-alpha',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7
      })
    })

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices[0].message.content

    // Try to parse JSON from the response
    let recommendations
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        recommendations = JSON.parse(jsonMatch[0])
      } else {
        // Fallback parsing
        recommendations = { recommendations: [] }
      }
    } catch (e) {
      console.error('Failed to parse AI response as JSON:', e)
      recommendations = { recommendations: [] }
    }

    return new Response(JSON.stringify(recommendations), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Error in ai-recommendations:', error)
    return new Response(JSON.stringify({ 
      error: 'Failed to get recommendations',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})