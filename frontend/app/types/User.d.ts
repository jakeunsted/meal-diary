export interface User {
  id: number;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  family_group_id?: number;
  avatar_url?: string;
  created_at?: Date;
  updated_at?: Date;
}
