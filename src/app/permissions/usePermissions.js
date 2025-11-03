import { useEffect, useState } from 'react';

// Hook to compute permissions once per mount/user
export function usePermissions(user, caseId) {
  const [permissions, setPermissions] = useState({
    canEdit: false,
    isFieldEditable: true,
    userCheckingDone: false,
  });

  useEffect(() => {
    let mounted = true;
    async function computePermissions() {
      // Example synchronous logic. Replace with your checks.
      // If you call API, do it once here and set state.
      const canEdit = (user?.role === 'editor' || user?.isAdmin);
      const isFieldEditable = true; // compute from case status
      if (mounted) {
        setPermissions({
          canEdit,
          isFieldEditable,
          userCheckingDone: true,
        });
      }
    }
    computePermissions();
    return () => { mounted = false; };
  }, [user, caseId]);

  return permissions;
}