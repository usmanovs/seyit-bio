import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { User } from "@supabase/supabase-js";
import napsterLogo from "@/assets/napster-logo.png";

const Index = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logged out successfully");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header Banner */}
      <div className="bg-accent border-4 border-double border-foreground py-3 text-center relative">
        <p className="text-2xl font-bold">🌐 Welcome to Seyitbek's Homepage 🌐</p>
        <div className="absolute right-4 top-1/2 -translate-y-1/2">
          {!loading && (
            user ? (
              <div className="flex items-center gap-2">
                <span className="text-sm">👤 {user.email}</span>
                <button
                  onClick={handleLogout}
                  className="bg-primary text-primary-foreground border-2 border-foreground px-3 py-1 text-sm font-bold hover:bg-accent hover:text-accent-foreground"
                >
                  Logout
                </button>
              </div>
            ) : (
              <button
                onClick={() => navigate('/auth')}
                className="bg-primary text-primary-foreground border-2 border-foreground px-4 py-2 font-bold hover:bg-accent hover:text-accent-foreground"
              >
                🔐 Login / Sign Up
              </button>
            )
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <center>
          <h1 className="text-4xl font-bold mb-4 underline">Seyitbek Usmanov</h1>
          
          <img 
            src={napsterLogo} 
            alt="Napster" 
            className="my-4"
            width="200"
          />

          <hr className="border-2 border-foreground my-6" />

          <h2 className="text-2xl font-bold mb-3">📋 About Me</h2>
        </center>

        <div className="bg-card border-4 border-foreground p-6 mb-6">
          <p className="text-lg mb-4">
            <b>Welcome to my personal homepage!</b> I am a Salesforce expert, researcher, educator, and content creator.
          </p>
          <p className="text-lg">
            I love sharing inspirational ideas about Salesforce, real estate and personal finance and how this can 10x your life!
          </p>
        </div>

        <center>
          <h2 className="text-2xl font-bold mb-4">🎯 What I Do</h2>
        </center>

        <table className="w-full border-4 border-foreground mb-6" cellPadding="10">
          <tbody>
            <tr className="bg-primary text-primary-foreground">
              <td className="border-2 border-foreground">
                <b>📝 Content Creation</b>
                <br />
                Creator of "Profit with Salesforce" on Substack with over 1,000 subscribers. 
                Running the Salesforce Chef YouTube channel.
              </td>
            </tr>
            <tr className="bg-card">
              <td className="border-2 border-foreground">
                <b>🎓 Research & Academia</b>
                <br />
                Head of Research at the Central Asian Free Market Institute. 
                Professor at Montgomery College.
              </td>
            </tr>
            <tr className="bg-accent">
              <td className="border-2 border-foreground">
                <b>💼 Salesforce Expertise</b>
                <br />
                Helping professionals master Salesforce and accelerate their careers 
                through practical insights and real-world strategies.
              </td>
            </tr>
            <tr className="bg-card">
              <td className="border-2 border-foreground">
                <b>🤝 Advisory & Consulting</b>
                <br />
                Senior Research Associate at CognoLink Limited. 
                Advisory Board member at Lifeboat Foundation.
              </td>
            </tr>
          </tbody>
        </table>

        <center>
          <h2 className="text-2xl font-bold mb-4">🔗 Links</h2>
          
          <div className="bg-card border-4 border-foreground p-6 mb-6 inline-block">
            <p className="mb-3">
              <a href="https://sfchef.substack.com/" target="_blank" rel="noopener noreferrer" className="text-primary underline text-lg">
                📰 Read My Newsletter
              </a>
            </p>
            <p className="mb-3">
              <a href="https://www.youtube.com/c/SalesforceChief" target="_blank" rel="noopener noreferrer" className="text-primary underline text-lg">
                📺 Visit My YouTube Channel
              </a>
            </p>
            <p className="mb-3">
              <a href="https://www.linkedin.com/in/seyitbek" target="_blank" rel="noopener noreferrer" className="text-primary underline text-lg">
                💼 Connect on LinkedIn
              </a>
            </p>
            <p>
              <a href="mailto:contact@seyitbek.com" className="text-primary underline text-lg">
                📧 Send Me Email
              </a>
            </p>
          </div>

          <hr className="border-2 border-foreground my-6" />

          <h2 className="text-2xl font-bold mb-4">💼 Hire Me</h2>

          <div className="bg-card border-4 border-foreground p-6 mb-6 inline-block">
            <p className="text-lg mb-4">
              <b>Need expert Salesforce consulting?</b> Book a session with me:
            </p>
            
            <div className="flex flex-col gap-4">
              <button
                onClick={async () => {
                  try {
                    const { data, error } = await supabase.functions.invoke('create-payment', {
                      body: { priceId: 'price_1SCsw3LJqhOyuCVBPkoNGeWN' }
                    });
                    
                    if (error) throw error;
                    if (data.url) {
                      window.open(data.url, '_blank');
                    }
                  } catch (error) {
                    toast.error('Failed to create payment session');
                    console.error(error);
                  }
                }}
                className="bg-primary text-primary-foreground border-4 border-foreground px-6 py-3 font-bold hover:bg-accent hover:text-accent-foreground cursor-pointer text-lg"
              >
                📅 1 Hour Session - $200
              </button>
              
              <button
                onClick={async () => {
                  try {
                    const { data, error } = await supabase.functions.invoke('create-payment', {
                      body: { priceId: 'price_1SCswKLJqhOyuCVBuIP84sT9' }
                    });
                    
                    if (error) throw error;
                    if (data.url) {
                      window.open(data.url, '_blank');
                    }
                  } catch (error) {
                    toast.error('Failed to create payment session');
                    console.error(error);
                  }
                }}
                className="bg-secondary text-secondary-foreground border-4 border-foreground px-6 py-3 font-bold hover:bg-accent hover:text-accent-foreground cursor-pointer text-lg"
              >
                📅 2 Hour Session - $300 (Save $100!)
              </button>

              <hr className="border-2 border-foreground my-2" />

              <button
                onClick={async () => {
                  try {
                    const { data, error } = await supabase.functions.invoke('create-payment', {
                      body: { priceId: 'price_1SCsyFLJqhOyuCVBagDoYlCq' }
                    });
                    
                    if (error) throw error;
                    if (data.url) {
                      window.open(data.url, '_blank');
                    }
                  } catch (error) {
                    toast.error('Failed to create payment session');
                    console.error(error);
                  }
                }}
                className="bg-accent text-accent-foreground border-4 border-foreground px-6 py-3 font-bold hover:bg-secondary hover:text-secondary-foreground cursor-pointer text-lg"
              >
                ☕ Buy Seyit a Coffee - $5
              </button>
              <p className="text-sm text-center">
                <i>(Fuel my Salesforce wisdom with caffeine! ☕💡)</i>
              </p>

              <hr className="border-2 border-foreground my-4" />

              <button
                onClick={async () => {
                  if (!user) {
                    toast.error('Please sign in to join the family');
                    navigate('/auth');
                    return;
                  }

                  try {
                    const { data, error } = await supabase.functions.invoke('create-subscription-checkout', {
                      body: { priceId: 'price_1SD2vxLJqhOyuCVBNKCjdl2T' }
                    });
                    
                    if (error) throw error;
                    if (data.url) {
                      window.open(data.url, '_blank');
                    }
                  } catch (error) {
                    toast.error('Failed to create subscription');
                    console.error(error);
                  }
                }}
                className="bg-primary text-primary-foreground border-4 border-foreground px-6 py-3 font-bold hover:bg-accent hover:text-accent-foreground cursor-pointer text-lg animate-pulse"
              >
                👨‍👩‍👧‍👦 Join My Family - $10/month
              </button>
              <p className="text-sm text-center">
                <i>(First 10 days FREE! Access exclusive community & downloadable files 🎁)</i>
              </p>
            </div>
          </div>

          <hr className="border-2 border-foreground my-6" />

          <img 
            src="https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExY3c2bWN2Mzk3dGF4YW1tOXAxemljamxsMXBjdGdtMzQ5MjEwZWgyNiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/JIX9t2j0ZTN9S/giphy.gif" 
            alt="Under Construction" 
            className="my-4"
            width="150"
          />

          <hr className="border-2 border-foreground my-6" />

          <h2 className="text-2xl font-bold mb-4">📬 Contact Me</h2>

          <div className="bg-card border-4 border-foreground p-6 mb-6 inline-block w-full max-w-md">
            <form onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const name = formData.get('name') as string;
              const email = formData.get('email') as string;
              const message = formData.get('message') as string;
              
              const { error } = await supabase
                .from('contact_submissions')
                .insert({ name, email, message });
              
              if (error) {
                toast.error("Failed to send message. Please try again.");
              } else {
                toast.success(`Thank you ${name}! I'll get back to you soon.`);
                e.currentTarget.reset();
              }
            }}>
              <table className="w-full" cellPadding="8">
                <tbody>
                  <tr>
                    <td className="text-left"><b>Name:</b></td>
                  </tr>
                  <tr>
                    <td>
                      <input 
                        type="text" 
                        name="name"
                        required
                        className="w-full border-2 border-foreground p-2 bg-background"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="text-left"><b>Email:</b></td>
                  </tr>
                  <tr>
                    <td>
                      <input 
                        type="email" 
                        name="email"
                        required
                        className="w-full border-2 border-foreground p-2 bg-background"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="text-left"><b>Message:</b></td>
                  </tr>
                  <tr>
                    <td>
                      <textarea 
                        name="message"
                        required
                        rows={5}
                        className="w-full border-2 border-foreground p-2 bg-background"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="text-center pt-4">
                      <button 
                        type="submit"
                        className="bg-primary text-primary-foreground border-4 border-foreground px-6 py-2 font-bold hover:bg-accent cursor-pointer"
                      >
                        📤 SEND MESSAGE
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </form>
          </div>

          <p className="text-sm mt-6">
            <i>Last Updated: {new Date().toLocaleDateString()}</i>
          </p>
          
          <p className="text-sm mt-2">
            <b>Best viewed in Netscape Navigator 2.0 or higher</b>
          </p>

          <div className="mt-6 flex items-center justify-center gap-2">
            <span className="text-xs">Visitor count:</span>
            <div className="bg-foreground text-background px-3 py-1 font-mono border-2 border-foreground">
              000042
            </div>
          </div>
        </center>
      </div>
    </div>
  );
};

export default Index;
