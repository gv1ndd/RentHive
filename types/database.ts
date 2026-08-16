export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      buildings: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          address: string | null;
          created_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          owner_id?: string;
          name: string;
          address?: string | null;
          created_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          address?: string | null;
          created_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      rooms: {
        Row: {
          id: string;
          building_id: string;
          room_number: string;
          floor_number: number;
          created_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          building_id: string;
          room_number: string;
          floor_number?: number;
          created_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          building_id?: string;
          room_number?: string;
          floor_number?: number;
          created_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      beds: {
        Row: {
          id: string;
          room_id: string;
          bed_label: string;
          default_rate: number;
          created_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          room_id: string;
          bed_label: string;
          default_rate?: number;
          created_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          room_id?: string;
          bed_label?: string;
          default_rate?: number;
          created_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      tenants: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          phone: string | null;
          id_proof_url?: string | null;
          created_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          owner_id?: string;
          name: string;
          phone?: string | null;
          id_proof_url?: string | null;
          created_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          phone?: string | null;
          id_proof_url?: string | null;
          created_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      tenancies: {
        Row: {
          id: string;
          bed_id: string;
          tenant_id: string;
          rate: number;
          due_day: number;
          first_month_free: boolean;
          check_in_date: string;
          check_out_date: string | null;
          notice_given_date: string | null;
          expected_move_out_date: string | null;
          created_at: string;
          edited_at: string | null;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          bed_id: string;
          tenant_id: string;
          rate: number;
          due_day?: number;
          first_month_free?: boolean;
          check_in_date: string;
          check_out_date?: string | null;
          notice_given_date?: string | null;
          expected_move_out_date?: string | null;
          created_at?: string;
          edited_at?: string | null;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          bed_id?: string;
          tenant_id?: string;
          rate?: number;
          due_day?: number;
          first_month_free?: boolean;
          check_in_date?: string;
          check_out_date?: string | null;
          notice_given_date?: string | null;
          expected_move_out_date?: string | null;
          created_at?: string;
          edited_at?: string | null;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      payments: {
        Row: {
          id: string;
          tenancy_id: string;
          amount: number;
          type: 'rent' | 'electricity' | 'utility' | 'maintenance' | 'penalty';
          date: string;
          method: string | null;
          receipt_number: string | null;
          created_at: string;
          edited_at: string | null;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          tenancy_id: string;
          amount: number;
          type?: 'rent' | 'electricity' | 'utility' | 'maintenance' | 'penalty';
          date: string;
          method?: string | null;
          receipt_number?: string | null;
          created_at?: string;
          edited_at?: string | null;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          tenancy_id?: string;
          amount?: number;
          type?: 'rent' | 'electricity' | 'utility' | 'maintenance' | 'penalty';
          date?: string;
          method?: string | null;
          receipt_number?: string | null;
          created_at?: string;
          edited_at?: string | null;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      advance_bookings: {
        Row: {
          id: string;
          owner_id: string;
          building_id: string;
          room_id: string | null;
          bed_id: string | null;
          tenant_name: string;
          tenant_phone: string | null;
          total_amount: number;
          paid_amount: number;
          expected_move_in_date: string;
          status: 'pending' | 'converted' | 'cancelled';
          converted_tenancy_id: string | null;
          created_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          owner_id?: string;
          building_id: string;
          room_id?: string | null;
          bed_id?: string | null;
          tenant_name: string;
          tenant_phone?: string | null;
          total_amount: number;
          paid_amount?: number;
          expected_move_in_date: string;
          status?: 'pending' | 'converted' | 'cancelled';
          converted_tenancy_id?: string | null;
          created_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          owner_id?: string;
          building_id?: string;
          room_id?: string | null;
          bed_id?: string | null;
          tenant_name?: string;
          tenant_phone?: string | null;
          total_amount?: number;
          paid_amount?: number;
          expected_move_in_date?: string;
          status?: 'pending' | 'converted' | 'cancelled';
          converted_tenancy_id?: string | null;
          created_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      meters: {
        Row: {
          id: string;
          room_id: string;
          meter_number: string;
          rate_per_unit: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          room_id: string;
          meter_number: string;
          rate_per_unit?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          room_id?: string;
          meter_number?: string;
          rate_per_unit?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      meter_readings: {
        Row: {
          id: string;
          meter_id: string;
          previous_reading: number;
          current_reading: number;
          units_consumed: number;
          amount_due: number;
          reading_date: string;
          created_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          meter_id: string;
          previous_reading: number;
          current_reading: number;
          units_consumed?: number;
          amount_due?: number;
          reading_date: string;
          created_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          meter_id?: string;
          previous_reading?: number;
          current_reading?: number;
          units_consumed?: number;
          amount_due?: number;
          reading_date?: string;
          created_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      tenant_notes: {
        Row: {
          id: string;
          tenant_id: string;
          note: string;
          status?: string;
          created_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          note: string;
          status?: string;
          created_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          note?: string;
          status?: string;
          created_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      convert_advance_booking: {
        Args: {
          p_booking_id: string;
          p_bed_id: string;
          p_rate: number;
          p_due_day: number;
          p_first_month_free: boolean;
          p_check_in_date: string;
        };
        Returns: {
          tenancy_id: string;
          tenant_id: string;
        };
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
