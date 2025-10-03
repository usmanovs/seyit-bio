import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { User } from "@supabase/supabase-js";
import { KyrgyzSubtitleGenerator } from "@/components/KyrgyzSubtitleGenerator";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Globe, Zap, Shield, Video, Languages } from "lucide-react";
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
    element?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted">
      {/* Header */}
      <header className="border-b sticky top-0 bg-background/95 backdrop-blur-sm z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Video className="w-6 h-6 text-primary" />
            <h1 className="text-xl font-bold">Kyrgyz Subtitle Pro</h1>
          </div>
          <div className="flex items-center gap-4">
            {!loading && (user ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">{user.email}</span>
                <Button onClick={handleLogout} variant="outline" size="sm">
                  Logout
                </Button>
              </div>
            ) : (
              <Button onClick={() => navigate('/auth')} variant="default">
                Sign In
              </Button>
            ))}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="inline-block px-4 py-2 bg-primary/10 rounded-full mb-4">
            <span className="text-sm font-semibold text-primary">✨ AI-Powered Translation</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold leading-tight">
            Add <span className="text-primary">Kyrgyz Subtitles</span> to Your Videos in Minutes
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Transform your videos with professional Kyrgyz subtitles. Powered by advanced AI, 
            our tool delivers accurate translations with multiple styling options.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-6">
            <Button size="lg" onClick={scrollToGenerator} className="text-lg px-8">
              Try It Free Now
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate('/auth')} className="text-lg px-8">
              Learn More
            </Button>
          </div>
          <p className="text-sm text-muted-foreground pt-2">
            No credit card required • Free to start
          </p>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Why Choose Our Subtitle Generator?</h2>
          <p className="text-muted-foreground text-lg">Everything you need to create perfect Kyrgyz subtitles</p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          <Card className="border-2">
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-2">Lightning Fast</h3>
              <p className="text-muted-foreground">
                Generate accurate Kyrgyz subtitles in minutes, not hours. AI-powered processing delivers results instantly.
              </p>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                <Languages className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-2">Native Translation</h3>
              <p className="text-muted-foreground">
                High-quality Kyrgyz translations that maintain context and cultural nuances perfectly.
              </p>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                <Globe className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-2">6 Style Options</h3>
              <p className="text-muted-foreground">
                Choose from Classic, Outline, Minimal, Yellow, Green, or Boxed caption styles to match your brand.
              </p>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                <CheckCircle2 className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-2">Edit & Refine</h3>
              <p className="text-muted-foreground">
                Full subtitle editor with real-time preview. Perfect every word before exporting.
              </p>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                <Video className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-2">Burn-In Subtitles</h3>
              <p className="text-muted-foreground">
                Download videos with permanently embedded subtitles for maximum compatibility.
              </p>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-2">Secure & Private</h3>
              <p className="text-muted-foreground">
                Your videos are processed securely and never stored permanently. Your privacy matters.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* How It Works */}
      <section className="container mx-auto px-4 py-16 bg-muted/50 rounded-2xl my-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">How It Works</h2>
          <p className="text-muted-foreground text-lg">Three simple steps to professional subtitles</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-2xl font-bold mx-auto">
              1
            </div>
            <h3 className="text-xl font-bold">Upload Your Video</h3>
            <p className="text-muted-foreground">
              Select any video file from your device. We support all major formats.
            </p>
          </div>

          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-2xl font-bold mx-auto">
              2
            </div>
            <h3 className="text-xl font-bold">AI Generates Subtitles</h3>
            <p className="text-muted-foreground">
              Our AI transcribes and translates your content to Kyrgyz automatically.
            </p>
          </div>

          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-2xl font-bold mx-auto">
              3
            </div>
            <h3 className="text-xl font-bold">Download & Share</h3>
            <p className="text-muted-foreground">
              Edit, style, and download your video with perfect Kyrgyz subtitles.
            </p>
          </div>
        </div>
      </section>

      {/* Generator Section */}
      <section id="generator-section" className="container mx-auto px-4 py-16">
        <div className="text-center mb-8">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Try It Now</h2>
          <p className="text-muted-foreground text-lg">Start adding Kyrgyz subtitles to your videos</p>
        </div>
        <KyrgyzSubtitleGenerator />
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-16">
        <Card className="border-2 bg-gradient-to-r from-primary/10 to-primary/5">
          <CardContent className="p-12 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to Get Started?</h2>
            <p className="text-muted-foreground text-lg mb-8 max-w-2xl mx-auto">
              Join content creators who are reaching Kyrgyz-speaking audiences with professional subtitles.
            </p>
            <Button size="lg" onClick={scrollToGenerator} className="text-lg px-8">
              Start Creating Subtitles
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t mt-16">
        <div className="container mx-auto px-4 py-8 text-center text-sm text-muted-foreground">
          <p>© 2025 Kyrgyz Subtitle Pro. Made with ❤️ for the Kyrgyz community.</p>
        </div>
      </footer>
    </div>
  );
};
export default Index;