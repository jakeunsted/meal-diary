export interface FamilyMember {
  id: number;
  username: string;
  email: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface DisplayMember {
  id: number;
  name: string;
  avatar_url?: string;
}

export interface FamilyGroup {
  id: number;
  name: string;
  random_identifier: string;
  created_by: number;
  created_at: string;
  updated_at: string;
}
