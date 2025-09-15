export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      ai_recommendations: {
        Row: {
          created_at: string | null
          id: string
          partner_id: string
          recommendations: Json
          room_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          partner_id: string
          recommendations: Json
          room_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          partner_id?: string
          recommendations?: Json
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_recommendations_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          created_at: string
          creator_id: string
          description: string | null
          end_time: string
          id: string
          partner_id: string | null
          room_id: string | null
          start_time: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          creator_id: string
          description?: string | null
          end_time: string
          id?: string
          partner_id?: string | null
          room_id?: string | null
          start_time: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          creator_id?: string
          description?: string | null
          end_time?: string
          id?: string
          partner_id?: string | null
          room_id?: string | null
          start_time?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      google_drive_tokens: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string
          id: string
          refresh_token: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at: string
          id?: string
          refresh_token?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string
          id?: string
          refresh_token?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      invites: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          invite_code: string
          receiver_email: string
          receiver_id: string | null
          sender_id: string
          status: Database["public"]["Enums"]["invite_status"] | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          invite_code?: string
          receiver_email: string
          receiver_id?: string | null
          sender_id: string
          status?: Database["public"]["Enums"]["invite_status"] | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          invite_code?: string
          receiver_email?: string
          receiver_id?: string | null
          sender_id?: string
          status?: Database["public"]["Enums"]["invite_status"] | null
          updated_at?: string
        }
        Relationships: []
      }
      love_stats: {
        Row: {
          created_at: string
          date: string
          hearts_received: number | null
          hearts_sent: number | null
          id: string
          partner_id: string
          sessions_count: number | null
          updated_at: string
          user_id: string
          watch_time_minutes: number | null
        }
        Insert: {
          created_at?: string
          date?: string
          hearts_received?: number | null
          hearts_sent?: number | null
          id?: string
          partner_id: string
          sessions_count?: number | null
          updated_at?: string
          user_id: string
          watch_time_minutes?: number | null
        }
        Update: {
          created_at?: string
          date?: string
          hearts_received?: number | null
          hearts_sent?: number | null
          id?: string
          partner_id?: string
          sessions_count?: number | null
          updated_at?: string
          user_id?: string
          watch_time_minutes?: number | null
        }
        Relationships: []
      }
      media_sources: {
        Row: {
          created_at: string
          created_by: string
          duration_seconds: number | null
          id: string
          media_type: Database["public"]["Enums"]["media_type"]
          thumbnail_url: string | null
          title: string
          url: string
        }
        Insert: {
          created_at?: string
          created_by: string
          duration_seconds?: number | null
          id?: string
          media_type: Database["public"]["Enums"]["media_type"]
          thumbnail_url?: string | null
          title: string
          url: string
        }
        Update: {
          created_at?: string
          created_by?: string
          duration_seconds?: number | null
          id?: string
          media_type?: Database["public"]["Enums"]["media_type"]
          thumbnail_url?: string | null
          title?: string
          url?: string
        }
        Relationships: []
      }
      notes: {
        Row: {
          content: string
          created_at: string
          id: string
          is_personal: boolean | null
          is_read: boolean | null
          receiver_id: string | null
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_personal?: boolean | null
          is_read?: boolean | null
          receiver_id?: string | null
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_personal?: boolean | null
          is_read?: boolean | null
          receiver_id?: string | null
          sender_id?: string
        }
        Relationships: []
      }
      playback_state: {
        Row: {
          created_at: string
          current_time_seconds: number | null
          id: string
          is_playing: boolean | null
          last_updated_by: string | null
          media_id: string | null
          room_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_time_seconds?: number | null
          id?: string
          is_playing?: boolean | null
          last_updated_by?: string | null
          media_id?: string | null
          room_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_time_seconds?: number | null
          id?: string
          is_playing?: boolean | null
          last_updated_by?: string | null
          media_id?: string | null
          room_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "playback_state_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playback_state_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      preferences: {
        Row: {
          actors: string[] | null
          created_at: string | null
          directors: string[] | null
          disliked: string[] | null
          genres: string[] | null
          id: string
          platforms: string[] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          actors?: string[] | null
          created_at?: string | null
          directors?: string[] | null
          disliked?: string[] | null
          genres?: string[] | null
          id?: string
          platforms?: string[] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          actors?: string[] | null
          created_at?: string | null
          directors?: string[] | null
          disliked?: string[] | null
          genres?: string[] | null
          id?: string
          platforms?: string[] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      room_members: {
        Row: {
          id: string
          joined_at: string
          room_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          room_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_members_room_fk"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          created_at: string
          creator_id: string
          id: string
          is_private: boolean | null
          name: string
          partner_id: string | null
          room_code: string | null
          status: Database["public"]["Enums"]["room_status"] | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          creator_id: string
          id?: string
          is_private?: boolean | null
          name: string
          partner_id?: string | null
          room_code?: string | null
          status?: Database["public"]["Enums"]["room_status"] | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          creator_id?: string
          id?: string
          is_private?: boolean | null
          name?: string
          partner_id?: string | null
          room_code?: string | null
          status?: Database["public"]["Enums"]["room_status"] | null
          updated_at?: string
        }
        Relationships: []
      }
      rtc_signaling: {
        Row: {
          created_at: string
          id: string
          payload: Json
          room_code: string
          room_id: string
          sender: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          payload: Json
          room_code: string
          room_id: string
          sender: string
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          payload?: Json
          room_code?: string
          room_id?: string
          sender?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "rtc_signaling_room_fk"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_recommendations: {
        Row: {
          created_at: string | null
          id: string
          recommendation_data: Json
          room_id: string
          saved_by: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          recommendation_data: Json
          room_id: string
          saved_by: string
        }
        Update: {
          created_at?: string | null
          id?: string
          recommendation_data?: Json
          room_id?: string
          saved_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_recommendations_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_files: {
        Row: {
          created_at: string
          file_name: string
          file_size: number
          google_drive_id: string | null
          google_drive_url: string | null
          id: string
          is_google_drive: boolean | null
          mime_type: string
          room_id: string
          storage_path: string
          updated_at: string
          upload_status: string | null
          uploader_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size: number
          google_drive_id?: string | null
          google_drive_url?: string | null
          id?: string
          is_google_drive?: boolean | null
          mime_type: string
          room_id: string
          storage_path: string
          updated_at?: string
          upload_status?: string | null
          uploader_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number
          google_drive_id?: string | null
          google_drive_url?: string | null
          id?: string
          is_google_drive?: boolean | null
          mime_type?: string
          room_id?: string
          storage_path?: string
          updated_at?: string
          upload_status?: string | null
          uploader_id?: string
        }
        Relationships: []
      }
      torrent_links: {
        Row: {
          created_at: string
          created_by: string
          id: string
          magnet: string
          room_code: string
          room_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          magnet: string
          room_code: string
          room_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          magnet?: string
          room_code?: string
          room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "torrent_links_room_fk"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          partner_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          partner_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          partner_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_invite_code: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_room_code: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      join_room_by_code: {
        Args: { p_code: string }
        Returns: {
          created_at: string
          creator_id: string
          id: string
          is_private: boolean | null
          name: string
          partner_id: string | null
          room_code: string | null
          status: Database["public"]["Enums"]["room_status"] | null
          updated_at: string
        }
      }
    }
    Enums: {
      invite_status: "pending" | "accepted" | "declined"
      media_type: "video" | "audio" | "stream"
      room_status: "active" | "paused" | "ended"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      invite_status: ["pending", "accepted", "declined"],
      media_type: ["video", "audio", "stream"],
      room_status: ["active", "paused", "ended"],
    },
  },
} as const
