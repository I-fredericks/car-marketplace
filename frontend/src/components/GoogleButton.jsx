import React, { useContext, useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { AuthContext } from '../context/AuthContext';

// Renders Google's official button and signs the user in/up through the
// backend (/auth/google). Optional role ('BUYER' | 'SELLER') is applied on
// first-time signups, mirroring the normal register flow.
const GoogleButton = ({ role, sellerType, onError, navigate }) => {
  const { loginWithGoogle } = useContext(AuthContext);
  const [busy, setBusy] = useState(false);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={busy ? 'pointer-events-none opacity-70 w-full flex justify-center' : 'w-full flex justify-center'}>
        <GoogleLogin
          onSuccess={async (credentialResponse) => {
            if (!credentialResponse?.credential) {
              onError?.('Google sign-in did not return a credential. Please try again.');
              return;
            }
            setBusy(true);
            try {
              const profile = await loginWithGoogle(credentialResponse.credential, role, sellerType);
              const target = profile?.role === 'SELLER' ? '/seller/dashboard' : '/';
              // Always finish on the site; if the router got lost returning
              // from the Google sheet, this lands them the same tab anyway.
              navigate(target, { replace: true });
            } catch (err) {
              onError?.(err.response?.data?.message || 'Google sign-in failed. Please try again.');
            } finally {
              setBusy(false);
            }
          }}
          onError={() => onError?.('Google sign-in was cancelled or failed.')}
          width="100%"
          text="continue_with"
        />
      </div>
      {busy && <span className="text-xs text-textsecondary">Signing you in...</span>}
    </div>
  );
};

export default GoogleButton;
