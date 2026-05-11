import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import Bag from "./pages/Bag.tsx";
import SignIn from "./pages/SignIn.tsx";
import SignUp from "./pages/SignUp.tsx";
import ResetPassword from "./pages/ResetPassword.tsx";
import TermsConditions from "./pages/TermsConditions.tsx";
import PrivacyPolicy from "./pages/PrivacyPolicy.tsx";
import Account from "./pages/Account.tsx";
import Faqs from "./pages/Faqs.tsx";
import Services from "./pages/Services.tsx";
import StartRepair from "./pages/StartRepair.tsx";
import SelectServices from "./pages/SelectServices.tsx";
import ServiceDetail from "./pages/ServiceDetail.tsx";
import Checkout from "./pages/Checkout.tsx";
import OrderConfirmation from "./pages/OrderConfirmation.tsx";
import { BagProvider } from "./context/BagContext";
import { PairsProvider } from "./context/PairsContext";
import { RepairFlowProvider } from "./context/RepairFlowContext";
import { AccountProvider } from "./context/AccountContext";
import ScrollToHash from "./components/ScrollToHash";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AccountProvider>
        <BagProvider>
          <PairsProvider>
            <RepairFlowProvider>
              <BrowserRouter>
              <ScrollToHash />
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/bag" element={<Bag />} />
                <Route path="/signin" element={<SignIn />} />
                <Route path="/signup" element={<SignUp />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/terms-conditions" element={<TermsConditions />} />
                <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                <Route path="/account/*" element={<Account />} />
                <Route path="/faqs" element={<Faqs />} />
                <Route path="/services" element={<Services />} />
                <Route path="/services/:slug" element={<ServiceDetail mode="standalone" />} />
                <Route path="/start-repair" element={<StartRepair />} />
                <Route path="/start-repair/services" element={<SelectServices />} />
                <Route path="/start-repair/services/:slug" element={<ServiceDetail mode="flow" />} />
                <Route path="/checkout" element={<Checkout />} />
                <Route path="/order-confirmation/:id" element={<OrderConfirmation />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
            </RepairFlowProvider>
          </PairsProvider>
        </BagProvider>
      </AccountProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
