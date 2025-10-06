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
          error: 'OpenRouter API key not configured. Please add OPENROUTER_API_KEY secret.' 
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
    console.log('Using model: deepseek/deepseek-chat-v3.1:free')

    const prompt = mode === 'solo' 
      ? `
Based on this user's movie/series/music preferences, suggest 5 diverse entertainment options they would enjoy:

User Preferences:
- Favorite Genres: ${userPreferences?.genres?.join(', ') || 'Not specified'}
- Favorite Actors: ${userPreferences?.actors?.join(', ') || 'Not specified'}
- Favorite Directors: ${userPreferences?.directors?.join(', ') || 'Not specified'}
- Preferred Platforms: ${userPreferences?.platforms?.join(', ') || 'Netflix, Prime Video, YouTube'}
- Dislikes: ${userPreferences?.disliked?.join(', ') || 'None specified'}

Please suggest 5 movies/shows/documentaries they would enjoy on platforms like Netflix, Prime Video, Disney+, YouTube, HBO Max, or other streaming services.

Respond ONLY with valid JSON in this exact format:
[
  {
    "title": "Movie/Show Title",
    "platform": "Netflix/Prime Video/Disney+/etc",
    "why_recommended": "Detailed explanation of why this matches the user's preferences",
    "genre": "Primary genre",
    "rating": "IMDb rating or critic score if known"
  }
]

Focus on finding content that perfectly matches their stated preferences and interests.
`
      : `
Based on these two users' movie/series/music preferences, suggest 5 diverse entertainment options they can enjoy together:

User A Preferences:
- Favorite Genres: ${userPreferences?.genres?.join(', ') || 'Not specified'}
- Favorite Actors: ${userPreferences?.actors?.join(', ') || 'Not specified'}
- Favorite Directors: ${userPreferences?.directors?.join(', ') || 'Not specified'}
- Preferred Platforms: ${userPreferences?.platforms?.join(', ') || 'Netflix, Prime Video, YouTube'}
- Dislikes: ${userPreferences?.disliked?.join(', ') || 'None specified'}

User B Preferences:
- Favorite Genres: ${partnerPreferences?.genres?.join(', ') || 'Not specified'}
- Favorite Actors: ${partnerPreferences?.actors?.join(', ') || 'Not specified'}
- Favorite Directors: ${partnerPreferences?.directors?.join(', ') || 'Not specified'}
- Preferred Platforms: ${partnerPreferences?.platforms?.join(', ') || 'Netflix, Prime Video, YouTube'}
- Dislikes: ${partnerPreferences?.disliked?.join(', ') || 'None specified'}

Please suggest 5 movies/shows/documentaries they can enjoy together on platforms like Netflix, Prime Video, Disney+, YouTube, HBO Max, or other streaming services.

Respond ONLY with valid JSON in this exact format:
[
  {
    "title": "Movie/Show Title",
    "platform": "Netflix/Prime Video/Disney+/etc",
    "why_recommended": "Detailed explanation of why this is perfect for both users based on their preferences",
    "genre": "Primary genre",
    "rating": "IMDb rating or critic score if known"
  }
]

Focus on finding the perfect balance between both users' preferences. If they have conflicting tastes, suggest content that bridges their interests or alternates between their preferences.
`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openRouterApiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://ustwo.lovable.app',
        'X-Title': 'UsTwo'
      },
      body: JSON.stringify({
        model: 'deepseek/deepseek-chat-v3.1:free',
        messages: [
          {
            role: 'system',
            content: 'You are an expert entertainment curator. You MUST respond with ONLY a valid JSON array, no additional text or explanation. Start your response with [ and end with ]. No markdown, no code blocks, just pure JSON.'
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
      throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    const content = data.choices[0].message.content
    
    console.log('Raw AI response:', content)
    
    // Parse the AI response with robust handling for DeepSeek
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
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError)
      // Fallback recommendations if AI response is malformed
      recommendations = [
        {
          title: "The Queen's Gambit",
          platform: "Netflix",
          why_recommended: "A captivating drama that appeals to both strategic thinkers and those who enjoy character development",
          genre: "Drama",
          rating: "8.5/10"
        },
        {
          title: "Avatar: The Last Airbender",
          platform: "Netflix",
          why_recommended: "An animated series that combines adventure, humor, and deep storytelling that appeals to all ages",
          genre: "Animation/Adventure",
          rating: "9.3/10"
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
        partner_id: partnerId || userData.user.id, // Use user_id if no partner
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
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})