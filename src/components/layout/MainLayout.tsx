import { Sidebar } from "./Sidebar";
import { Outlet, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

export function MainLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        navigate("/login");
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-950">
        {/* Mobile Menu Toggle */}
        <div className="md:hidden fixed top-4 left-4 z-50">
          <Button variant="ghost" size="icon" className="w-12 h-12" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
            {isSidebarOpen ? <X className="w-8 h-8" /> : <Menu className="w-8 h-8" />}
          </Button>
        </div>

        {/* Sidebar */}
        <div className={`fixed inset-y-0 left-0 z-40 w-64 bg-zinc-950 transform transition-transform duration-300 ease-in-out md:relative md:transform-none ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
          <Sidebar onClose={() => setIsSidebarOpen(false)} />
        </div>

        {/* Overlay */}
        {isSidebarOpen && (
          <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={() => setIsSidebarOpen(false)} />
        )}

        <main className="flex-1 overflow-y-auto w-full">
          <div className="max-w-7xl mx-auto p-4 md:p-8 pt-16 md:pt-8">
            <Outlet />
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
}
