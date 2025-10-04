import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from 'next-themes';
import { useEffect } from "react";
import Index from "./pages/Index";
import Room from "./pages/Room";
import Auth from "./pages/Auth";
import Invite from "./pages/Invite";
import NotFound from "./pages/NotFound";
import { initializeSecurity } from "@/lib/security";
import { ThemeToggle } from '@/components/AnimatedUI';

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    initializeSecurity();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <TooltipProvider>
          <div className="min-h-screen bg-background text-foreground relative">
            <div className="fixed top-4 right-4 z-50">
              <ThemeToggle />
            </div>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/room/:roomId" element={<Room />} />
                <Route path="/invite/:roomCode" element={<Invite />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </div>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
