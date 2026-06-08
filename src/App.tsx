import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
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
import StartRepairPick from "./pages/StartRepairPick";
import AssessmentUpload from "./pages/AssessmentUpload";
import AssessmentDetails from "./pages/AssessmentDetails";
import AssessmentDeposit from "./pages/AssessmentDeposit";
import AssessmentConfirmation from "./pages/AssessmentConfirmation";
import Admin from "./pages/Admin";
import SelectServices from "./pages/SelectServices";
import Services from "./pages/Services";
import ServiceDetail from "./pages/ServiceDetail";
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
import AdminRoute from "./components/AdminRoute";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <AccountProvider>
              <BagProvider>
                <PairsProvider>
                  <RepairFlowProvider>
                    <AssessmentProvider>
                      <Routes>
                        <Route path="/" element={<Index />} />
                        <Route path="/coming-soon" element={<ComingSoon />} />
                        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                        <Route path="/cookie-policy" element={<CookiePolicy />} />
                        <Route path="/terms-conditions" element={<TermsConditions />} />
                        <Route path="/signin" element={<SignIn />} />
                        <Route path="/signup" element={<SignUp />} />
                        <Route path="/reset-password" element={<ResetPassword />} />
                        <Route path="/link-expired" element={<LinkExpired />} />
                        <Route path="/start-repair" element={<StartRepair />} />
                        <Route path="/start-repair/pick" element={<StartRepairPick />} />
                        <Route
                          path="/start-repair/assessment"
                          element={
                            <ProtectedRoute>
                              <AssessmentUpload />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/start-repair/assessment/details"
                          element={
                            <ProtectedRoute>
                              <AssessmentDetails />
                            </ProtectedRoute>
                          }
                        />
                        <Route path="/start-repair/services" element={<SelectServices />} />
                        <Route path="/start-repair/services/:slug" element={<ServiceDetail mode="flow" />} />
                        <Route path="/services" element={<Services />} />
                        <Route path="/services/:slug" element={<ServiceDetail mode="standalone" />} />
                        <Route path="/bag" element={<Bag />} />
                        <Route path="/checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
                        <Route path="/order-confirmation" element={<OrderConfirmation />} />
                        <Route path="/faqs" element={<Faqs />} />
                        <Route
                          path="/admin"
                          element={
                            <AdminRoute>
                              <Admin />
                            </AdminRoute>
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
