export type Session = {
  user: {
    id: string;
    name: string;
    email: string;
    image?: string | null;
    role?: string;
    shopName?: string | null;
    [key: string]: unknown;
  };
  [key: string]: unknown;
} | null;

