export const shouldClearSubscriptionForAuthEvent = ({ event, nextUserId }) => (
  event === 'SIGNED_OUT' || !nextUserId
);

export const shouldRefetchSubscriptionForAuthEvent = ({ event, currentUserId, nextUserId }) => {
  if (!nextUserId) return false;
  if (event === 'TOKEN_REFRESHED' && currentUserId === nextUserId) return false;
  return currentUserId !== nextUserId;
};
