import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RecommendationRequest {
  userPreferences: any;
  partnerPreferences?: any;
  roomId: string;
  partnerId?: string | null;
  mode?: 'solo' | 'couple';
}

interface Recommendation {
  title: string;
  platform: string;
  why_recommended: string;
  genre?: string;
  rating?: string;
  poster_url?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const openRouterApiKey = Deno.env.get('OPENROUTER_API_KEY')
    
    if (!openRouterApiKey) {
      console.error('OpenRouter API key not found')
      return new Response(
        JSON.stringify({ 
          error: 'AI service not configured. Please contact support.' 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const requestBody = await req.json() as RecommendationRequest
    const { userPreferences, partnerPreferences, roomId, partnerId, mode = 'couple' } = requestBody

    // Validate required fields
    if (!roomId) {
      console.error('Missing roomId in request')
      return new Response(
        JSON.stringify({ error: 'Room ID is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    console.log(`Generating AI recommendations for room: ${roomId} (mode: ${mode})`)
    console.log('Using DeepSeek V3.1 (free) via OpenRouter')

    const prompt = mode === 'solo' 
      ? `
Based on this user's movie/series/music preferences, suggest 5 diverse entertainment options they would enjoy:

User Preferences:
- Favorite Genres: ${userPreferences?.genres?.join(', ') || 'Open to anything'}
- Favorite Actors: ${userPreferences?.actors?.join(', ') || 'No specific preferences'}
- Favorite Directors: ${userPreferences?.directors?.join(', ') || 'No specific preferences'}
- Preferred Platforms: ${userPreferences?.platforms?.join(', ') || 'Netflix, Prime Video, Disney+, YouTube'}
- Dislikes: ${userPreferences?.disliked?.join(', ') || 'None specified'}

Please suggest 5 movies/shows/documentaries they would enjoy on streaming platforms.

Respond ONLY with valid JSON in this exact format (no markdown, no code blocks):
[
  {
    "title": "Movie/Show Title",
    "platform": "Netflix/Prime Video/Disney+/YouTube/etc",
    "why_recommended": "Detailed explanation of why this matches the user's preferences",
    "genre": "Primary genre",
    "rating": "IMDb rating or critic score if known"
  }
]
`
      : `
Based on these two users' preferences, suggest 5 entertainment options they can enjoy together:

User A Preferences:
- Favorite Genres: ${userPreferences?.genres?.join(', ') || 'Open to anything'}
- Favorite Actors: ${userPreferences?.actors?.join(', ') || 'No specific preferences'}
- Favorite Directors: ${userPreferences?.directors?.join(', ') || 'No specific preferences'}
- Preferred Platforms: ${userPreferences?.platforms?.join(', ') || 'Netflix, Prime Video, Disney+, YouTube'}
- Dislikes: ${userPreferences?.disliked?.join(', ') || 'None specified'}

User B Preferences:
- Favorite Genres: ${partnerPreferences?.genres?.join(', ') || 'Open to anything'}
- Favorite Actors: ${partnerPreferences?.actors?.join(', ') || 'No specific preferences'}
- Favorite Directors: ${partnerPreferences?.directors?.join(', ') || 'No specific preferences'}
- Preferred Platforms: ${partnerPreferences?.platforms?.join(', ') || 'Netflix, Prime Video, Disney+, YouTube'}
- Dislikes: ${partnerPreferences?.disliked?.join(', ') || 'None specified'}

Please suggest 5 movies/shows they can enjoy together on streaming platforms.

Respond ONLY with valid JSON in this exact format (no markdown, no code blocks):
[
  {
    "title": "Movie/Show Title",
    "platform": "Netflix/Prime Video/Disney+/YouTube/etc",
    "why_recommended": "Why this is perfect for both users",
    "genre": "Primary genre",
    "rating": "IMDb rating or critic score if known"
  }
]
`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openRouterApiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://lovable.app',
        'X-Title': 'Watch Together App'
      },
      body: JSON.stringify({
        model: 'deepseek/deepseek-chat',
        messages: [
          {
            role: 'system',
            content: 'You are an expert entertainment curator. You MUST respond with ONLY a valid JSON array, no markdown, no code blocks, no additional text. Start with [ and end with ].'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('OpenRouter AI error:', response.status, errorText)
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'AI service rate limit reached. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI service quota exceeded. Please add credits to your account.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      throw new Error(`OpenRouter AI error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    const content = data.choices[0].message.content
    
    console.log('Raw AI response:', content.substring(0, 200))
    
    // Parse the AI response with robust handling
    let recommendations: Recommendation[]
    try {
      let jsonContent = content.trim()
      
      // Remove markdown code blocks if present
      if (jsonContent.includes('```')) {
        const match = jsonContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
        if (match) {
          jsonContent = match[1]
        }
      }
      
      // Extract JSON array if embedded in text
      const arrayMatch = jsonContent.match(/\[[\s\S]*\]/)
      if (arrayMatch) {
        jsonContent = arrayMatch[0]
      }
      
      recommendations = JSON.parse(jsonContent)
      
      // Validate recommendations format
      if (!Array.isArray(recommendations) || recommendations.length === 0) {
        throw new Error('Invalid recommendations format')
      }
      
      console.log(`Successfully parsed ${recommendations.length} recommendations`)
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError)
      console.error('Response content:', content)
      
      // Fallback recommendations
      recommendations = [
        {
          title: "The Shawshank Redemption",
          platform: "Netflix",
          why_recommended: "A timeless classic about hope and friendship that appeals universally",
          genre: "Drama",
          rating: "9.3/10"
        },
        {
          title: "Avatar: The Last Airbender",
          platform: "Netflix",
          why_recommended: "An animated series combining adventure, humor, and deep storytelling",
          genre: "Animation/Adventure",
          rating: "9.3/10"
        },
        {
          title: "Inception",
          platform: "Prime Video",
          why_recommended: "Mind-bending thriller with stunning visuals and complex plot",
          genre: "Sci-Fi/Thriller",
          rating: "8.8/10"
        },
        {
          title: "The Office",
          platform: "Netflix",
          why_recommended: "Hilarious workplace comedy perfect for binge-watching together",
          genre: "Comedy",
          rating: "9.0/10"
        },
        {
          title: "Planet Earth II",
          platform: "Netflix",
          why_recommended: "Breathtaking nature documentary with stunning cinematography",
          genre: "Documentary",
          rating: "9.5/10"
        }
      ]
    }

    // Store recommendations in Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    // Get user ID from JWT
    const token = authHeader.replace('Bearer ', '')
    const { data: userData, error: userError } = await supabase.auth.getUser(token)
    
    if (userError || !userData.user) {
      throw new Error('Invalid authentication')
    }

    const { error: insertError } = await supabase
      .from('ai_recommendations')
      .insert({
        room_id: roomId,
        user_id: userData.user.id,
        partner_id: partnerId || userData.user.id,
        recommendations: recommendations
      })

    if (insertError) {
      console.error('Error storing recommendations:', insertError)
    }

    return new Response(JSON.stringify({ recommendations }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Error in ai-recommendations function:', error)
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
        details: 'Please try again or contact support if the issue persists'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})