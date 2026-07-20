import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import ComingSoon from "./pages/ComingSoon";
import Index from "./pages/Index";
import ErrorBoundary from "./components/ErrorBoundary";
import CookieConsent from "./components/CookieConsent";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import CookiePolicy from "./pages/CookiePolicy";
import TermsConditions from "./pages/TermsConditions";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";
import ResetPassword from "./pages/ResetPassword";
import LinkExpired from "./pages/LinkExpired";
import Account from "./pages/Account";
import StartRepair from "./pages/StartRepair";
import PairFlowDialog from "./components/cobbli/PairFlowDialog";
import AssessmentUpload from "./pages/AssessmentUpload";
import AssessmentDetails from "./pages/AssessmentDetails";
import AssessmentDeposit from "./pages/AssessmentDeposit";
import AssessmentConfirmation from "./pages/AssessmentConfirmation";
import AssessmentProposal from "./pages/AssessmentProposal";
import Admin from "./pages/Admin";
import AdminDashboard from "./pages/AdminDashboard";
import AdminOrderDetail from "./pages/AdminOrderDetail";
import OwnerSettings from "./pages/OwnerSettings";
import AdminBlog from "./pages/AdminBlog";
import AdminOrders from "./pages/admin/AdminOrders";
import AdminReworks from "./pages/admin/AdminReworks";
import AdminReports from "./pages/admin/AdminReports";
import Blog from "./pages/Blog";
import BlogPost from "./pages/BlogPost";
import SelectServices from "./pages/SelectServices";
import Services from "./pages/Services";
import ServiceDetail from "./pages/ServiceDetail";
import PackageDetail from "./pages/PackageDetail";
import Bag from "./pages/Bag";
import Checkout from "./pages/Checkout";
import OrderConfirmation from "./pages/OrderConfirmation";
import Faqs from "./pages/Faqs";
import NotFound from "./pages/NotFound";
import { AuthProvider } from "./context/AuthContext";
import { BagProvider } from "./context/BagContext";
import { PairsProvider } from "./context/PairsContext";
import { RepairFlowProvider } from "./context/RepairFlowContext";
import { AssessmentProvider } from "./context/AssessmentContext";
import { AccountProvider } from "./context/AccountContext";
import ProtectedRoute from "./components/ProtectedRoute";
import RoleRoute from "./components/RoleRoute";

const queryClient = new QueryClient();

// Pre-launch mode: while true, cobbli.com's homepage shows the "coming soon"
// waitlist page (ComingSoon.tsx) instead of the real site — everything else
// still builds and deploys normally underneath, just not linked from "/".
// To go live, flip VITE_COMING_SOON to "false" (or remove it) in the
// hosting environment's build settings and redeploy — no code change needed.
// Danielle's call, 2026-07-20: this needs to be a zero-developer flip once
// her AWS contractor's engagement ends July 31st.
const SHOW_COMING_SOON = import.meta.env.VITE_COMING_SOON === "true";

