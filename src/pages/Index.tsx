import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    message: ""
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast({
      title: "Message Sent!",
      description: "Thank you for your message. I'll get back to you soon!",
    });
    setFormData({ name: "", email: "", message: "" });
  };

  const handleReset = () => {
    setFormData({ name: "", email: "", message: "" });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header Banner */}
      <div className="bg-accent border-4 border-double border-foreground py-3 text-center">
        <p className="text-2xl font-bold">🌐 Welcome to Seyitbek's Homepage 🌐</p>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <center>
          <h1 className="text-4xl font-bold mb-4 underline">Seyitbek Usmanov</h1>
          
          <img 
            src="https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcWp3NGVyOGZrZWV3OGo2YmE2NHZtNnQ3YjN6YjJ3ZnF5Y2NqNnJ1dCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/du3J3cXyzhj75IOgvA/giphy.gif" 
            alt="Welcome" 
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

          <h2 className="text-2xl font-bold mb-4">📧 Contact Me</h2>
          
          <form onSubmit={handleSubmit} className="max-w-2xl mx-auto mb-8">
            <table className="w-full border-4 border-foreground" cellPadding="8">
              <tbody>
                <tr className="bg-card">
                  <td className="border-2 border-foreground font-bold">Name:</td>
                  <td className="border-2 border-foreground">
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      className="w-full border-2 border-input bg-background px-2 py-1"
                      size={40}
                      required
                    />
                  </td>
                </tr>
                <tr className="bg-card">
                  <td className="border-2 border-foreground font-bold">Email:</td>
                  <td className="border-2 border-foreground">
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      className="w-full border-2 border-input bg-background px-2 py-1"
                      size={40}
                      required
                    />
                  </td>
                </tr>
                <tr className="bg-card">
                  <td className="border-2 border-foreground font-bold">Message:</td>
                  <td className="border-2 border-foreground">
                    <textarea
                      name="message"
                      value={formData.message}
                      onChange={handleChange}
                      className="w-full border-2 border-input bg-background px-2 py-1"
                      rows={6}
                      cols={40}
                      required
                    />
                  </td>
                </tr>
                <tr className="bg-accent">
                  <td colSpan={2} className="border-2 border-foreground text-center">
                    <button
                      type="submit"
                      className="border-2 border-foreground bg-primary text-primary-foreground px-6 py-2 hover:opacity-80 font-bold"
                    >
                      Send Message
                    </button>
                    <button
                      type="reset"
                      onClick={handleReset}
                      className="border-2 border-foreground bg-secondary text-secondary-foreground px-6 py-2 hover:opacity-80 font-bold ml-4"
                    >
                      Reset
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </form>

          <img 
            src="https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExY3c2bWN2Mzk3dGF4YW1tOXAxemljamxsMXBjdGdtMzQ5MjEwZWgyNiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/JIX9t2j0ZTN9S/giphy.gif" 
            alt="Under Construction" 
            className="my-4"
            width="150"
          />

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
