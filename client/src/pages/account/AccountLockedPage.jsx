import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '@/utils/api';
import { getCurrentUser } from '@/utils/roleUtils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const LENDER_SIDE_ROLES = ['lender_admin', 'lender_officer'];

export default function AccountLockedPage() {
  const currentUser = getCurrentUser();
  const [status, setStatus] = useState(null);

  useEffect(() => {
    api.get('/subscriptions/status').then((res) => setStatus(res.data.data)).catch(() => {});
  }, []);

  const isLenderSide = currentUser && LENDER_SIDE_ROLES.includes(currentUser.role);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="max-w-md w-full rounded-2xl">
        <CardHeader className="text-center">
          <img src="/brand/svg/NdalamaHub-icon.svg" alt="" className="h-10 w-10 mx-auto mb-3" />
          <CardTitle className="text-xl font-medium text-foreground">Account access locked</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          {isLenderSide ? (
            <p>
              Your organisation's NdalamaHub subscription is inactive
              {status?.effectiveStatus ? ` (${status.effectiveStatus.replace('_', ' ')})` : ''}.
              Please arrange payment with Nexus to restore access.
            </p>
          ) : (
            <p>
              Your lender's NdalamaHub account is temporarily locked, so most features are
              unavailable right now. This isn't something you need to fix — please check with
              your organisation, or raise a support ticket below.
            </p>
          )}
          <p>You can still log in and reach support while this is resolved.</p>
          <div className="flex gap-3 pt-2">
            <Button asChild>
              <Link to="/support">Contact support</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/login">Back to login</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
