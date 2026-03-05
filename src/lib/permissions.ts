const parseEmailList = (value?: string): string[] => {
  if (!value) return [];

  return value
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
};

export const getSuperAdminEmails = (): string[] => {
  const serverList = process.env.SUPER_ADMIN_EMAILS || 'ideon.vn@gmail.com,franco.vheerden@gmail.com';
  const publicList = process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAILS;

  return parseEmailList(serverList || publicList);
};

export const isSuperAdminEmail = (email?: string | null): boolean => {
  if (!email) return false;

  const normalizedEmail = email.trim().toLowerCase();
  const superAdminEmails = getSuperAdminEmails();

  return superAdminEmails.includes(normalizedEmail);
};
