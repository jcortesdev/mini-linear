import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from '@convex-dev/auth/nextjs/server';

const isSignInPage = createRouteMatcher(['/sign-in']);
const isProtectedRoute = createRouteMatcher(['/issues(.*)', '/board(.*)']);

export default convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  const authenticated = await convexAuth.isAuthenticated();

  if (isSignInPage(request) && authenticated) {
    return nextjsMiddlewareRedirect(request, '/issues');
  }

  if (isProtectedRoute(request) && !authenticated) {
    return nextjsMiddlewareRedirect(request, '/sign-in');
  }
});

export const config = {
  // Run the middleware on everything except Next.js internals and static assets.
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
};
