import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { PasswordProtection } from "@/components/PasswordProtection";
import Index from "./pages/Index";
import SalesHistory from "./pages/SalesHistory";
import SalesAnalytics from "./pages/SalesAnalytics";
import ProductManagement from "./pages/ProductManagement";
import Inventory from "./pages/Inventory";
import Settings from "./pages/Settings";
import DatabaseSetup from "./pages/DatabaseSetup";
import GCashTransactions from "./pages/GCashTransactions";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <PasswordProtection>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/sales" element={<SalesHistory />} />
            <Route path="/analytics" element={<SalesAnalytics />} />
            <Route path="/products" element={<ProductManagement />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/database" element={<DatabaseSetup />} />
            <Route path="/gcash" element={<GCashTransactions />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </PasswordProtection>
);

export default App;
