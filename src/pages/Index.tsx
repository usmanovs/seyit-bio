import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { User } from "@supabase/supabase-js";
import { KyrgyzSubtitleGenerator } from "@/components/KyrgyzSubtitleGenerator";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Globe, Zap, Shield, Video, Languages, Sparkles, ArrowRight } from "lucide-react";
const Index = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    // Set up auth state listener FIRST
    const {
      data: {
        subscription
      }
    } = supabase.auth.onAuthStateChange((event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      setLoading(false);
      
      // Redirect authenticated users to dashboard
      if (currentUser) {
        navigate('/dashboard');
      }
    });

    // THEN check for existing session
    supabase.auth.getSession().then(({
      data: {
        session
      }
    }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      setLoading(false);
      
      // Redirect authenticated users to dashboard
      if (currentUser) {
        navigate('/dashboard');
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);
  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logged out successfully");
  };
  const scrollToGenerator = () => {
    const element = document.getElementById('generator-section');
    element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Gradient Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-primary/5 via-background to-secondary/5 -z-10" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent -z-10" />
      
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border/40">
        <div className="container mx-auto px-4 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3 group cursor-pointer">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shadow-primary/20 group-hover:shadow-primary/40 transition-all">
                <Video className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                Kyrgyz Subtitle Pro
              </span>
            </div>
            <div className="flex items-center gap-4">
              {!loading && (user ? (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground hidden sm:inline">{user.email}</span>
                  <Button onClick={handleLogout} variant="ghost" size="sm" className="rounded-full">
                    Sign Out
                  </Button>
                </div>
              ) : (
                <Button onClick={() => navigate('/auth')} className="rounded-full px-6">
                  Get Started
                </Button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 lg:px-8 pt-20 pb-16">
        <div className="max-w-5xl mx-auto text-center space-y-8 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 backdrop-blur-sm">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">AI-Powered Translation Technology</span>
          </div>
          
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold leading-[1.1] tracking-tight">
            Transform Videos with{" "}
            <span className="bg-gradient-to-r from-primary via-primary to-secondary bg-clip-text text-transparent">
              Kyrgyz Subtitles
            </span>
          </h1>
          
          <p className="text-xl sm:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed font-light">
            Professional AI-powered subtitle generation in minutes. 
            Perfect translations, beautiful styling, zero hassle.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Button 
              size="lg" 
              onClick={scrollToGenerator} 
              className="text-lg px-8 h-14 rounded-full shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all group"
            >
              Start Creating Free
              <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              onClick={() => navigate('/auth')} 
              className="text-lg px-8 h-14 rounded-full border-2"
            >
              View Demo
            </Button>
          </div>
          
          <div className="flex items-center justify-center gap-8 pt-8 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              <span>No credit card</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              <span>Free to start</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              <span>Cancel anytime</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 lg:px-8 py-16">
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-4xl lg:text-5xl font-bold">
            Everything You Need
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto font-light">
            Professional tools for perfect Kyrgyz subtitles
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
          {[
            {
              icon: Zap,
              title: "Lightning Fast",
              description: "Generate accurate Kyrgyz subtitles in minutes, not hours. AI-powered processing delivers results instantly.",
              gradient: "from-amber-500/10 to-orange-500/10"
            },
            {
              icon: Languages,
              title: "Native Translation",
              description: "High-quality Kyrgyz translations that maintain context and cultural nuances perfectly.",
              gradient: "from-blue-500/10 to-cyan-500/10"
            },
            {
              icon: Globe,
              title: "6 Style Options",
              description: "Choose from Classic, Outline, Minimal, Yellow, Green, or Boxed caption styles to match your brand.",
              gradient: "from-purple-500/10 to-pink-500/10"
            },
            {
              icon: CheckCircle2,
              title: "Edit & Refine",
              description: "Full subtitle editor with real-time preview. Perfect every word before exporting.",
              gradient: "from-green-500/10 to-emerald-500/10"
            },
            {
              icon: Video,
              title: "Burn-In Subtitles",
              description: "Download videos with permanently embedded subtitles for maximum compatibility.",
              gradient: "from-red-500/10 to-rose-500/10"
            },
            {
              icon: Shield,
              title: "Secure & Private",
              description: "Your videos are processed securely and never stored permanently. Your privacy matters.",
              gradient: "from-indigo-500/10 to-violet-500/10"
            }
          ].map((feature, index) => (
            <Card 
              key={index}
              className="relative overflow-hidden border-border/50 hover:border-primary/50 transition-all duration-300 hover:shadow-xl hover:shadow-primary/5 group"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
              <CardContent className="p-8 relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <feature.icon className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="container mx-auto px-4 lg:px-8 py-16">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl lg:text-5xl font-bold">
              Simple Three-Step Process
            </h2>
            <p className="text-xl text-muted-foreground font-light">
              From upload to download in minutes
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            {/* Connecting lines */}
            <div className="hidden md:block absolute top-12 left-1/4 right-1/4 h-0.5 bg-gradient-to-r from-primary/50 via-primary to-primary/50" />
            
            {[
              {
                number: "01",
                title: "Upload Your Video",
                description: "Select any video file from your device. We support all major formats including MP4, MOV, and AVI."
              },
              {
                number: "02",
                title: "AI Generates Subtitles",
                description: "Our advanced AI transcribes audio and translates to Kyrgyz with perfect timing and accuracy."
              },
              {
                number: "03",
                title: "Download & Share",
                description: "Edit subtitles if needed, choose your style, and download your video ready to share."
              }
            ].map((step, index) => (
              <div key={index} className="relative">
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="relative">
                    <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-2xl shadow-primary/25 relative z-10">
                      <span className="text-3xl font-bold text-primary-foreground">{step.number}</span>
                    </div>
                    <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary to-primary/60 blur-xl opacity-40 animate-pulse" />
                  </div>
                  <h3 className="text-2xl font-bold">{step.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Generator Section */}
      <section id="generator-section" className="container mx-auto px-4 lg:px-8 py-16 scroll-mt-20">
        <div className="text-center mb-12 space-y-4">
          <h2 className="text-4xl lg:text-5xl font-bold">
            Try It Free
          </h2>
          <p className="text-xl text-muted-foreground font-light">
            Experience the power of AI subtitle generation
          </p>
        </div>
        <div className="animate-fade-in">
          <KyrgyzSubtitleGenerator />
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 lg:px-8 py-16">
        <div className="relative overflow-hidden rounded-3xl">
          <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/90 to-secondary" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent" />
          
          <div className="relative p-12 lg:p-20 text-center">
            <div className="max-w-3xl mx-auto space-y-6">
              <h2 className="text-4xl lg:text-5xl font-bold text-primary-foreground">
                Ready to Transform Your Videos?
              </h2>
              <p className="text-xl text-primary-foreground/90 font-light">
                Join content creators reaching Kyrgyz-speaking audiences worldwide with professional AI-powered subtitles.
              </p>
              <div className="pt-6">
                <Button 
                  size="lg" 
                  onClick={scrollToGenerator}
                  className="bg-background text-foreground hover:bg-background/90 text-lg px-10 h-14 rounded-full shadow-2xl group"
                >
                  Start Creating Now
                  <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 bg-muted/30">
        <div className="container mx-auto px-4 lg:px-8 py-12">
          <div className="flex flex-col items-center justify-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg">
                <Video className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-lg font-bold">Kyrgyz Subtitle Pro</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Made with ❤️ for the Kyrgyz community
            </p>
            <p className="text-xs text-muted-foreground">
              © 2025 Kyrgyz Subtitle Pro. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};
export default Index;