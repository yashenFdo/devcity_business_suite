import React from 'react';
import type { Permission } from '../../security/permissions';
import { useCan } from '../../security/sessionState';
import { AccessDenied } from '../ui/States';

/** Route-level guard. Store actions also enforce permissions independently. */
export const RequirePermission: React.FC<{ permission: Permission; children: React.ReactNode }> = ({
  permission,
  children,
}) => (useCan(permission) ? <>{children}</> : <AccessDenied />);