// Fires a GA4 page_view on every client-side route change. gtag is only defined
// after cookie consent is accepted (see src/lib/consent.ts), so this no-ops
// until the visitor opts in.
const PageTracker = () => {
  const location = useLocation();
  useEffect(() => {
    if (typeof window.gtag !== "function") return;
    window.gtag("event", "page_view", {
      page_path: location.pathname + location.search,
      page_title: document.title,
    });
  }, [location]);
  return null;
};

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <PageTracker />
          <AuthProvider>
            <AccountProvider>
              <BagProvider>
                <PairsProvider>
                  <RepairFlowProvider>
                    <AssessmentProvider>
                      <Routes>
                        <Route path="/" element={SHOW_COMING_SOON ? <ComingSoon /> : <Index />} />
                        <Route path="/coming-soon" element={<ComingSoon />} />
                        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                        <Route path="/cookie-policy" element={<CookiePolicy />} />
                        <Route path="/terms-conditions" element={<TermsConditions />} />
                        <Route path="/signin" element={<SignIn />} />
                        <Route path="/signup" element={<SignUp />} />
                        <Route path="/reset-password" element={<ResetPassword />} />
                        <Route path="/link-expired" element={<LinkExpired />} />
                        <Route path="/start-repair" element={<StartRepair />} />
                        <Route path="/start-repair/assessment" element={<AssessmentUpload />} />
                        <Route path="/start-repair/assessment/details" element={<AssessmentDetails />} />
                        <Route path="/start-repair/assessment/deposit" element={<AssessmentDeposit />} />
                        <Route path="/start-repair/assessment/confirmation" element={<AssessmentConfirmation />} />
                        <Route
                          path="/start-repair/assessment/proposal/:id"
                          element={
                            <ProtectedRoute>
                              <AssessmentProposal />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/proposal/:id"
                          element={
                            <ProtectedRoute>
                              <AssessmentProposal />
                            </ProtectedRoute>
                          }
                        />
                        {/* Public proposal route — no login required to view.
                            Looks up the assessment by proposal_token column so
                            the URL is safe to put in a customer email.
                            The proposal_token is the access credential; the
                            customer is prompted to sign in only when they
                            click "Approve" (so we have a user_id for the order). */}
                        <Route
                          path="/proposal/t/:token"
                          element={<AssessmentProposal />}
                        />
                        <Route path="/start-repair/services" element={<SelectServices />} />
                        <Route path="/start-repair/services/:slug" element={<ServiceDetail mode="flow" />} />
                        <Route path="/services" element={<Services />} />
                        <Route path="/services/zipper-reattachment" element={<Navigate to="/services#zipper" replace />} />
                        <Route path="/start-repair/services/zipper-reattachment" element={<Navigate to="/start-repair/services" replace />} />
                        <Route path="/services/:slug" element={<ServiceDetail mode="standalone" />} />
                        <Route path="/packages/:slug" element={<PackageDetail />} />
                        <Route path="/bag" element={<Bag />} />
                        <Route path="/checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
                        <Route path="/order-confirmation/:id" element={<OrderConfirmation />} />
                        <Route path="/faqs" element={<Faqs />} />
                        <Route path="/blog" element={<Blog />} />
                        <Route path="/blog/:slug" element={<BlogPost />} />
                        <Route
                          path="/admin"
                          element={
                            <RoleRoute allow={["admin", "staff"]}>
                              <AdminDashboard />
                            </RoleRoute>
                          }
                        />
                        <Route
                          path="/admin/order/:id"
                          element={
                            <RoleRoute allow={["admin", "staff"]}>
                              <AdminOrderDetail />
                            </RoleRoute>
                          }
                        />
                        <Route
                          path="/admin/orders"
                          element={
                            <RoleRoute allow={["admin", "staff"]}>
                              <AdminOrders />
                            </RoleRoute>
                          }
                        />
                        <Route
                          path="/admin/reworks"
                          element={
                            <RoleRoute allow={["admin", "staff"]}>
                              <AdminReworks />
                            </RoleRoute>
                          }
                        />
                        <Route
                          path="/admin/reports"
                          element={
                            <RoleRoute allow={["admin"]}>
                              <AdminReports />
                            </RoleRoute>
                          }
                        />
                        <Route
                          path="/admin/settings"
                          element={
                            <RoleRoute allow={["admin"]}>
                              <OwnerSettings />
                            </RoleRoute>
                          }
                        />
                        <Route
                          path="/admin/blog"
                          element={
                            <RoleRoute allow={["admin"]}>
                              <AdminBlog />
                            </RoleRoute>
                          }
                        />
                        <Route
                          path="/account/*"
                          element={
                            <ProtectedRoute>
                              <Account />
                            </ProtectedRoute>
                          }
                        />
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                      <PairFlowDialog />
                      <CookieConsent />
                    </AssessmentProvider>
                  </RepairFlowProvider>
                </PairsProvider>
              </BagProvider>
            </AccountProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
