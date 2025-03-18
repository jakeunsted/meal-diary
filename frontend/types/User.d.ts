export interface User {
  id: number;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  family_group_id?: number;
  created_at?: Date;
  updated_at?: Date;
}
