import { userSetupService } from './userSetupService';

// Returns true if the currently logged-in user is a super admin,
// as determined by the is_admin flag from /users/me/admin/setup.
export const isSuperAdminEmail = (): boolean => {
  return userSetupService.isAdmin();
};
